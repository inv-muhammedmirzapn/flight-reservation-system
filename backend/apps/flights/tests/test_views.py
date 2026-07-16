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


class FlightBulkImportAPITests(APITestCase):
    """
    Test suite for FlightBulkImportView (POST /api/flights/bulk-import/).
    """

    def setUp(self):
        self.url = "/api/flights/bulk-import/"
        self.departure_time = timezone.now() + timedelta(days=1)
        self.arrival_time = self.departure_time + timedelta(hours=3)

        # Admin User
        self.admin_user = User.objects.create_user(username="admin_user", password="password123")
        profile = self.admin_user.profile
        profile.role = Profile.Role.ADMIN
        profile.save()

        # Regular User
        self.customer_user = User.objects.create_user(username="customer_user", password="password123")

        self.valid_flights = [
            {
                "flight_number": "IM101",
                "airline": "AeroGlass Gold",
                "aircraft": "Boeing 787",
                "source_airport": "MIA",
                "destination_airport": "LAX",
                "departure_time": self.departure_time.isoformat(),
                "arrival_time": self.arrival_time.isoformat(),
                "base_fare": "500.00",
                "total_seats": 200,
                "available_seats": 200,
                "status": "SCHEDULED"
            },
            {
                "flight_number": "IM102",
                "airline": "AeroGlass Premium",
                "aircraft": "Airbus A350",
                "source_airport": "JFK",
                "destination_airport": "DEL",
                "departure_time": self.departure_time.isoformat(),
                "arrival_time": self.arrival_time.isoformat(),
                "base_fare": "750.00",
                "total_seats": 250,
                "available_seats": 250,
                "status": "SCHEDULED"
            }
        ]

    def test_bulk_import_unauthorized_fails(self):
        """Anonymous users get 401; authenticated customer gets 403."""
        # Anonymous — no credentials → 401
        response = self.client.post(self.url, self.valid_flights, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Customer User — authenticated but not admin → 403
        self.client.force_authenticate(user=self.customer_user)
        response = self.client.post(self.url, self.valid_flights, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_bulk_import_success(self):
        """Admin can successfully bulk import multiple valid flights."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(self.url, self.valid_flights, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["created_count"], 2)
        self.assertEqual(len(response.data["errors"]), 0)
        self.assertEqual(Flight.objects.count(), 2)
        self.assertTrue(Flight.objects.filter(flight_number="IM101").exists())
        self.assertTrue(Flight.objects.filter(flight_number="IM102").exists())

    def test_bulk_import_partial_success(self):
        """Invalid records fail but valid ones are still created."""
        self.client.force_authenticate(user=self.admin_user)

        # Flight with identical source and destination airport (invalid)
        invalid_flight = {
            "flight_number": "IM103",
            "airline": "AeroGlass Premium",
            "aircraft": "Airbus A350",
            "source_airport": "JFK",
            "destination_airport": "JFK",
            "departure_time": self.departure_time.isoformat(),
            "arrival_time": self.arrival_time.isoformat(),
            "base_fare": "750.00",
            "total_seats": 250,
            "available_seats": 250,
            "status": "SCHEDULED"
        }

        payload = [self.valid_flights[0], invalid_flight]
        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["created_count"], 1)
        self.assertEqual(len(response.data["errors"]), 1)
        self.assertEqual(response.data["errors"][0]["flight_number"], "IM103")

        # Check that IM101 is created, but IM103 is not
        self.assertTrue(Flight.objects.filter(flight_number="IM101").exists())
        self.assertFalse(Flight.objects.filter(flight_number="IM103").exists())


# ─────────────────────────────────────────────────────────────────────────── #
# GET /api/flights/stats/                                                      #
# ─────────────────────────────────────────────────────────────────────────── #

class FlightStatsViewTests(APITestCase):
    """Test the flight stats aggregation endpoint."""

    def setUp(self):
        self.url = "/api/flights/stats/"
        dep = timezone.now() + timedelta(days=1)
        arr = dep + timedelta(hours=2)
        for i, s in enumerate(["SCHEDULED", "SCHEDULED", "DELAYED", "CANCELLED", "ARRIVED"]):
            Flight.objects.create(
                flight_number=f"ST10{i}",
                airline="TestAir",
                aircraft="A320",
                source_airport="AAA",
                destination_airport="BBB",
                departure_time=dep,
                arrival_time=arr,
                base_fare="200.00",
                total_seats=100,
                available_seats=100,
                status=s,
            )

    def test_stats_public_access(self):
        """GET /api/flights/stats/ returns 200 without authentication."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_stats_keys_present(self):
        """Response contains all expected status keys."""
        response = self.client.get(self.url)
        for key in ("total", "scheduled", "delayed", "cancelled", "boarding", "departed", "arrived"):
            self.assertIn(key, response.data)

    def test_stats_counts_correct(self):
        """Counts match the seeded data exactly."""
        response = self.client.get(self.url)
        data = response.data
        self.assertEqual(data["total"],     5)
        self.assertEqual(data["scheduled"], 2)
        self.assertEqual(data["delayed"],   1)
        self.assertEqual(data["cancelled"], 1)
        self.assertEqual(data["arrived"],   1)
        self.assertEqual(data["boarding"],  0)
        self.assertEqual(data["departed"],  0)


# ─────────────────────────────────────────────────────────────────────────── #
# GET /api/flights/?search=&status=&date=                                      #
# ─────────────────────────────────────────────────────────────────────────── #

class FlightSearchFilterTests(APITestCase):
    """Test search and filter query params on the flight list endpoint."""

    def setUp(self):
        self.url = "/api/flights/"
        dep = timezone.now() + timedelta(days=1)
        arr = dep + timedelta(hours=3)

        self.f1 = make_flight(flight_number="SR001", airline="SkyRide", source_airport="BOM", destination_airport="DEL", departure_time=dep, arrival_time=arr, status="SCHEDULED")
        self.f2 = make_flight(flight_number="SR002", airline="AirIndia", source_airport="COK", destination_airport="BOM", departure_time=dep, arrival_time=arr, status="DELAYED")
        self.f3 = make_flight(flight_number="DL100", airline="Delta", source_airport="JFK", destination_airport="LAX", departure_time=dep, arrival_time=arr, status="CANCELLED")

    def test_search_by_flight_number(self):
        response = self.client.get(self.url, {"search": "SR001"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["flight_number"], "SR001")

    def test_search_by_airline(self):
        response = self.client.get(self.url, {"search": "airindia"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["airline"], "AirIndia")

    def test_search_by_airport(self):
        # "BOM" appears as source in f1 and destination in f2
        response = self.client.get(self.url, {"search": "BOM"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)

    def test_filter_by_status(self):
        response = self.client.get(self.url, {"status": "DELAYED"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["status"], "DELAYED")

    def test_filter_by_status_no_match(self):
        response = self.client.get(self.url, {"status": "BOARDING"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_search_combined_with_status(self):
        """search=SR + status=SCHEDULED should return only SR001."""
        response = self.client.get(self.url, {"search": "SR", "status": "SCHEDULED"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["flight_number"], "SR001")

    def test_no_params_returns_all(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 3)


# ─────────────────────────────────────────────────────────────────────────── #
# POST /api/flights/bulk-import/ — CSV upload                                  #
# ─────────────────────────────────────────────────────────────────────────── #

class FlightBulkImportCsvTests(APITestCase):
    """Test CSV file upload path of FlightBulkImportView."""

    def setUp(self):
        self.url = "/api/flights/bulk-import/"
        dep = timezone.now() + timedelta(days=1)
        arr = dep + timedelta(hours=2)
        self.dep_str = dep.isoformat()
        self.arr_str = arr.isoformat()

        self.admin_user = User.objects.create_user(username="csv_admin", password="pass123")
        self.admin_user.profile.role = Profile.Role.ADMIN
        self.admin_user.profile.save()

    def _make_csv(self, rows):
        """Build a SimpleUploadedFile from a list of dicts."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        import csv, io
        buf = io.StringIO()
        if rows:
            writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        return SimpleUploadedFile("flights.csv", buf.getvalue().encode(), content_type="text/csv")

    def _valid_row(self, flight_number):
        return {
            "flight_number": flight_number,
            "airline": "TestAir",
            "aircraft": "A320",
            "source_airport": "AAA",
            "destination_airport": "BBB",
            "departure_time": self.dep_str,
            "arrival_time": self.arr_str,
            "base_fare": "100.00",
            "total_seats": "50",
            "available_seats": "50",
            "status": "SCHEDULED",
        }

    def test_csv_import_requires_admin(self):
        """Anonymous upload returns 401."""
        f = self._make_csv([self._valid_row("CSV001")])
        response = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_csv_import_happy_path(self):
        """Admin uploading a valid CSV creates the expected flights."""
        self.client.force_authenticate(user=self.admin_user)
        rows = [self._valid_row("CSV001"), self._valid_row("CSV002")]
        f = self._make_csv(rows)
        response = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["created_count"], 2)
        self.assertEqual(len(response.data["errors"]), 0)
        self.assertTrue(Flight.objects.filter(flight_number="CSV001").exists())
        self.assertTrue(Flight.objects.filter(flight_number="CSV002").exists())

    def test_csv_import_partial_errors(self):
        """Duplicate flight_number produces an error row but still imports valid ones."""
        self.client.force_authenticate(user=self.admin_user)
        Flight.objects.create(**{
            "flight_number": "CSV003",
            "airline": "Old", "aircraft": "B737",
            "source_airport": "XXX", "destination_airport": "YYY",
            "departure_time": timezone.now() + timedelta(days=2),
            "arrival_time": timezone.now() + timedelta(days=2, hours=1),
            "base_fare": "50.00", "total_seats": 10, "available_seats": 10,
        })
        rows = [self._valid_row("CSV004"), self._valid_row("CSV003")]  # CSV003 already exists
        f = self._make_csv(rows)
        response = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["created_count"], 1)
        self.assertEqual(len(response.data["errors"]), 1)
        self.assertEqual(response.data["errors"][0]["flight_number"], "CSV003")

    def test_csv_wrong_extension_rejected(self):
        """Uploading a .txt file returns 400."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.admin_user)
        f = SimpleUploadedFile("flights.txt", b"some,data", content_type="text/plain")
        response = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_csv_empty_file_rejected(self):
        """A CSV with headers but no data rows returns 400."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.admin_user)
        # Only header row, no data
        csv_content = "flight_number,airline\n"
        f = SimpleUploadedFile("empty.csv", csv_content.encode(), content_type="text/csv")
        response = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
