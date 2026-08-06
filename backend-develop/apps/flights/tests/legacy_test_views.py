from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import uuid
from django.contrib.auth.models import User
from apps.users.models import Profile
from apps.flights.models import Flight


def make_flight(**kwargs):
    """Helper to build a Flight with sensible defaults."""
    departure_time = timezone.now() + timedelta(days=1)
    arrival_time = departure_time + timedelta(hours=3)
    defaults = dict(
        flight_number="FL999",
        airline="SpaceX Airline",
        aircraft="Starship v2",
        source_airport="MIA",
        destination_airport="LAX",
        departure_time=departure_time,
        arrival_time=arrival_time,
        base_fare=Decimal("500.00"),
        total_seats=200,
        available_seats=200,
        status="SCHEDULED",
    )
    defaults.update(kwargs)
    return Flight.objects.create(**defaults)


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

        # Admin user
        self.admin_user = User.objects.create_user(
            username="admin_user", password="password123"
        )
        self.admin_user.profile.role = Profile.Role.ADMIN
        self.admin_user.profile.save()

        # Regular customer
        self.customer_user = User.objects.create_user(
            username="customer_user", password="password123"
        )

        # Superuser
        self.super_user = User.objects.create_superuser(
            username="super_user", password="password123"
        )

    # ------------------------------------------------------------------ #
    # POST /api/flights/ — create                                         #
    # ------------------------------------------------------------------ #

    def test_create_flight_anonymous_fails(self):
        """POST /api/flights/ without auth returns 401."""
        response = self.client.post("/api/flights/", self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_flight_customer_fails(self):
        """POST /api/flights/ with customer role returns 403."""
        self.client.force_authenticate(user=self.customer_user)
        response = self.client.post("/api/flights/", self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_flight_admin_success(self):
        """POST /api/flights/ with admin creates the flight."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post("/api/flights/", self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Flight.objects.count(), 1)
        flight = Flight.objects.first()
        self.assertEqual(flight.flight_number, "FL999")
        self.assertEqual(flight.airline, "SpaceX Airline")
        self.assertEqual(flight.source_airport, "MIA")
        self.assertEqual(flight.base_fare, Decimal("500.00"))

    def test_create_flight_superuser_success(self):
        """POST /api/flights/ with superuser creates the flight."""
        self.client.force_authenticate(user=self.super_user)
        response = self.client.post("/api/flights/", self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_flight_duplicate_number_fails(self):
        """POST /api/flights/ with duplicate flight number fails."""
        self.client.force_authenticate(user=self.admin_user)
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
        """POST /api/flights/ where arrival_time < departure_time fails."""
        self.client.force_authenticate(user=self.admin_user)
        payload = self.valid_payload.copy()
        payload["flight_number"] = "FL998"
        payload["arrival_time"] = (self.departure_time - timedelta(hours=2)).isoformat()
        response = self.client.post("/api/flights/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_create_flight_same_airports_fails(self):
        """POST /api/flights/ where source and destination are the same fails."""
        self.client.force_authenticate(user=self.admin_user)
        payload = self.valid_payload.copy()
        payload["flight_number"] = "FL998"
        payload["destination_airport"] = "MIA"
        response = self.client.post("/api/flights/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_create_flight_invalid_seats_fails(self):
        """POST /api/flights/ where available_seats > total_seats fails."""
        self.client.force_authenticate(user=self.admin_user)
        payload = self.valid_payload.copy()
        payload["flight_number"] = "FL998"
        payload["available_seats"] = 250  # total is 200
        response = self.client.post("/api/flights/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_create_flight_negative_fare_fails(self):
        """POST /api/flights/ with negative fare fails."""
        self.client.force_authenticate(user=self.admin_user)
        payload = self.valid_payload.copy()
        payload["flight_number"] = "FL998"
        payload["base_fare"] = "-50.00"
        response = self.client.post("/api/flights/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("base_fare", response.data)

    # ------------------------------------------------------------------ #
    # PUT /api/flights/<id>/update/                                       #
    # ------------------------------------------------------------------ #

    def _make_update_payload(self):
        return {
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

    def test_update_flight_anonymous_fails(self):
        """PUT /api/flights/<id>/update/ without auth returns 401."""
        flight = make_flight(departure_time=self.departure_time, arrival_time=self.arrival_time)
        url = f"/api/flights/{flight.id}/update/"
        response = self.client.put(url, self._make_update_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_flight_customer_fails(self):
        """PUT /api/flights/<id>/update/ with customer role returns 403."""
        flight = make_flight(departure_time=self.departure_time, arrival_time=self.arrival_time)
        self.client.force_authenticate(user=self.customer_user)
        url = f"/api/flights/{flight.id}/update/"
        response = self.client.put(url, self._make_update_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_flight_success(self):
        """PUT /api/flights/<id>/update/ with admin updates the flight."""
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
        self.client.force_authenticate(user=self.admin_user)
        url = f"/api/flights/{flight.id}/update/"
        response = self.client.put(url, self._make_update_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        flight.refresh_from_db()
        self.assertEqual(flight.airline, "SpaceX Airline Modified")
        self.assertEqual(flight.aircraft, "Starship v3")
        self.assertEqual(flight.base_fare, Decimal("650.00"))
        self.assertEqual(flight.total_seats, 220)
        self.assertEqual(flight.available_seats, 210)
        self.assertEqual(flight.status, "DELAYED")

    def test_update_flight_invalid_payload_fails(self):
        """PUT /api/flights/<id>/update/ with invalid data fails."""
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
        self.client.force_authenticate(user=self.admin_user)
        update_payload = self._make_update_payload()
        update_payload["available_seats"] = 210  # total_seats is 200 — invalid
        update_payload["total_seats"] = 200
        url = f"/api/flights/{flight.id}/update/"
        response = self.client.put(url, update_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_update_non_existent_flight_fails(self):
        """PUT /api/flights/<id>/update/ for non-existent UUID returns 404."""
        self.client.force_authenticate(user=self.admin_user)
        non_existent_uuid = uuid.uuid4()
        url = f"/api/flights/{non_existent_uuid}/update/"
        response = self.client.put(url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------------ #
    # PATCH /api/flights/<id>/update/                                     #
    # ------------------------------------------------------------------ #

    def test_patch_flight_anonymous_fails(self):
        """PATCH /api/flights/<id>/update/ without auth returns 401."""
        flight = make_flight(departure_time=self.departure_time, arrival_time=self.arrival_time)
        url = f"/api/flights/{flight.id}/update/"
        response = self.client.patch(url, {"status": "DELAYED"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patch_flight_customer_fails(self):
        """PATCH /api/flights/<id>/update/ with customer role returns 403."""
        flight = make_flight(departure_time=self.departure_time, arrival_time=self.arrival_time)
        self.client.force_authenticate(user=self.customer_user)
        url = f"/api/flights/{flight.id}/update/"
        response = self.client.patch(url, {"status": "DELAYED"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_flight_success(self):
        """PATCH /api/flights/<id>/update/ with admin succeeds."""
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
        self.client.force_authenticate(user=self.admin_user)
        url = f"/api/flights/{flight.id}/update/"

        # 1. Update only status
        response = self.client.patch(url, {"status": "DELAYED"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        flight.refresh_from_db()
        self.assertEqual(flight.status, "DELAYED")
        self.assertEqual(flight.airline, "Delta")  # remains unchanged

        # 2. Update only base_fare
        response = self.client.patch(url, {"base_fare": "180.00"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        flight.refresh_from_db()
        self.assertEqual(flight.base_fare, Decimal("180.00"))

    def test_patch_flight_invalid_available_seats_fails(self):
        """PATCH fails when available_seats exceeds total_seats."""
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
        self.client.force_authenticate(user=self.admin_user)
        url = f"/api/flights/{flight.id}/update/"
        response = self.client.patch(url, {"available_seats": 120}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_patch_flight_negative_fare_fails(self):
        """PATCH fails when base_fare is negative."""
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
        self.client.force_authenticate(user=self.admin_user)
        url = f"/api/flights/{flight.id}/update/"
        response = self.client.patch(url, {"base_fare": "-10.00"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("base_fare", response.data)

    def test_patch_non_existent_flight_fails(self):
        """PATCH for non-existent UUID returns 404."""
        self.client.force_authenticate(user=self.admin_user)
        non_existent_uuid = uuid.uuid4()
        url = f"/api/flights/{non_existent_uuid}/update/"
        response = self.client.patch(url, {"status": "DELAYED"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_flight_allocates_waitlist_seats(self):
        """PUT /api/flights/<id>/update/ that increases available_seats triggers waitlist allocation."""
        # 1. Create a flight with 0 available seats
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
            available_seats=0,
            status="SCHEDULED"
        )
        
        # 2. Add customer to waitlist for 2 seats
        from apps.waitlist.models import WaitlistEntry, WaitlistStatus
        from apps.bookings.models import Booking, BookingStatus
        
        waitlist_entry = WaitlistEntry.objects.create(
            user=self.customer_user,
            flight=flight,
            seat_count=2,
            price=Decimal("1000.00"),
            status=WaitlistStatus.PENDING
        )
        
        # 3. Authenticate admin and update available_seats to 2
        self.client.force_authenticate(user=self.admin_user)
        payload = self._make_update_payload()
        payload["available_seats"] = 2
        payload["total_seats"] = 200
        
        url = f"/api/flights/{flight.id}/update/"
        response = self.client.put(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 4. Verify waitlist entry is CONFIRMED and booking is created
        waitlist_entry.refresh_from_db()
        self.assertEqual(waitlist_entry.status, WaitlistStatus.CONFIRMED)
        self.assertIsNotNone(waitlist_entry.booking)
        self.assertEqual(waitlist_entry.booking.user, self.customer_user)
        self.assertEqual(waitlist_entry.booking.seat_count, 2)
        self.assertEqual(waitlist_entry.booking.status, BookingStatus.CONFIRMED)
        
        # 5. Flight available seats should be 0 (since the 2 seats were immediately allocated)
        flight.refresh_from_db()
        self.assertEqual(flight.available_seats, 0)
        
        # 6. Check response data matches actual state (should serialize final available_seats = 0)
        self.assertEqual(response.data["available_seats"], 0)

    # ------------------------------------------------------------------ #
    # GET /api/flights/ — list (public)                                   #
    # ------------------------------------------------------------------ #

    def test_list_flights_anonymous_success(self):
        """GET /api/flights/ is public — unauthenticated requests succeed."""
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

    # ------------------------------------------------------------------ #
    # GET /api/flights/<id>/ — detail (public)                            #
    # ------------------------------------------------------------------ #

    def test_get_flight_detail_anonymous_success(self):
        """GET /api/flights/<id>/ is public — unauthenticated requests succeed."""
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
        """GET /api/flights/<id>/ for non-existent flight returns 404."""
        non_existent_uuid = uuid.uuid4()
        url = f"/api/flights/{non_existent_uuid}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------------ #
    # DELETE /api/flights/<id>/                                           #
    # ------------------------------------------------------------------ #

    def test_delete_flight_anonymous_fails(self):
        """DELETE without authentication returns 401."""
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
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(Flight.objects.filter(id=flight.id).exists())

    def test_delete_flight_customer_fails(self):
        """DELETE with customer role returns 403."""
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
        self.client.force_authenticate(user=self.customer_user)
        url = f"/api/flights/{flight.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Flight.objects.filter(id=flight.id).exists())

    def test_delete_flight_admin_success(self):
        """DELETE with admin role deletes the flight successfully."""
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
        self.client.force_authenticate(user=self.admin_user)
        url = f"/api/flights/{flight.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Flight.objects.filter(id=flight.id).exists())

    def test_delete_flight_superuser_success(self):
        """DELETE with superuser deletes the flight successfully."""
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
        self.client.force_authenticate(user=self.super_user)
        url = f"/api/flights/{flight.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Flight.objects.filter(id=flight.id).exists())


