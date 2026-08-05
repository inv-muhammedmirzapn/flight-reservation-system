from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from apps.flights.models import Flight

class FlightModelTest(TestCase):
    """
    Test suite for Flight model validations and database integrity constraints.
    """

    def setUp(self):
        self.departure_time = timezone.now() + timedelta(days=1)
        self.arrival_time = self.departure_time + timedelta(hours=3)
        self.valid_flight_data = {
            "flight_number": "FL123",
            "airline": "Test Airlines",
            "aircraft": "Boeing 737",
            "source_airport": "JFK",
            "destination_airport": "LAX",
            "departure_time": self.departure_time,
            "arrival_time": self.arrival_time,
            "base_fare": Decimal("250.00"),
            "total_seats": 150,
            "available_seats": 150,
            "status": "SCHEDULED"
        }

    def test_create_valid_flight(self):
        """Test creating a flight with valid details."""
        flight = Flight.objects.create(**self.valid_flight_data)
        flight.full_clean()  # Should not raise any validation error
        self.assertEqual(flight.flight_number, "FL123")
        self.assertEqual(flight.available_seats, 150)
        self.assertEqual(flight.status, "SCHEDULED")

    def test_flight_number_must_be_unique(self):
        """Test that duplicate flight numbers are not allowed."""
        Flight.objects.create(**self.valid_flight_data)
        duplicate_flight = Flight(**self.valid_flight_data)
        with self.assertRaises((ValidationError, Exception)):
            # Both model validation and DB unique constraint should fail
            duplicate_flight.full_clean()
            duplicate_flight.save()

    def test_arrival_time_cannot_be_earlier_than_departure(self):
        """Test that arrival time must be later than departure time."""
        invalid_data = self.valid_flight_data.copy()
        # Set arrival time equal to departure time
        invalid_data["arrival_time"] = self.departure_time
        invalid_data["flight_number"] = "FL124"
        flight = Flight(**invalid_data)
        with self.assertRaises(ValidationError):
            flight.full_clean()

        # Set arrival time earlier than departure time
        invalid_data["arrival_time"] = self.departure_time - timedelta(hours=1)
        flight = Flight(**invalid_data)
        with self.assertRaises(ValidationError):
            flight.full_clean()

    def test_source_and_destination_cannot_be_identical(self):
        """Test that source and destination airports must be different."""
        invalid_data = self.valid_flight_data.copy()
        invalid_data["destination_airport"] = "JFK"
        invalid_data["flight_number"] = "FL124"
        flight = Flight(**invalid_data)
        with self.assertRaises(ValidationError):
            flight.full_clean()

    def test_available_seats_cannot_exceed_total_seats(self):
        """Test that available seats cannot be more than total seats."""
        invalid_data = self.valid_flight_data.copy()
        invalid_data["available_seats"] = 151
        invalid_data["flight_number"] = "FL124"
        flight = Flight(**invalid_data)
        with self.assertRaises(ValidationError):
            flight.full_clean()

    def test_base_fare_cannot_be_negative(self):
        """Test that base fare must be non-negative."""
        invalid_data = self.valid_flight_data.copy()
        invalid_data["base_fare"] = Decimal("-10.00")
        invalid_data["flight_number"] = "FL124"
        flight = Flight(**invalid_data)
        with self.assertRaises(ValidationError):
            flight.full_clean()

    def test_seats_cannot_be_negative(self):
        """Test that total_seats and available_seats must be non-negative."""
        invalid_data = self.valid_flight_data.copy()
        invalid_data["total_seats"] = -10
        invalid_data["flight_number"] = "FL124"
        flight = Flight(**invalid_data)
        with self.assertRaises(ValidationError):
            flight.full_clean()

        invalid_data_2 = self.valid_flight_data.copy()
        invalid_data_2["available_seats"] = -5
        invalid_data_2["flight_number"] = "FL125"
        flight_2 = Flight(**invalid_data_2)
        with self.assertRaises(ValidationError):
            flight_2.full_clean()

    def test_external_sync_fields(self):
        """Test that synchronization fields are properly stored and optional."""
        sync_data = self.valid_flight_data.copy()
        sync_data["external_id"] = "AMADEUS-998877"
        sync_data["sync_source"] = "amadeus"
        flight = Flight.objects.create(**sync_data)
        flight.full_clean()
        self.assertEqual(flight.external_id, "AMADEUS-998877")
        self.assertEqual(flight.sync_source, "amadeus")
