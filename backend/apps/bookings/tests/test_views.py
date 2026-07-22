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
    BookingViewSet supports create, list, retrieve and cancel.
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

    def test_list_returns_latest_booking_first(self):
        """Bookings should be returned in descending order of creation."""
        # Create a newer booking for the same user
        flight2 = Flight.objects.create(
            flight_number='FL456',
            airline='Test Airline',
            aircraft='Boeing 737',
            source_airport='LAX',
            destination_airport='SFO',
            departure_time=timezone.now() + timedelta(days=2),
            arrival_time=timezone.now() + timedelta(days=2, hours=2),
            base_fare=150.00,
            total_seats=10,
            available_seats=10,
            status=FlightStatus.SCHEDULED
        )
        
        booking_new = Booking.objects.create(
            user=self.user,
            flight=flight2,
            status=BookingStatus.CONFIRMED
        )
        booking_new.created_at = timezone.now() + timedelta(seconds=10)
        booking_new.save()

        self.booking.created_at = timezone.now()
        self.booking.save()

        url = reverse('bookings:booking-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        
        # Newest should be first
        self.assertEqual(response.data[0]['id'], str(booking_new.id))
        self.assertEqual(response.data[1]['id'], str(self.booking.id))

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


class CreateBookingViewTests(TestCase):
    """
    Tests for POST /api/bookings/ (create booking endpoint).
    Covers: successful creation, no seats available, duplicate booking,
    missing flight field, and unauthenticated access.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='booker', email='booker@example.com', password='testpassword'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.flight = Flight.objects.create(
            flight_number='FL999',
            airline='Test Airline',
            aircraft='Airbus A320',
            source_airport='DEL',
            destination_airport='BOM',
            departure_time=timezone.now() + timedelta(days=2),
            arrival_time=timezone.now() + timedelta(days=2, hours=2),
            base_fare=3500.00,
            total_seats=100,
            available_seats=50,
            status=FlightStatus.SCHEDULED
        )

    def _book_url(self):
        return reverse('bookings:booking-list')

    def test_create_booking_success(self):
        """A POST to /bookings/ with a valid flight id and passengers creates a CONFIRMED booking."""
        payload = {
            'flight': str(self.flight.id),
            'passengers': [{'name': 'John', 'age': 30, 'gender': 'M'}]
        }
        response = self.client.post(self._book_url(), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'CONFIRMED')
        self.assertIn('flight_detail', response.data)
        self.assertEqual(response.data['flight_detail']['id'], str(self.flight.id))

        # Seat count decremented
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 49)

    def test_create_booking_creates_db_record(self):
        """Booking object is actually persisted in the database."""
        payload = {
            'flight': str(self.flight.id),
            'passengers': [{'name': 'John', 'age': 30, 'gender': 'M'}]
        }
        self.client.post(self._book_url(), payload, format='json')
        self.assertTrue(
            Booking.objects.filter(user=self.user, flight=self.flight, status=BookingStatus.CONFIRMED).exists()
        )

    def test_create_booking_no_seats_available(self):
        """Returns 400 when the flight has no available seats."""
        self.flight.available_seats = 0
        self.flight.save()

        payload = {
            'flight': str(self.flight.id),
            'passengers': [{'name': 'John', 'age': 30, 'gender': 'M'}]
        }
        response = self.client.post(self._book_url(), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_booking_duplicate_confirmed(self):
        """Returns 400 when user already has a confirmed booking for the same flight."""
        Booking.objects.create(user=self.user, flight=self.flight, status=BookingStatus.CONFIRMED)

        # Manually deduct to simulate real state
        self.flight.available_seats -= 1
        self.flight.save()

        payload = {
            'flight': str(self.flight.id),
            'passengers': [{'name': 'John', 'age': 30, 'gender': 'M'}]
        }
        response = self.client.post(self._book_url(), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_booking_after_cancel_allowed(self):
        """User can re-book after cancelling their existing booking on the same flight."""
        # Create and cancel a booking
        Booking.objects.create(user=self.user, flight=self.flight, status=BookingStatus.CANCELLED)

        # Re-book should succeed (no active CONFIRMED booking)
        payload = {
            'flight': str(self.flight.id),
            'passengers': [{'name': 'John', 'age': 30, 'gender': 'M'}]
        }
        response = self.client.post(self._book_url(), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_booking_missing_flight_field(self):
        """Returns 400 when flight field is omitted from the request."""
        response = self.client.post(self._book_url(), {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_booking_nonexistent_flight(self):
        """Returns 400 when the provided flight UUID does not exist."""
        import uuid
        response = self.client.post(self._book_url(), {'flight': str(uuid.uuid4()), 'passengers': [{'name': 'John', 'age': 30, 'gender': 'M'}]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_booking_unauthenticated(self):
        """Unauthenticated users cannot create bookings."""
        anon = APIClient()
        response = anon.post(self._book_url(), {'flight': str(self.flight.id), 'passengers': [{'name': 'John', 'age': 30, 'gender': 'M'}]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_booking_response_contains_flight_detail(self):
        """Response must include nested flight_detail for the frontend to use."""
        response = self.client.post(self._book_url(), {'flight': str(self.flight.id), 'passengers': [{'name': 'John', 'age': 30, 'gender': 'M'}]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        detail = response.data['flight_detail']
        self.assertEqual(detail['flight_number'], self.flight.flight_number)
        self.assertEqual(detail['source_airport'], self.flight.source_airport)
        self.assertEqual(detail['destination_airport'], self.flight.destination_airport)


class CreateBookingServiceTests(TestCase):
    """
    Unit tests for the create_booking service function.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='svc_user', email='svc@example.com', password='testpassword'
        )
        self.flight = Flight.objects.create(
            flight_number='FL001',
            airline='Airline',
            aircraft='Boeing 777',
            source_airport='SFO',
            destination_airport='ORD',
            departure_time=timezone.now() + timedelta(days=3),
            arrival_time=timezone.now() + timedelta(days=3, hours=4),
            base_fare=8000.00,
            total_seats=200,
            available_seats=100,
            status=FlightStatus.SCHEDULED
        )
        self.passengers = [{'name': 'John', 'age': 30, 'gender': 'M'}]

    def test_service_creates_booking(self):
        from apps.bookings.services import create_booking
        booking = create_booking(self.flight.id, self.user, self.passengers)
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        self.assertEqual(booking.user, self.user)
        self.assertEqual(booking.flight, self.flight)

    def test_service_decrements_seats(self):
        from apps.bookings.services import create_booking
        before = self.flight.available_seats
        create_booking(self.flight.id, self.user, self.passengers)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, before - 1)

    def test_service_raises_when_no_seats(self):
        from apps.bookings.services import create_booking
        from django.core.exceptions import ValidationError
        self.flight.available_seats = 0
        self.flight.save()
        with self.assertRaises(ValidationError):
            create_booking(self.flight.id, self.user, self.passengers)

    def test_service_raises_on_duplicate_confirmed(self):
        from apps.bookings.services import create_booking
        from django.core.exceptions import ValidationError
        create_booking(self.flight.id, self.user, self.passengers)
        # Second call should raise
        with self.assertRaises(ValidationError):
            create_booking(self.flight.id, self.user, self.passengers)

    def test_service_raises_on_nonexistent_flight(self):
        import uuid
        from apps.bookings.services import create_booking
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            create_booking(uuid.uuid4(), self.user, self.passengers)

    def test_service_raises_on_cancelled_flight(self):
        from apps.bookings.services import create_booking
        from django.core.exceptions import ValidationError
        self.flight.status = FlightStatus.CANCELLED
        self.flight.save()
        with self.assertRaisesMessage(ValidationError, "Cannot book a flight that is already cancelled."):
            create_booking(self.flight.id, self.user, self.passengers)

    def test_service_raises_on_departed_flight(self):
        from apps.bookings.services import create_booking
        from django.core.exceptions import ValidationError
        self.flight.status = FlightStatus.DEPARTED
        self.flight.save()
        with self.assertRaisesMessage(ValidationError, "Cannot book a flight that is already departed."):
            create_booking(self.flight.id, self.user, self.passengers)

    def test_service_raises_on_boarding_flight(self):
        from apps.bookings.services import create_booking
        from django.core.exceptions import ValidationError
        self.flight.status = FlightStatus.BOARDING
        self.flight.save()
        with self.assertRaisesMessage(ValidationError, "Cannot book a flight that is already boarding."):
            create_booking(self.flight.id, self.user, self.passengers)

    def test_service_raises_on_past_departure_time(self):
        from apps.bookings.services import create_booking
        from django.core.exceptions import ValidationError
        self.flight.departure_time = timezone.now() - timedelta(hours=1)
        # Avoid model validation error by keeping arrival after departure
        self.flight.arrival_time = self.flight.departure_time + timedelta(hours=2)
        self.flight.save()
        with self.assertRaisesMessage(ValidationError, "Cannot book a flight that has already departed."):
            create_booking(self.flight.id, self.user, self.passengers)
