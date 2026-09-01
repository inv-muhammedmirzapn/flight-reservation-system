"""
Tests for IsPassengerOnly permission class and role separation.
Ensures that Admin/Staff users are blocked from passenger booking, hold, and waitlist endpoints.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.bookings.tests.test_seat_hold import _make_flight_fixture

User = get_user_model()


class RoleSeparationPermissionTests(TestCase):
    """
    Tests that Admin/Staff accounts cannot perform passenger operations
    (Booking creation, Seat Holds, Waitlist join).
    """

    def setUp(self):
        self.fi, self.seat = _make_flight_fixture()
        self.client = APIClient()

        # Regular passenger user
        self.passenger = User.objects.create_user(
            username="passenger_user", email="passenger@test.com", password="password123"
        )

        # Admin user with is_staff=True
        self.admin_user = User.objects.create_user(
            username="admin_user", email="admin@test.com", password="password123", is_staff=True
        )

    def test_admin_cannot_create_booking(self):
        """Admin users sending POST /api/bookings/ should receive 403 Forbidden."""
        self.client.force_authenticate(self.admin_user)
        resp = self.client.post("/api/bookings/", {
            "flight": self.fi.pk,
            "passengers": [{"name": "Admin Guest", "age": 30, "gender": "M"}]
        }, format="json")

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("detail", resp.data)
        self.assertEqual(resp.data["detail"], "Administrators are not permitted to perform passenger operations.")

    def test_admin_cannot_create_seat_hold(self):
        """Admin users sending POST /api/bookings/holds/ should receive 403 Forbidden."""
        self.client.force_authenticate(self.admin_user)
        resp = self.client.post("/api/bookings/holds/", {
            "flight_instance": self.fi.pk,
            "seat_number": "1A",
        }, format="json")

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp.data["detail"], "Administrators are not permitted to perform passenger operations.")

    def test_admin_cannot_join_waitlist(self):
        """Admin users sending POST /api/waitlist/join/ should receive 403 Forbidden."""
        self.client.force_authenticate(self.admin_user)
        resp = self.client.post("/api/waitlist/join/", {
            "flight": self.fi.pk,
            "passengers": [{"name": "Admin Guest", "age": 30, "gender": "M"}]
        }, format="json")

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp.data["detail"], "Administrators are not permitted to perform passenger operations.")

    def test_passenger_can_create_seat_hold(self):
        """Regular passenger users sending POST /api/bookings/holds/ should succeed."""
        self.client.force_authenticate(self.passenger)
        resp = self.client.post("/api/bookings/holds/", {
            "flight_instance": self.fi.pk,
            "seat_number": "1A",
        }, format="json")

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
