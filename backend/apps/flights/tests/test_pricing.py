from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model

from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, Seat, Fare,
    CabinClass, RefundType, RouteFareClass, FarePriceChangeLog
)
from apps.flights.services_pricing import FlatPricingStrategy, generate_fares_for_instance, update_route_fare_price
from apps.flights.services_generation import generate_upcoming_instances
from apps.bookings.services import create_booking
from apps.bookings.models import Ticket, BookingStatus

User = get_user_model()


class FlightPricingArchitectureTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="testuser@example.com",
            password="Password123!",
            first_name="Test",
            last_name="User",
        )
        self.country = Country.objects.create(name="India", iso_code="IN")
        self.dep_airport = Airport.objects.create(
            iata_code="DEL", airport_name="Indira Gandhi International", city="Delhi", country=self.country
        )
        self.arr_airport = Airport.objects.create(
            iata_code="BOM", airport_name="Chhatrapati Shivaji Maharaj", city="Mumbai", country=self.country
        )
        self.airline = Airline.objects.create(airline_name="Air India", iata_airline_code="AI")
        self.aircraft_model = AircraftModel.objects.create(
            model_name="A320neo", manufacturer="Airbus"
        )
        self.aircraft = Aircraft.objects.create(
            aircraft_model=self.aircraft_model,
            registration="VT-EXA",
            airline=self.airline,
            economy_capacity=10,
            business_capacity=2,
            first_class_capacity=0,
        )

        self.route = FlightRoute.objects.create(
            flight_no="AI101",
            airline=self.airline,
            operates_on_days="1,2,3,4,5,6,7",
            is_active=True,
        )
        self.leg = FlightLeg.objects.create(
            flight=self.route,
            leg_order=1,
            departure_airport=self.dep_airport,
            arrival_airport=self.arr_airport,
            flight_duration_minutes=120,
        )

        self.route_fare_econ = RouteFareClass.objects.create(
            route=self.route,
            cabin_class=CabinClass.ECONOMY,
            fare_code="ECON_STD",
            base_price=Decimal("5000.00"),
            refund_type=RefundType.PARTIAL,
            change_fee=Decimal("500.00"),
        )

    def test_rolling_instance_generation(self):
        result = generate_upcoming_instances(today=date.today(), horizon_days=7)
        self.assertEqual(result["created_instances_count"], 8)
        self.assertGreater(result["created_seats_count"], 0)
        self.assertGreater(result["created_fares_count"], 0)

        # Check instance date
        instance = FlightInstance.objects.filter(flight=self.route, date=date.today()).first()
        self.assertIsNotNone(instance)
        fare = Fare.objects.filter(flight_instance=instance, fare_code="ECON_STD").first()
        self.assertIsNotNone(fare)
        self.assertEqual(fare.price, Decimal("5000.00"))

    def test_route_fare_update_repricing_and_audit_log(self):
        generate_upcoming_instances(today=date.today(), horizon_days=3)
        future_fares = Fare.objects.filter(flight_instance__flight=self.route, fare_code="ECON_STD")
        self.assertTrue(future_fares.exists())

        # Reprice base price to 6500.00
        updated_count = update_route_fare_price(
            route_fare=self.route_fare_econ,
            new_base_price=Decimal("6500.00"),
            changed_by=self.user,
        )

        self.assertGreater(updated_count, 0)
        self.route_fare_econ.refresh_from_db()
        self.assertEqual(self.route_fare_econ.base_price, Decimal("6500.00"))

        # Verify instance fares updated
        updated_fare = Fare.objects.filter(flight_instance__flight=self.route, fare_code="ECON_STD").first()
        self.assertEqual(updated_fare.price, Decimal("6500.00"))

        # Verify audit log recorded
        logs = FarePriceChangeLog.objects.filter(fare=updated_fare)
        self.assertTrue(logs.exists())
        log = logs.first()
        self.assertEqual(log.old_price, Decimal("5000.00"))
        self.assertEqual(log.new_price, Decimal("6500.00"))
        self.assertEqual(log.changed_by, self.user)

    def test_booking_ticket_price_snapshotting(self):
        generate_upcoming_instances(today=date.today(), horizon_days=3)
        target_date = date.today() + timedelta(days=1)
        instance = FlightInstance.objects.filter(flight=self.route, date=target_date).first()

        passengers_data = [
            {"name": "John Doe", "age": 30, "gender": "M", "phone_number": "1234567890"}
        ]

        booking = create_booking(
            flight_id=instance.id,
            user=self.user,
            passengers_data=passengers_data,
            cabin_class=CabinClass.ECONOMY,
        )

        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        tickets = Ticket.objects.filter(booking=booking)
        self.assertEqual(tickets.count(), 1)

        ticket = tickets.first()
        self.assertEqual(ticket.price_paid, Decimal("5000.00"))
        self.assertEqual(ticket.fare_code, "ECON_STD")
        self.assertEqual(ticket.cabin_class, CabinClass.ECONOMY)

        # Reprice base price to 8000.00 afterwards
        update_route_fare_price(
            route_fare=self.route_fare_econ,
            new_base_price=Decimal("8000.00"),
            changed_by=self.user,
        )

        # Confirm Ticket snapshot retains the original price paid (5000.00)
        ticket.refresh_from_db()
        self.assertEqual(ticket.price_paid, Decimal("5000.00"))
