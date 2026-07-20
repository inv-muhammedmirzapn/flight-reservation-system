import threading
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, TestCase
from rest_framework import status
from rest_framework.test import APIClient
from apps.flights.models import Flight, FlightStatus
from apps.bookings.models import Booking, BookingStatus
from django.utils import timezone
from datetime import timedelta
from django.db import connection

User = get_user_model()


class BookingViewSetTests(TestCase):
    """
    Tests for the Booking API.
    Note: BookingViewSet supports list, retrieve and cancel only.
    The Booking model fields are: user, flight, status, created_at, updated_at.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', email='testuser@example.com',
            password='testpassword', first_name='Test', last_name='User'
        )
        self.user2 = User.objects.create_user(
            username='testuser2', email='testuser2@example.com', password='testpassword'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.client2 = APIClient()
        self.client2.force_authenticate(user=self.user2)

        self.flight = Flight.objects.create(
            flight_number='FL123',
            airline='Test Airline',
            aircraft='Boeing 737',
            source_airport='JFK',
            destination_airport='LHR',
            departure_time=timezone.now() + timedelta(days=1),
            arrival_time=timezone.now() + timedelta(days=1, hours=8),
            base_fare=100.00,
            total_seats=10,
            available_seats=10,
            status=FlightStatus.SCHEDULED
        )

        # Manually create a CONFIRMED booking (seat already deducted)
        self.flight.available_seats = 7
        self.flight.save()
        self.booking = Booking.objects.create(
            user=self.user,
            flight=self.flight,
            status=BookingStatus.CONFIRMED
        )

    def test_list_returns_only_own_bookings(self):
        """A user should only see their own bookings."""
        # booking for user2
        Booking.objects.create(user=self.user2, flight=self.flight, status=BookingStatus.CONFIRMED)

        url = reverse('bookings:booking-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], str(self.booking.id))

    def test_retrieve_own_booking(self):
        """A user can retrieve the detail of their own booking."""
        url = reverse('bookings:booking-detail', kwargs={'pk': self.booking.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], str(self.booking.id))

    def test_retrieve_other_users_booking_not_found(self):
        """A user cannot retrieve another user's booking (404, not 403)."""
        url = reverse('bookings:booking-detail', kwargs={'pk': self.booking.pk})
        response = self.client2.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cancel_booking_success(self):
        """Cancelling a booking updates status and restores available seats."""
        initial_seats = self.flight.available_seats

        url = reverse('bookings:booking-cancel', kwargs={'pk': self.booking.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Seat restored (+1)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, initial_seats + 1)

        # Booking status updated
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, BookingStatus.CANCELLED)

    def test_cancel_booking_already_cancelled(self):
        """Cancelling an already-cancelled booking returns 400."""
        self.booking.status = BookingStatus.CANCELLED
        self.booking.save()

        url = reverse('bookings:booking-cancel', kwargs={'pk': self.booking.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancel_other_users_booking_fails(self):
        """A user cannot cancel another user's booking."""
        url = reverse('bookings:booking-cancel', kwargs={'pk': self.booking.pk})
        response = self.client2.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_access_denied(self):
        """Unauthenticated requests are rejected."""
        anon = APIClient()
        url = reverse('bookings:booking-list')
        response = anon.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class BookingConcurrencyTests(TestCase):
    """
    Verifies the cancel_booking service correctly rejects double-cancellation.
    In production (PostgreSQL) SELECT FOR UPDATE prevents race conditions;
    SQLite is used in tests so we exercise the business logic directly.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='concuruser', email='concur@example.com', password='testpassword'
        )
        self.flight = Flight.objects.create(
            flight_number='FL456',
            airline='Test Airline',
            aircraft='Boeing 737',
            source_airport='LAX',
            destination_airport='JFK',
            departure_time=timezone.now() + timedelta(days=1),
            arrival_time=timezone.now() + timedelta(days=1, hours=8),
            base_fare=100.00,
            total_seats=5,
            available_seats=4,
            status=FlightStatus.SCHEDULED
        )
        self.booking = Booking.objects.create(
            user=self.user,
            flight=self.flight,
            status=BookingStatus.CONFIRMED
        )

    def test_double_cancellation_rejected(self):
        """
        Calling cancel_booking twice on the same booking should succeed once
        and raise a ValidationError on the second call.
        """
        from apps.bookings.services import cancel_booking
        from django.core.exceptions import ValidationError

        # First cancel succeeds
        cancel_booking(self.booking.id, self.user)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, BookingStatus.CANCELLED)

        # Second cancel must raise
        with self.assertRaises(ValidationError):
            cancel_booking(self.booking.id, self.user)

    def test_cancel_restores_exactly_one_seat(self):
        """Cancelling a booking increments available_seats by exactly 1."""
        from apps.bookings.services import cancel_booking
        before = self.flight.available_seats
        cancel_booking(self.booking.id, self.user)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, before + 1)
