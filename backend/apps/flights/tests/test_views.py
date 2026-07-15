from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import uuid
from django.contrib.auth.models import User
from apps.users.models import Profile
from apps.flights.models import Flight

class FlightAPITests(APITestCase):
    """
    Test suite for Create Flight (POST), Update Flight (PUT/PATCH), 
    List Flights (GET), and Retrieve Flight (GET) APIs.
    """

    def setUp(self):
        self.base_url = "/api/flights/"
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
        """Test POST /api/flights/ with valid data creates a new flight."""
        response = self.client.post("/api/flights/", self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Flight.objects.count(), 1)
        flight = Flight.objects.first()
        self.assertEqual(flight.flight_number, "FL999")
        self.assertEqual(flight.airline, "SpaceX Airline")
        self.assertEqual(flight.source_airport, "MIA")
        self.assertEqual(flight.base_fare, Decimal("500.00"))

    def test_create_flight_duplicate_number_fails(self):
        """Test POST /api/flights/ with duplicate flight number fails."""
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
        response = self.client.post("/api/flights/", self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("flight_number", response.data)

    def test_create_flight_invalid_times_fails(self):
        """Test POST /api/flights/ where arrival_time is earlier than departure_time fails."""
        payload = self.valid_payload.copy()
        payload["flight_number"] = "FL998"
        payload["arrival_time"] = (self.departure_time - timedelta(hours=2)).isoformat()
        response = self.client.post("/api/flights/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_create_flight_same_airports_fails(self):
        """Test POST /api/flights/ where source and destination are the same fails."""
        payload = self.valid_payload.copy()
        payload["flight_number"] = "FL998"
        payload["destination_airport"] = "MIA"
        response = self.client.post("/api/flights/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_create_flight_invalid_seats_fails(self):
        """Test POST /api/flights/ where available_seats > total_seats fails."""
        payload = self.valid_payload.copy()
        payload["flight_number"] = "FL998"
        payload["available_seats"] = 250  # total is 200
        response = self.client.post("/api/flights/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_create_flight_negative_fare_fails(self):
        """Test POST /api/flights/ with negative fare fails."""
        payload = self.valid_payload.copy()
        payload["flight_number"] = "FL998"
        payload["base_fare"] = "-50.00"
        response = self.client.post("/api/flights/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("base_fare", response.data)

    def test_update_flight_success(self):
        """Test PUT /api/flights/{id}/update/ with valid data updates the flight."""
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
        url = f"/api/flights/{flight.id}/update/"
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
        """Test PUT /api/flights/{id}/update/ with invalid data fails."""
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
        url = f"/api/flights/{flight.id}/update/"
        response = self.client.put(url, update_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_update_non_existent_flight_fails(self):
        """Test PUT /api/flights/{id}/update/ for non-existent UUID returns 404."""
        non_existent_uuid = uuid.uuid4()
        url = f"/api/flights/{non_existent_uuid}/update/"
        response = self.client.put(url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_flight_success(self):
        """Test PATCH /api/flights/{id}/update/ with valid partial data."""
        flight = Flight.objects.create(
            flight_number="FL888",
            airline="Delta",
            aircraft="A320",
            source_airport="ATL",
            destination_airport="JFK",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("150.00"),
            total_seats=100,
            available_seats=100,
            status="SCHEDULED"
        )
        url = f"/api/flights/{flight.id}/update/"
        
        # 1. Update only status
        patch_payload_1 = {"status": "DELAYED"}
        response = self.client.patch(url, patch_payload_1, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        flight.refresh_from_db()
        self.assertEqual(flight.status, "DELAYED")
        self.assertEqual(flight.airline, "Delta")  # remains unchanged
        
        # 2. Update only base_fare
        patch_payload_2 = {"base_fare": "180.00"}
        response = self.client.patch(url, patch_payload_2, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        flight.refresh_from_db()
        self.assertEqual(flight.base_fare, Decimal("180.00"))

    def test_patch_flight_invalid_available_seats_fails(self):
        """Test PATCH /api/flights/{id}/update/ fails when available_seats exceeds total_seats."""
        flight = Flight.objects.create(
            flight_number="FL888",
            airline="Delta",
            aircraft="A320",
            source_airport="ATL",
            destination_airport="JFK",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("150.00"),
            total_seats=100,
            available_seats=100,
            status="SCHEDULED"
        )
        url = f"/api/flights/{flight.id}/update/"
        patch_payload = {"available_seats": 120}  # total_seats is 100
        response = self.client.patch(url, patch_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_patch_flight_negative_fare_fails(self):
        """Test PATCH /api/flights/{id}/update/ fails when base_fare is negative."""
        flight = Flight.objects.create(
            flight_number="FL888",
            airline="Delta",
            aircraft="A320",
            source_airport="ATL",
            destination_airport="JFK",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("150.00"),
            total_seats=100,
            available_seats=100,
            status="SCHEDULED"
        )
        url = f"/api/flights/{flight.id}/update/"
        patch_payload = {"base_fare": "-10.00"}
        response = self.client.patch(url, patch_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("base_fare", response.data)

    def test_patch_non_existent_flight_fails(self):
        """Test PATCH /api/flights/{id}/update/ for non-existent UUID returns 404."""
        non_existent_uuid = uuid.uuid4()
        url = f"/api/flights/{non_existent_uuid}/update/"
        response = self.client.patch(url, {"status": "DELAYED"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_flights_success(self):
        """Test GET /api/flights/ returns all flights."""
        Flight.objects.create(
            flight_number="FL111",
            airline="Airline 1",
            aircraft="Aircraft 1",
            source_airport="JFK",
            destination_airport="LAX",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("100.00"),
            total_seats=100,
            available_seats=100,
            status="SCHEDULED"
        )
        Flight.objects.create(
            flight_number="FL222",
            airline="Airline 2",
            aircraft="Aircraft 2",
            source_airport="ORD",
            destination_airport="SFO",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("200.00"),
            total_seats=150,
            available_seats=120,
            status="SCHEDULED"
        )
        response = self.client.get("/api/flights/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        results = response.data["results"]
        self.assertEqual(len(results), 2)
        flight_numbers = [item["flight_number"] for item in results]
        self.assertIn("FL111", flight_numbers)
        self.assertIn("FL222", flight_numbers)

    def test_get_flight_detail_success(self):
        """Test GET /api/flights/{id}/ returns correct flight details."""
        flight = Flight.objects.create(
            flight_number="FL111",
            airline="Airline 1",
            aircraft="Aircraft 1",
            source_airport="JFK",
            destination_airport="LAX",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("100.00"),
            total_seats=100,
            available_seats=100,
            status="SCHEDULED"
        )
        url = f"/api/flights/{flight.id}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["flight_number"], "FL111")
        self.assertEqual(response.data["airline"], "Airline 1")

    def test_get_flight_detail_not_found(self):
        """Test GET /api/flights/{id}/ for non-existent flight returns 404."""
        non_existent_uuid = uuid.uuid4()
        url = f"/api/flights/{non_existent_uuid}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_flight_anonymous_fails(self):
        """Test DELETE /api/flights/{id}/ without authentication fails with 403."""
        flight = Flight.objects.create(
            flight_number="FL777",
            airline="Test Airline",
            aircraft="A350",
            source_airport="JFK",
            destination_airport="LAX",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("100.00"),
            total_seats=100,
            available_seats=100,
            status="SCHEDULED"
        )
        url = f"/api/flights/{flight.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Flight.objects.filter(id=flight.id).exists())

    def test_delete_flight_customer_fails(self):
        """Test DELETE /api/flights/{id}/ with non-admin customer account fails with 403."""
        flight = Flight.objects.create(
            flight_number="FL777",
            airline="Test Airline",
            aircraft="A350",
            source_airport="JFK",
            destination_airport="LAX",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("100.00"),
            total_seats=100,
            available_seats=100,
            status="SCHEDULED"
        )
        user = User.objects.create_user(username="customer_user", password="password123")
        self.client.force_authenticate(user=user)
        url = f"/api/flights/{flight.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Flight.objects.filter(id=flight.id).exists())

    def test_delete_flight_admin_success(self):
        """Test DELETE /api/flights/{id}/ with admin account deletes the flight successfully."""
        flight = Flight.objects.create(
            flight_number="FL777",
            airline="Test Airline",
            aircraft="A350",
            source_airport="JFK",
            destination_airport="LAX",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("100.00"),
            total_seats=100,
            available_seats=100,
            status="SCHEDULED"
        )
        user = User.objects.create_user(username="admin_user", password="password123")
        profile = user.profile
        profile.role = Profile.Role.ADMIN
        profile.save()
        
        self.client.force_authenticate(user=user)
        url = f"/api/flights/{flight.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Flight.objects.filter(id=flight.id).exists())

    def test_delete_flight_superuser_success(self):
        """Test DELETE /api/flights/{id}/ with superuser account deletes the flight successfully."""
        flight = Flight.objects.create(
            flight_number="FL777",
            airline="Test Airline",
            aircraft="A350",
            source_airport="JFK",
            destination_airport="LAX",
            departure_time=self.departure_time,
            arrival_time=self.arrival_time,
            base_fare=Decimal("100.00"),
            total_seats=100,
            available_seats=100,
            status="SCHEDULED"
        )
        user = User.objects.create_superuser(username="super_user", password="password123")
        
        self.client.force_authenticate(user=user)
        url = f"/api/flights/{flight.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Flight.objects.filter(id=flight.id).exists())
