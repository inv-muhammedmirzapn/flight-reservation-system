from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance,
    CabinClass, RefundType, RouteFareClass,
)
from apps.pricing.models import (
    DynamicPricingConfig, HolidayEvent, DynamicPriceLog
)
from apps.pricing.services import DynamicPricingStrategy, reevaluate_route_fares_dynamically
from apps.flights.services_generation import generate_upcoming_instances
from apps.bookings.services import create_booking

User = get_user_model()


class DynamicPricingEngineTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="adminuser",
            email="admin@example.com",
            password="Password123!",
            first_name="Admin",
            last_name="User",
        )
        self.user = User.objects.create_user(
            username="testuser",
            email="user@example.com",
            password="Password123!",
            first_name="Test",
            last_name="User",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        self.india = Country.objects.create(name="India", iso_code="IN")
        self.germany = Country.objects.create(name="Germany", iso_code="DE")

        self.dep_airport = Airport.objects.create(
            iata_code="DEL", airport_name="Indira Gandhi Intl", city="Delhi", country=self.india
        )
        self.arr_airport = Airport.objects.create(
            iata_code="FRA", airport_name="Frankfurt Airport", city="Frankfurt", country=self.germany
        )
        self.airline = Airline.objects.create(airline_name="Lufthansa", iata_airline_code="LH")
        self.aircraft_model = AircraftModel.objects.create(
            model_name="A350-900", manufacturer="Airbus"
        )
        self.aircraft = Aircraft.objects.create(
            aircraft_model=self.aircraft_model,
            registration="D-AIXA",
            airline=self.airline,
            economy_capacity=100,
            business_capacity=20,
            first_class_capacity=0,
        )

        self.route = FlightRoute.objects.create(
            flight_no="LH760",
            airline=self.airline,
            operates_on_days="1,2,3,4,5,6,7",
            is_active=True,
        )
        self.leg = FlightLeg.objects.create(
            flight=self.route,
            leg_order=1,
            departure_airport=self.dep_airport,
            arrival_airport=self.arr_airport,
            flight_duration_minutes=480,
        )

        self.route_fare_econ = RouteFareClass.objects.create(
            route=self.route,
            cabin_class=CabinClass.ECONOMY,
            fare_code="ECON_STD",
            base_price=Decimal("10000.00"),
            refund_type=RefundType.PARTIAL,
            change_fee=Decimal("1000.00"),
        )

        self.config = DynamicPricingConfig.objects.create(
            name="Global Dynamic Pricing Settings",
            is_active=True,
            weekend_surge_enabled=True,
            weekend_multiplier=Decimal("1.20"),
            demand_surge_enabled=True,
            rolling_window_days=7,
            initial_booking_threshold=50,
            initial_surge_percent=Decimal("10.00"),
            booking_step_size=10,
            step_surge_percent=Decimal("2.00"),
            max_demand_surge_percent=Decimal("50.00"),
        )

    def test_dynamic_pricing_breakdown_weekend(self):
        strategy = DynamicPricingStrategy()
        # Find a Saturday
        today = date.today()
        saturday = today + timedelta(days=(5 - today.weekday()) % 7)
        if saturday.weekday() != 5:  # Saturday
            saturday = saturday + timedelta(days=1)

        breakdown = strategy.calculate_price_breakdown(
            route_fare=self.route_fare_econ,
            flight_date=saturday,
            mock_booking_count=0
        )

        self.assertTrue(breakdown["is_weekend"])
        self.assertEqual(breakdown["weekend_multiplier"], "1.20")

    def test_dynamic_pricing_holiday_multiplier(self):
        # Create a holiday in Germany
        today = date.today()
        HolidayEvent.objects.create(
            name="Oktoberfest",
            applicable_countries=["Germany"],
            start_date=today,
            end_date=today + timedelta(days=10),
            surge_multiplier=Decimal("1.40"),
        )

        strategy = DynamicPricingStrategy()
        breakdown = strategy.calculate_price_breakdown(
            route_fare=self.route_fare_econ,
            flight_date=today,
            mock_booking_count=0
        )

        self.assertEqual(breakdown["holiday_applied"], "Oktoberfest")
        self.assertEqual(breakdown["holiday_multiplier"], "1.40")

    def test_reevaluate_route_fares_dynamically_and_logging(self):
        generate_upcoming_instances(today=date.today(), horizon_days=3)

        updated_count = reevaluate_route_fares_dynamically()
        self.assertGreater(updated_count, 0)

        # Check logs created
        logs = DynamicPriceLog.objects.all()
        self.assertGreater(logs.count(), 0)

    def test_booking_triggers_dynamic_repricing(self):
        generate_upcoming_instances(today=date.today(), horizon_days=3)
        target_date = date.today() + timedelta(days=1)
        instance = FlightInstance.objects.filter(flight=self.route, date=target_date).first()

        passengers_data = [
            {"name": "Jane Doe", "age": 28, "gender": "F", "phone_number": "9876543210"}
        ]

        booking = create_booking(
            flight_id=instance.id,
            user=self.user,
            passengers_data=passengers_data,
            cabin_class=CabinClass.ECONOMY,
        )

        self.assertIsNotNone(booking)
        # Check logs created following booking
        logs = DynamicPriceLog.objects.filter(flight_instance=instance)
        self.assertGreater(logs.count(), 0)

    def test_simulator_api_endpoint(self):
        response = self.client.post(
            "/api/pricing/dynamic-pricing-config/simulate/",
            {
                "route_fare_id": self.route_fare_econ.id,
                "flight_date": str(date.today()),
                "mock_booking_count": 10,
            },
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("final_calculated_price", response.data)
        self.assertIn("base_price", response.data)
