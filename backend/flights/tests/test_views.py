from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import uuid
from flights.models import Flight

class FlightAPITests(APITestCase):
    """
    Test suite for Create Flight (POST) and Update Flight (PUT) APIs.
    """

    def setUp(self):
        self.departure_time = timezone.now() + timedelta(days=1)
        self.arrival_time = self.departure_time + timedelta(hours=3)
        self.valid_payload = {
            "flight_number": "FL999",
            "airline": "SpaceX Airline",
            "aircraft": "Starship v2",
            "source_airport": "MIA",
            "destination_airport": "LAX",
            "departure_time": self.departure_time.isoformat(),
            "arrival_time": self.arrival_time.isoformat(),
            "base_fare": "500.00",
            "total_seats": 200,
            "available_seats": 200,
            "status": "SCHEDULED"
        }

    def test_create_flight_success(self):
        """Test POST /flights/ with valid data creates a new flight."""
        response = self.client.post("/flights/", self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Flight.objects.count(), 1)
        flight = Flight.objects.first()
        self.assertEqual(flight.flight_number, "FL999")
        self.assertEqual(flight.airline, "SpaceX Airline")
        self.assertEqual(flight.source_airport, "MIA")
        self.assertEqual(flight.base_fare, Decimal("500.00"))

    def test_create_flight_duplicate_number_fails(self):
        """Test POST /flights/ with duplicate flight number fails."""
        # Create initial flight in setup/db
        Flight.objects.create(
            flight_number="FL999",
            airline="SpaceX Airline",
            aircraft="Starship v2",
            source_airport="MIA",
            destination_airport="LAX",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("500.00"),
            total_seats=200,
            available_seats=200,
            status="SCHEDULED"
        )
        response = self.client.post("/flights/", self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("flight_number", response.data)

    def test_create_flight_invalid_times_fails(self):
        """Test POST /flights/ where arrival_time is earlier than departure_time fails."""
        payload = self.valid_payload.copy()
        payload["flight_number"] = "FL998"
        payload["arrival_time"] = (self.departure_time - timedelta(hours=2)).isoformat()
        response = self.client.post("/flights/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_create_flight_same_airports_fails(self):
        """Test POST /flights/ where source and destination are the same fails."""
        payload = self.valid_payload.copy()
        payload["flight_number"] = "FL998"
        payload["destination_airport"] = "MIA"
        response = self.client.post("/flights/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_create_flight_invalid_seats_fails(self):
        """Test POST /flights/ where available_seats > total_seats fails."""
        payload = self.valid_payload.copy()
        payload["flight_number"] = "FL998"
        payload["available_seats"] = 250  # total is 200
        response = self.client.post("/flights/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_create_flight_negative_fare_fails(self):
        """Test POST /flights/ with negative fare fails."""
        payload = self.valid_payload.copy()
        payload["flight_number"] = "FL998"
        payload["base_fare"] = "-50.00"
        response = self.client.post("/flights/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("base_fare", response.data)

    def test_update_flight_success(self):
        """Test PUT /flights/{id}/ with valid data updates the flight."""
        flight = Flight.objects.create(
            flight_number="FL999",
            airline="SpaceX Airline",
            aircraft="Starship v2",
            source_airport="MIA",
            destination_airport="LAX",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("500.00"),
            total_seats=200,
            available_seats=200,
            status="SCHEDULED"
        )
        update_payload = {
            "flight_number": "FL999",
            "airline": "SpaceX Airline Modified",
            "aircraft": "Starship v3",
            "source_airport": "MIA",
            "destination_airport": "LAX",
            "departure_time": self.departure_time.isoformat(),
            "arrival_time": self.arrival_time.isoformat(),
            "base_fare": "650.00",
            "total_seats": 220,
            "available_seats": 210,
            "status": "DELAYED"
        }
        url = f"/flights/{flight.id}/"
        response = self.client.put(url, update_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        flight.refresh_from_db()
        self.assertEqual(flight.airline, "SpaceX Airline Modified")
        self.assertEqual(flight.aircraft, "Starship v3")
        self.assertEqual(flight.base_fare, Decimal("650.00"))
        self.assertEqual(flight.total_seats, 220)
        self.assertEqual(flight.available_seats, 210)
        self.assertEqual(flight.status, "DELAYED")

    def test_update_flight_invalid_payload_fails(self):
        """Test PUT /flights/{id}/ with invalid data fails."""
        flight = Flight.objects.create(
            flight_number="FL999",
            airline="SpaceX Airline",
            aircraft="Starship v2",
            source_airport="MIA",
            destination_airport="LAX",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("500.00"),
            total_seats=200,
            available_seats=200,
            status="SCHEDULED"
        )
        update_payload = {
            "flight_number": "FL999",
            "airline": "SpaceX Airline Modified",
            "aircraft": "Starship v3",
            "source_airport": "MIA",
            "destination_airport": "LAX",
            "departure_time": self.departure_time.isoformat(),
            "arrival_time": self.arrival_time.isoformat(),
            "base_fare": "650.00",
            "total_seats": 200,
            "available_seats": 210,  # invalid (exceeds total_seats)
            "status": "DELAYED"
        }
        url = f"/flights/{flight.id}/"
        response = self.client.put(url, update_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_update_non_existent_flight_fails(self):
        """Test PUT /flights/{id}/ for non-existent UUID returns 404."""
        non_existent_uuid = uuid.uuid4()
        url = f"/flights/{non_existent_uuid}/"
        response = self.client.put(url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
