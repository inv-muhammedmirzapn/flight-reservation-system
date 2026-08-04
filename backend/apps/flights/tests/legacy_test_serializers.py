from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from apps.flights.serializers import FlightSerializer
from apps.flights.models import Flight

class FlightSerializerTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.valid_data = {
            "flight_number": "AG-101",
            "airline": "Passenger",
            "aircraft": "Boeing 737",
            "source_airport": "COK",
            "destination_airport": "DEL",
            "departure_time": self.now + timedelta(days=1),
            "arrival_time": self.now + timedelta(days=1, hours=2),
            "base_fare": Decimal("5000.00"),
            "total_seats": 150,
            "available_seats": 150,
            "status": "SCHEDULED",
        }

    def test_valid_flight_data(self):
        serializer = FlightSerializer(data=self.valid_data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['flight_number'], "AG-101")

    def test_same_source_and_destination(self):
        data = self.valid_data.copy()
        data["destination_airport"] = "COK"
        serializer = FlightSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)
        self.assertEqual(
            serializer.errors["non_field_errors"][0],
            "Source and destination airports cannot be identical."
        )

    def test_arrival_before_departure(self):
        data = self.valid_data.copy()
        data["arrival_time"] = self.now
        serializer = FlightSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)
        self.assertEqual(
            serializer.errors["non_field_errors"][0],
            "Arrival time must be later than departure time."
        )

    def test_negative_total_seats(self):
        data = self.valid_data.copy()
        data["total_seats"] = -5
        serializer = FlightSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("total_seats", serializer.errors)
        self.assertEqual(serializer.errors["total_seats"][0], "Total seats cannot be negative.")

    def test_negative_available_seats(self):
        data = self.valid_data.copy()
        data["available_seats"] = -1
        serializer = FlightSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("available_seats", serializer.errors)
        self.assertEqual(serializer.errors["available_seats"][0], "Available seats cannot be negative.")

    def test_available_seats_exceeds_total(self):
        data = self.valid_data.copy()
        data["total_seats"] = 100
        data["available_seats"] = 101
        serializer = FlightSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)
        self.assertEqual(
            serializer.errors["non_field_errors"][0],
            "Available seats cannot exceed total seats."
        )

    def test_negative_base_fare(self):
        data = self.valid_data.copy()
        data["base_fare"] = Decimal("-10.00")
        serializer = FlightSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("base_fare", serializer.errors)
        self.assertEqual(serializer.errors["base_fare"][0], "Base fare cannot be negative.")

    def test_invalid_base_fare_type(self):
        data = self.valid_data.copy()
        data["base_fare"] = "invalid_number"
        serializer = FlightSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("base_fare", serializer.errors)
        # DRF DecimalField will already catch "A valid number is required." before custom validate runs,
        # but let's just assert it is invalid
        self.assertTrue(len(serializer.errors["base_fare"]) > 0)
