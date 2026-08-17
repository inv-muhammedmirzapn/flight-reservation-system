import datetime
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from apps.flights.models import Airline, FlightRoute, FlightInstance, Fare, AircraftModel, Aircraft, Seat
from apps.flights.serializers import FareSerializer
from apps.bookings.serializers import PassengerSerializer
from apps.bookings.services import create_booking
from apps.bookings.models import Passenger

User = get_user_model()


class FareBaggageAllowanceTests(TestCase):
    def setUp(self):
        self.airline = Airline.objects.create(airline_name="Air India", iata_airline_code="AI")
        self.ac_model = AircraftModel.objects.create(manufacturer="Boeing", model_name="737")
        self.aircraft = Aircraft.objects.create(registration="VT-AI1", airline=self.airline, aircraft_model=self.ac_model, economy_capacity=100)
        self.route = FlightRoute.objects.create(
            airline=self.airline,
            flight_no="AI101",
            baggage_weight_allowed_per_person=Decimal("20.00"),
            baggage_number_allowed_per_person=1,
            handbag_weight_allowed_per_person=Decimal("7.00"),
            max_extra_baggage_kg_per_person=Decimal("20.00"),
            extra_baggage_price_per_kg=Decimal("500.00"),
            extra_baggage_currency="INR",
        )
        self.instance = FlightInstance.objects.create(
            flight=self.route,
            date=datetime.date(2026, 10, 1),
            aircraft=self.aircraft,
            scheduled_departure="2026-10-01T10:00:00Z",
            scheduled_arrival="2026-10-01T14:00:00Z",
        )

    def test_fare_effective_allowance_defaults(self):
        """When Fare overrides are None, effective properties return FlightRoute defaults."""
        fare = Fare.objects.create(
            flight_instance=self.instance,
            fare_code="AI_ECO_DEF",
            cabin_class="ECONOMY",
            price=Decimal("5000.00"),
            currency="INR",
        )
        self.assertEqual(fare.effective_baggage_allowance_kg, Decimal("20.00"))
        self.assertEqual(fare.effective_handbag_allowance_kg, Decimal("7.00"))
        self.assertEqual(fare.effective_baggage_pieces, 1)

    def test_fare_effective_allowance_overrides(self):
        """When Fare overrides are set, effective properties return the overridden values."""
        fare = Fare.objects.create(
            flight_instance=self.instance,
            fare_code="AI_BIZ_OVR",
            cabin_class="BUSINESS",
            price=Decimal("15000.00"),
            currency="INR",
            baggage_allowance=Decimal("35.00"),
            handbag_allowance=Decimal("12.00"),
            baggage_pieces_allowance=2,
        )
        self.assertEqual(fare.effective_baggage_allowance_kg, Decimal("35.00"))
        self.assertEqual(fare.effective_handbag_allowance_kg, Decimal("12.00"))
        self.assertEqual(fare.effective_baggage_pieces, 2)

    def test_fare_serializer_effective_fields(self):
        """FareSerializer includes computed effective baggage fields."""
        fare = Fare.objects.create(
            flight_instance=self.instance,
            fare_code="AI_FIRST_OVR",
            cabin_class="FIRST",
            price=Decimal("25000.00"),
            currency="INR",
            baggage_allowance=Decimal("40.00"),
            handbag_allowance=Decimal("14.00"),
            baggage_pieces_allowance=3,
        )
        serializer = FareSerializer(fare)
        data = serializer.data
        self.assertEqual(Decimal(str(data["handbag_allowance"])), Decimal("14.00"))
        self.assertEqual(data["baggage_pieces_allowance"], 3)
        self.assertEqual(Decimal(str(data["effective_baggage_allowance_kg"])), Decimal("40.00"))
        self.assertEqual(Decimal(str(data["effective_handbag_allowance_kg"])), Decimal("14.00"))
        self.assertEqual(data["effective_baggage_pieces"], 3)


class BookingBaggageValidationAndSnapshotTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="baggagetest@example.com", email="baggagetest@example.com", password="Password123!")
        self.airline = Airline.objects.create(airline_name="IndiGo", iata_airline_code="6E")
        self.ac_model = AircraftModel.objects.create(manufacturer="Airbus", model_name="A320")
        self.aircraft = Aircraft.objects.create(registration="VT-6E1", airline=self.airline, aircraft_model=self.ac_model, economy_capacity=180)
        self.route = FlightRoute.objects.create(
            airline=self.airline,
            flight_no="6E505",
            baggage_weight_allowed_per_person=Decimal("15.00"),
            handbag_weight_allowed_per_person=Decimal("7.00"),
            max_extra_baggage_kg_per_person=Decimal("20.00"),
            extra_baggage_price_per_kg=Decimal("600.00"),
            extra_baggage_currency="INR",
        )
        self.instance = FlightInstance.objects.create(
            flight=self.route,
            date=datetime.date(2026, 10, 2),
            aircraft=self.aircraft,
            scheduled_departure="2026-10-02T10:00:00Z",
            scheduled_arrival="2026-10-02T12:00:00Z",
        )
        Seat.objects.create(flight_instance=self.instance, seat_number="1A", seat_class="ECONOMY", status="AVAILABLE")
        Seat.objects.create(flight_instance=self.instance, seat_number="1B", seat_class="BUSINESS", status="AVAILABLE")

        self.economy_fare = Fare.objects.create(
            flight_instance=self.instance,
            fare_code="6E_ECO",
            cabin_class="ECONOMY",
            price=Decimal("4000.00"),
            currency="INR",
        )
        self.business_fare = Fare.objects.create(
            flight_instance=self.instance,
            fare_code="6E_BIZ",
            cabin_class="BUSINESS",
            price=Decimal("12000.00"),
            currency="INR",
            baggage_allowance=Decimal("30.00"),
            handbag_allowance=Decimal("10.00"),
        )

    def test_create_booking_integer_kg_validation(self):
        """Fractional extra baggage (e.g. 2.5 kg) should raise a ValidationError."""
        passengers_data = [
            {
                "name": "Jane Doe",
                "age": 28,
                "gender": "F",
                "extra_baggage_kg": 2.5,
            }
        ]
        with self.assertRaises(ValidationError) as ctx:
            create_booking(
                flight_id=self.instance.id,
                user=self.user,
                passengers_data=passengers_data,
                cabin_class="ECONOMY"
            )
        self.assertIn("whole kg increments", str(ctx.exception))

    def test_passenger_baggage_snapshots(self):
        """Passenger records store snapshots of free checked and handbag allowances."""
        passengers_data = [
            {
                "name": "Alice Smith",
                "age": 35,
                "gender": "F",
                "extra_baggage_kg": 10,
            }
        ]
        booking = create_booking(
            flight_id=self.instance.id,
            user=self.user,
            passengers_data=passengers_data,
            cabin_class="BUSINESS"
        )
        pax = booking.passengers.first()
        # Business fare overrides: checked=30kg, handbag=10kg
        self.assertEqual(pax.free_baggage_allowance_kg, Decimal("30.00"))
        self.assertEqual(pax.free_handbag_allowance_kg, Decimal("10.00"))
        self.assertEqual(pax.extra_baggage_kg, Decimal("10.00"))
        self.assertEqual(pax.extra_baggage_cost, Decimal("6000.00")) # 10 kg * 600 INR

        # Verify serializer exposes these snapshots
        serializer = PassengerSerializer(pax)
        data = serializer.data
        self.assertEqual(data["free_baggage_allowance_kg"], "30.00")
        self.assertEqual(data["free_handbag_allowance_kg"], "10.00")
