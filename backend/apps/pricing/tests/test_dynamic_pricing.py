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

        self.assertEqual(breakdown["weekend_multiplier"], Decimal("1.20"))

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

        self.assertEqual(breakdown["holiday_name"], "Oktoberfest")
        self.assertEqual(breakdown["holiday_multiplier"], Decimal("1.40"))

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

    # ──────────────────────────────────────────────────────────────────────────
    # Proximity + Occupancy Multiplier Tests
    # ──────────────────────────────────────────────────────────────────────────

    def _make_instance_with_seats(self, flight_date, booked_count=0, total_economy=100):
        """Helper: create a FlightInstance with a fixed seat mix."""
        from datetime import datetime, time
        from django.utils import timezone as tz
        from apps.flights.models import Seat, SeatStatus, CabinClass as CC

        dep_dt = tz.make_aware(datetime.combine(flight_date, time(10, 0)))
        arr_dt = tz.make_aware(datetime.combine(flight_date, time(18, 0)))
        inst = FlightInstance.objects.create(
            flight=self.route,
            date=flight_date,
            aircraft=self.aircraft,
            scheduled_departure=dep_dt,
            scheduled_arrival=arr_dt,
        )
        # Create economy seats: some BOOKED, rest AVAILABLE
        for i in range(total_economy):
            status = SeatStatus.BOOKED if i < booked_count else SeatStatus.AVAILABLE
            Seat.objects.create(
                flight_instance=inst,
                seat_number=f"{i+1}A",
                seat_class=CC.ECONOMY,
                status=status,
            )
        return inst

    def test_proximity_outside_window_no_effect(self):
        """Outside the proximity window, occupancy has ZERO effect on price."""
        # Set window to 3 days; flight is 10 days away
        self.config.proximity_pricing_enabled = True
        self.config.proximity_window_days = 3
        self.config.occupancy_threshold_percent = Decimal("60.00")
        self.config.max_proximity_premium_percent = Decimal("30.00")
        self.config.max_proximity_discount_percent = Decimal("20.00")
        self.config.weekend_surge_enabled = False
        self.config.demand_surge_enabled = False
        self.config.save()

        flight_date = date.today() + timedelta(days=10)
        # 90% occupancy — would trigger a premium if inside the window
        inst = self._make_instance_with_seats(flight_date, booked_count=90)

        strategy = DynamicPricingStrategy(config=self.config)
        breakdown = strategy.calculate_price_breakdown(
            route_fare=self.route_fare_econ,
            flight_date=flight_date,
            flight_instance=inst,
        )

        self.assertEqual(breakdown["proximity_multiplier"], Decimal("1.0000"))
        self.assertEqual(breakdown["final_price"], self.route_fare_econ.base_price)

    def test_proximity_high_occupancy_applies_premium(self):
        """Inside the window, high occupancy (>= threshold) increases price."""
        self.config.proximity_pricing_enabled = True
        self.config.proximity_window_days = 3
        self.config.occupancy_threshold_percent = Decimal("60.00")
        self.config.max_proximity_premium_percent = Decimal("30.00")
        self.config.max_proximity_discount_percent = Decimal("20.00")
        self.config.weekend_surge_enabled = False
        self.config.demand_surge_enabled = False
        self.config.save()

        flight_date = date.today() + timedelta(days=1)  # 1 day out — inside window
        inst = self._make_instance_with_seats(flight_date, booked_count=80)  # 80% > 60%

        strategy = DynamicPricingStrategy(config=self.config)
        breakdown = strategy.calculate_price_breakdown(
            route_fare=self.route_fare_econ,
            flight_date=flight_date,
            flight_instance=inst,
        )

        self.assertGreater(breakdown["proximity_multiplier"], Decimal("1.0000"),
                           "High occupancy inside window should produce a premium (mult > 1)")
        self.assertGreater(breakdown["final_price"], self.route_fare_econ.base_price)

    def test_proximity_low_occupancy_applies_discount(self):
        """Inside the window, low occupancy (< threshold) decreases price."""
        self.config.proximity_pricing_enabled = True
        self.config.proximity_window_days = 3
        self.config.occupancy_threshold_percent = Decimal("60.00")
        self.config.max_proximity_premium_percent = Decimal("30.00")
        self.config.max_proximity_discount_percent = Decimal("20.00")
        self.config.weekend_surge_enabled = False
        self.config.demand_surge_enabled = False
        self.config.save()

        flight_date = date.today() + timedelta(days=1)
        inst = self._make_instance_with_seats(flight_date, booked_count=20)  # 20% < 60%

        strategy = DynamicPricingStrategy(config=self.config)
        breakdown = strategy.calculate_price_breakdown(
            route_fare=self.route_fare_econ,
            flight_date=flight_date,
            flight_instance=inst,
        )

        self.assertLess(breakdown["proximity_multiplier"], Decimal("1.0000"),
                        "Low occupancy inside window should produce a discount (mult < 1)")
        self.assertLess(breakdown["final_price"], self.route_fare_econ.base_price)

    def test_proximity_magnitude_scales_linearly(self):
        """Magnitude at day 0 > magnitude at day 2 for the same occupancy."""
        self.config.proximity_pricing_enabled = True
        self.config.proximity_window_days = 3
        self.config.occupancy_threshold_percent = Decimal("60.00")
        self.config.max_proximity_premium_percent = Decimal("30.00")
        self.config.weekend_surge_enabled = False
        self.config.demand_surge_enabled = False
        self.config.save()

        # Day 0 (departure today — edge case)
        flight_date_0 = date.today()
        inst_0 = self._make_instance_with_seats(flight_date_0, booked_count=80)

        # Day 2 (2 days out — closer to window edge)
        flight_date_2 = date.today() + timedelta(days=2)
        inst_2 = self._make_instance_with_seats(flight_date_2, booked_count=80)

        strategy = DynamicPricingStrategy(config=self.config)
        breakdown_0 = strategy.calculate_price_breakdown(
            self.route_fare_econ, flight_date_0, flight_instance=inst_0
        )
        breakdown_2 = strategy.calculate_price_breakdown(
            self.route_fare_econ, flight_date_2, flight_instance=inst_2
        )

        self.assertGreater(
            breakdown_0["proximity_multiplier"],
            breakdown_2["proximity_multiplier"],
            "Day-0 premium should be larger than day-2 premium for same occupancy",
        )

    def test_combined_multiplier_respects_ceiling_clamp(self):
        """Weekend + holiday + demand surge + high proximity premium is capped at ceiling."""
        self.config.proximity_pricing_enabled = True
        self.config.proximity_window_days = 3
        self.config.occupancy_threshold_percent = Decimal("10.00")  # almost always premium
        self.config.max_proximity_premium_percent = Decimal("50.00")
        self.config.weekend_surge_enabled = True
        self.config.weekend_multiplier = Decimal("1.30")
        self.config.demand_surge_enabled = False
        self.config.price_ceiling_percent = Decimal("150.00")
        self.config.price_floor_percent = Decimal("80.00")
        self.config.save()

        # Saturday — triggers weekend surge
        today = date.today()
        saturday = today + timedelta(days=(5 - today.weekday()) % 7 or 7)

        # Add holiday so holiday mult also fires
        HolidayEvent.objects.create(
            name="Test Holiday", is_global=True,
            start_date=saturday, end_date=saturday,
            surge_multiplier=Decimal("1.30"),
        )

        inst = self._make_instance_with_seats(saturday, booked_count=90)  # high occupancy

        strategy = DynamicPricingStrategy(config=self.config)
        breakdown = strategy.calculate_price_breakdown(
            route_fare=self.route_fare_econ,
            flight_date=saturday,
            flight_instance=inst,
        )

        max_allowed = self.route_fare_econ.base_price * Decimal("1.50")
        self.assertLessEqual(
            breakdown["final_price"], max_allowed,
            f"Final price {breakdown['final_price']} exceeded ceiling {max_allowed}",
        )

    def test_dynamic_price_log_records_proximity_fields(self):
        """DynamicPriceLog entries include occupancy_percent, days_until_departure, proximity_multiplier."""
        self.config.proximity_pricing_enabled = True
        self.config.proximity_window_days = 5
        self.config.weekend_surge_enabled = False
        self.config.demand_surge_enabled = False
        self.config.save()

        # Use generate_upcoming_instances to create instances with seats/fares
        generate_upcoming_instances(today=date.today(), horizon_days=2)

        reevaluate_route_fares_dynamically()

        log = DynamicPriceLog.objects.first()
        self.assertIsNotNone(log)
        self.assertIsNotNone(log.occupancy_percent)
        self.assertIsNotNone(log.days_until_departure)
        self.assertIsNotNone(log.proximity_multiplier)

    def test_booked_ticket_price_unaffected_by_repricing(self):
        """Ticket snapshot price is immutable; repricing only changes Fare.price."""
        from apps.bookings.models import Ticket

        generate_upcoming_instances(today=date.today(), horizon_days=3)
        target_date = date.today() + timedelta(days=1)
        instance = FlightInstance.objects.filter(flight=self.route, date=target_date).first()
        self.assertIsNotNone(instance)

        booking = create_booking(
            flight_id=instance.id,
            user=self.user,
            passengers_data=[{"name": "Jane Doe", "age": 28, "gender": "F", "phone_number": "9876543210"}],
            cabin_class=CabinClass.ECONOMY,
        )
        tickets = Ticket.objects.filter(booking=booking)
        self.assertTrue(tickets.exists())
        snapshot_prices = {t.id: t.price_paid for t in tickets}

        # Run repricing — this should update Fare.price but NOT Ticket.price_paid
        self.config.proximity_pricing_enabled = True
        self.config.proximity_window_days = 5
        self.config.max_proximity_premium_percent = Decimal("30.00")
        self.config.save()
        reevaluate_route_fares_dynamically(route_id=instance.flight_id)

        for ticket in Ticket.objects.filter(booking=booking):
            self.assertEqual(
                ticket.price_paid, snapshot_prices[ticket.id],
                "Ticket snapshot price must not change after repricing",
            )

