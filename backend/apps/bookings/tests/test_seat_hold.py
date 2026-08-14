"""
Tests for the SeatHold system (lazy expiry implementation).

Covers:
  - expire_stale_holds()  — lazy cleanup logic
  - hold_seat()           — creating a hold
  - release_hold()        — explicit early release
  - SeatHoldViewSet       — POST /api/bookings/holds/ and DELETE /api/bookings/holds/{id}/
  - Lazy expiry in SeatViewSet.list() — seat map cleans up before returning seats
  - Lazy expiry in create_booking()   — booking attempt cleans up first
"""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APIClient

from apps.flights.models import (
    Airline, AircraftModel, Aircraft, Airport, Country,
    FlightRoute, FlightLeg, FlightInstance, InstanceStatus,
    Fare, Seat, SeatStatus, CabinClass,
)
from apps.bookings.models import Booking, BookingStatus, SeatHold, SEAT_HOLD_MINUTES
from apps.bookings.services import expire_stale_holds, hold_seat, release_hold

User = get_user_model()


# ─── Shared fixture helper ────────────────────────────────────────────────────

def _make_flight_fixture(departure_offset_days=3):
    """
    Creates and returns a minimal but fully valid FlightInstance with one ECONOMY seat.
    Returns (flight_instance, seat).
    """
    country = Country.objects.create(name="India", iso_code="IN")
    airline = Airline.objects.create(
        iata_airline_code="TA", airline_name="TestAir"
    )
    ac_model = AircraftModel.objects.create(
        manufacturer="Boeing", model_name="737"
    )
    aircraft = Aircraft.objects.create(
        registration="VT-TEST",
        airline=airline,
        aircraft_model=ac_model,
        economy_capacity=30,
        economy_layout="3-3",
    )
    src = Airport.objects.create(
        iata_code="SRC", airport_name="Source Airport", city="Src", country=country
    )
    dst = Airport.objects.create(
        iata_code="DST", airport_name="Dest Airport", city="Dst", country=country
    )
    route = FlightRoute.objects.create(flight_no="TA001", airline=airline)
    FlightLeg.objects.create(
        flight=route, leg_order=1,
        departure_airport=src, arrival_airport=dst,
        flight_duration_minutes=120,
    )
    dep = timezone.now() + timedelta(days=departure_offset_days)
    arr = dep + timedelta(hours=2)
    fi = FlightInstance.objects.create(
        flight=route, date=dep.date(), aircraft=aircraft,
        scheduled_departure=dep, scheduled_arrival=arr,
        status=InstanceStatus.SCHEDULED,
    )
    Fare.objects.create(
        flight_instance=fi, fare_code="ECO", cabin_class=CabinClass.ECONOMY,
        price=5000, available_seats=30,
    )
    seat = Seat.objects.create(
        flight_instance=fi, seat_number="1A",
        seat_class=CabinClass.ECONOMY, status=SeatStatus.AVAILABLE,
    )
    return fi, seat


# ─── Service layer tests ──────────────────────────────────────────────────────

class ExpireStaleHoldsTests(TestCase):
    """Unit tests for expire_stale_holds()."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="t@t.com", password="pass"
        )
        self.fi, self.seat = _make_flight_fixture()

    def test_expired_hold_is_deleted_and_seat_freed(self):
        """A hold whose expires_at is in the past is deleted and seat becomes AVAILABLE."""
        hold = SeatHold.objects.create(
            seat=self.seat, flight_instance=self.fi, user=self.user,
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        self.seat.status = SeatStatus.HELD
        self.seat.save()

        expire_stale_holds(self.fi)

        self.assertFalse(SeatHold.objects.filter(pk=hold.pk).exists())
        self.seat.refresh_from_db()
        self.assertEqual(self.seat.status, SeatStatus.AVAILABLE)

    def test_active_hold_is_not_touched(self):
        """A hold that has not yet expired must remain intact."""
        hold = SeatHold.objects.create(
            seat=self.seat, flight_instance=self.fi, user=self.user,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        self.seat.status = SeatStatus.HELD
        self.seat.save()

        expire_stale_holds(self.fi)

        self.assertTrue(SeatHold.objects.filter(pk=hold.pk).exists())
        self.seat.refresh_from_db()
        self.assertEqual(self.seat.status, SeatStatus.HELD)

    def test_no_holds_does_nothing(self):
        """Calling expire_stale_holds on a flight with no holds is a safe no-op."""
        expire_stale_holds(self.fi)   # should not raise
        self.seat.refresh_from_db()
        self.assertEqual(self.seat.status, SeatStatus.AVAILABLE)


class HoldSeatTests(TestCase):
    """Unit tests for hold_seat()."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="holder", email="h@h.com", password="pass"
        )
        self.other = User.objects.create_user(
            username="other", email="o@o.com", password="pass"
        )
        self.fi, self.seat = _make_flight_fixture()

    def test_hold_creates_seat_hold_and_marks_seat_held(self):
        hold = hold_seat(self.fi, "1A", self.user)

        self.assertIsNotNone(hold.pk)
        self.assertEqual(hold.user, self.user)
        self.seat.refresh_from_db()
        self.assertEqual(self.seat.status, SeatStatus.HELD)

    def test_hold_expires_at_is_10_minutes_from_now(self):
        hold = hold_seat(self.fi, "1A", self.user)

        expected = timezone.now() + timedelta(minutes=SEAT_HOLD_MINUTES)
        diff = abs((hold.expires_at - expected).total_seconds())
        self.assertLess(diff, 5)  # within 5 seconds of now+10min

    def test_hold_on_already_held_seat_by_different_user_raises(self):
        """Another user cannot hold a seat that is already actively held."""
        SeatHold.objects.create(
            seat=self.seat, flight_instance=self.fi, user=self.other,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        self.seat.status = SeatStatus.HELD
        self.seat.save()

        with self.assertRaises(ValidationError):
            hold_seat(self.fi, "1A", self.user)

    def test_hold_on_expired_held_seat_succeeds(self):
        """
        If another user's hold is expired (lazy), the current user should be able
        to hold the seat — expire_stale_holds runs inside hold_seat.
        """
        SeatHold.objects.create(
            seat=self.seat, flight_instance=self.fi, user=self.other,
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        self.seat.status = SeatStatus.HELD
        self.seat.save()

        hold = hold_seat(self.fi, "1A", self.user)

        self.assertIsNotNone(hold.pk)
        self.assertEqual(hold.user, self.user)

    def test_hold_on_booked_seat_raises(self):
        self.seat.status = SeatStatus.BOOKED
        self.seat.save()

        with self.assertRaises(ValidationError):
            hold_seat(self.fi, "1A", self.user)

    def test_hold_on_nonexistent_seat_raises(self):
        with self.assertRaises(ValidationError):
            hold_seat(self.fi, "99Z", self.user)

    def test_same_user_holding_seat_returns_existing_hold(self):
        """If the same user already holds the seat, return the existing hold (idempotent)."""
        first = hold_seat(self.fi, "1A", self.user)
        second = hold_seat(self.fi, "1A", self.user)

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(SeatHold.objects.filter(user=self.user, flight_instance=self.fi).count(), 1)

    def test_switching_seats_releases_old_hold(self):
        """
        When a user explicitly switches a seat for a passenger, passing old_seat_number
        releases the old hold and creates the new hold.
        """
        seat2 = Seat.objects.create(
            flight_instance=self.fi, seat_number="1B",
            seat_class=CabinClass.ECONOMY, status=SeatStatus.AVAILABLE,
        )
        hold_seat(self.fi, "1A", self.user)  # hold 1A
        hold_seat(self.fi, "1B", self.user, old_seat_number="1A")  # switch to 1B

        self.assertEqual(
            SeatHold.objects.filter(user=self.user, flight_instance=self.fi).count(), 1
        )
        active_hold = SeatHold.objects.get(user=self.user, flight_instance=self.fi)
        self.assertEqual(active_hold.seat.seat_number, "1B")

        self.seat.refresh_from_db()
        self.assertEqual(self.seat.status, SeatStatus.AVAILABLE)

    def test_holding_multiple_seats_for_multi_passenger_booking(self):
        """
        A single user account can hold multiple seats for a multi-passenger booking.
        """
        seat2 = Seat.objects.create(
            flight_instance=self.fi, seat_number="1B",
            seat_class=CabinClass.ECONOMY, status=SeatStatus.AVAILABLE,
        )
        hold1 = hold_seat(self.fi, "1A", self.user)
        hold2 = hold_seat(self.fi, "1B", self.user)

        self.assertIsNotNone(hold1.pk)
        self.assertIsNotNone(hold2.pk)
        self.assertEqual(
            SeatHold.objects.filter(user=self.user, flight_instance=self.fi).count(), 2
        )


class ReleaseHoldTests(TestCase):
    """Unit tests for release_hold()."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="releaser", email="r@r.com", password="pass"
        )
        self.other = User.objects.create_user(
            username="other2", email="o2@o.com", password="pass"
        )
        self.fi, self.seat = _make_flight_fixture()

    def _create_active_hold(self):
        self.seat.status = SeatStatus.HELD
        self.seat.save()
        return SeatHold.objects.create(
            seat=self.seat, flight_instance=self.fi, user=self.user,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

    def test_release_frees_seat_and_deletes_hold(self):
        hold = self._create_active_hold()

        release_hold(str(hold.pk), self.user)

        self.assertFalse(SeatHold.objects.filter(pk=hold.pk).exists())
        self.seat.refresh_from_db()
        self.assertEqual(self.seat.status, SeatStatus.AVAILABLE)

    def test_release_by_wrong_user_raises(self):
        hold = self._create_active_hold()

        with self.assertRaises(ValidationError):
            release_hold(str(hold.pk), self.other)

        # Hold must still exist
        self.assertTrue(SeatHold.objects.filter(pk=hold.pk).exists())

    def test_release_nonexistent_hold_raises(self):
        import uuid
        with self.assertRaises(ValidationError):
            release_hold(str(uuid.uuid4()), self.user)


# ─── API view tests ───────────────────────────────────────────────────────────

class SeatHoldAPITests(TestCase):
    """
    Integration tests for:
      POST   /api/bookings/holds/       — create a hold
      DELETE /api/bookings/holds/{id}/  — release a hold
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="api_user", email="api@t.com", password="pass"
        )
        self.other = User.objects.create_user(
            username="api_other", email="other@t.com", password="pass"
        )
        self.fi, self.seat = _make_flight_fixture()
        self.client = APIClient()

    def _hold_url(self):
        return "/api/bookings/holds/"

    def _release_url(self, hold_id):
        return f"/api/bookings/holds/{hold_id}/"

    # ── POST tests ────────────────────────────────────────────────────────────

    def test_create_hold_success(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post(self._hold_url(), {
            "flight_instance": self.fi.pk,
            "seat_number": "1A",
        }, format="json")

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("id", resp.data)
        self.assertIn("seconds_remaining", resp.data)
        self.assertAlmostEqual(resp.data["seconds_remaining"], SEAT_HOLD_MINUTES * 60, delta=5)
        self.seat.refresh_from_db()
        self.assertEqual(self.seat.status, SeatStatus.HELD)

    def test_create_hold_unauthenticated_returns_401(self):
        resp = self.client.post(self._hold_url(), {
            "flight_instance": self.fi.pk,
            "seat_number": "1A",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_hold_missing_seat_number_returns_400(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post(self._hold_url(), {
            "flight_instance": self.fi.pk,
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_hold_missing_flight_instance_returns_400(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post(self._hold_url(), {
            "seat_number": "1A",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_hold_nonexistent_seat_returns_400(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post(self._hold_url(), {
            "flight_instance": self.fi.pk,
            "seat_number": "99Z",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_hold_on_already_held_seat_returns_400(self):
        """Second user cannot hold a seat that is actively held by another user."""
        self.seat.status = SeatStatus.HELD
        self.seat.save()
        SeatHold.objects.create(
            seat=self.seat, flight_instance=self.fi, user=self.other,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        self.client.force_authenticate(self.user)
        resp = self.client.post(self._hold_url(), {
            "flight_instance": self.fi.pk,
            "seat_number": "1A",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_hold_on_expired_hold_succeeds(self):
        """If the existing hold is expired, lazy expiry kicks in and a new hold is created."""
        self.seat.status = SeatStatus.HELD
        self.seat.save()
        SeatHold.objects.create(
            seat=self.seat, flight_instance=self.fi, user=self.other,
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        self.client.force_authenticate(self.user)
        resp = self.client.post(self._hold_url(), {
            "flight_instance": self.fi.pk,
            "seat_number": "1A",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    # ── DELETE tests ──────────────────────────────────────────────────────────

    def test_release_hold_success(self):
        self.client.force_authenticate(self.user)
        hold = hold_seat(self.fi, "1A", self.user)

        resp = self.client.delete(self._release_url(hold.pk))

        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(SeatHold.objects.filter(pk=hold.pk).exists())
        self.seat.refresh_from_db()
        self.assertEqual(self.seat.status, SeatStatus.AVAILABLE)

    def test_release_hold_by_wrong_user_returns_400(self):
        hold = hold_seat(self.fi, "1A", self.user)

        self.client.force_authenticate(self.other)
        resp = self.client.delete(self._release_url(hold.pk))

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(SeatHold.objects.filter(pk=hold.pk).exists())

    def test_release_hold_unauthenticated_returns_401(self):
        hold = hold_seat(self.fi, "1A", self.user)
        resp = self.client.delete(self._release_url(hold.pk))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ─── Integration: lazy expiry in seat map fetch ───────────────────────────────

class SeatMapLazyExpiryTests(TestCase):
    """
    Tests that GET /api/flights/v2/seats/?flight_instance=<id>
    runs lazy expiry before returning the list, so stale holds
    are cleaned up and the seat appears AVAILABLE to callers.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="mapuser", email="map@t.com", password="pass"
        )
        self.fi, self.seat = _make_flight_fixture()
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_expired_held_seat_appears_available_in_seat_map(self):
        """
        A seat that is HELD but whose SeatHold has expired should be returned
        as AVAILABLE after the lazy expiry runs during the seat map fetch.
        """
        self.seat.status = SeatStatus.HELD
        self.seat.save()
        SeatHold.objects.create(
            seat=self.seat, flight_instance=self.fi, user=self.user,
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        resp = self.client.get(f"/api/flights/v2/seats/?flight_instance={self.fi.pk}")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        seats = resp.data if isinstance(resp.data, list) else resp.data.get("results", resp.data)
        target = next((s for s in seats if s["seat_number"] == "1A"), None)
        self.assertIsNotNone(target)
        self.assertEqual(target["status"], SeatStatus.AVAILABLE)

    def test_active_held_seat_appears_held_in_seat_map(self):
        """Active (non-expired) holds must still show as HELD."""
        self.seat.status = SeatStatus.HELD
        self.seat.save()
        SeatHold.objects.create(
            seat=self.seat, flight_instance=self.fi, user=self.user,
            expires_at=timezone.now() + timedelta(minutes=8),
        )

        resp = self.client.get(f"/api/flights/v2/seats/?flight_instance={self.fi.pk}")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        seats = resp.data if isinstance(resp.data, list) else resp.data.get("results", resp.data)
        target = next((s for s in seats if s["seat_number"] == "1A"), None)
        self.assertIsNotNone(target)
        self.assertEqual(target["status"], SeatStatus.HELD)


# ─── Integration: lazy expiry in create_booking ───────────────────────────────

class BookingWithHoldLazyExpiryTests(TestCase):
    """
    Tests that create_booking() runs lazy expiry before checking seat availability,
    so a booking can proceed even if the seat was previously held (and hold expired).
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="booker", email="book@t.com", password="pass"
        )
        self.other = User.objects.create_user(
            username="other3", email="o3@t.com", password="pass"
        )
        self.fi, self.seat = _make_flight_fixture()
        self.passengers = [{"name": "Jane Doe", "age": 28, "gender": "F"}]

    def test_booking_succeeds_after_stale_hold_is_lazily_expired(self):
        """
        Seat is HELD (by other user with expired hold). create_booking should
        clean up the stale hold and book the seat successfully.
        """
        self.seat.status = SeatStatus.HELD
        self.seat.save()
        SeatHold.objects.create(
            seat=self.seat, flight_instance=self.fi, user=self.other,
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        from apps.bookings.services import create_booking
        with patch("apps.notifications.services.NotificationService.send_booking_confirmation"):
            booking = create_booking(self.fi.pk, self.user, self.passengers, cabin_class="ECONOMY")

        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        self.seat.refresh_from_db()
        self.assertEqual(self.seat.status, SeatStatus.BOOKED)
        self.assertFalse(SeatHold.objects.filter(flight_instance=self.fi).exists())

    def test_booking_fails_when_seat_is_actively_held_by_another_user(self):
        """
        If another user's hold is still active, booking should fail with a validation error.
        """
        self.seat.status = SeatStatus.HELD
        self.seat.save()
        SeatHold.objects.create(
            seat=self.seat, flight_instance=self.fi, user=self.other,
            expires_at=timezone.now() + timedelta(minutes=8),
        )

        from apps.bookings.services import create_booking
        with self.assertRaises(ValidationError):
            create_booking(self.fi.pk, self.user, self.passengers, cabin_class="ECONOMY")

    def test_booking_succeeds_when_seat_is_actively_held_by_same_user(self):
        """
        If the current user has an active hold on the seat, booking should succeed
        and the SeatHold record should be cleaned up upon booking.
        """
        hold = hold_seat(self.fi, "1A", self.user)
        self.seat.refresh_from_db()
        self.assertEqual(self.seat.status, SeatStatus.HELD)

        passengers_with_seat = [{"name": "Jane Doe", "age": 28, "gender": "F", "seat_number": "1A"}]

        from apps.bookings.services import create_booking
        with patch("apps.notifications.services.NotificationService.send_booking_confirmation"):
            booking = create_booking(self.fi.pk, self.user, passengers_with_seat, cabin_class="ECONOMY")

        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        self.seat.refresh_from_db()
        self.assertEqual(self.seat.status, SeatStatus.BOOKED)
        # SeatHold must be deleted
        self.assertFalse(SeatHold.objects.filter(pk=hold.pk).exists())
