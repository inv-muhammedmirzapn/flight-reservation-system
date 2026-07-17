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
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='testuser@example.com', password='testpassword', first_name='Test', last_name='User')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
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
        
    def test_create_booking_success(self):
        url = reverse('booking-list')
        data = {
            'flight': str(self.flight.id),
            'seat_count': 2
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify seats were reduced
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 8)
        
        # Verify booking created
        booking = Booking.objects.get(id=response.data['id'])
        self.assertEqual(booking.seat_count, 2)
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        self.assertEqual(booking.total_price, 200.00)

    def test_create_booking_not_enough_seats(self):
        url = reverse('booking-list')
        data = {
            'flight': str(self.flight.id),
            'seat_count': 11
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Verify seats were NOT reduced
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 10)

    def test_cancel_booking_success(self):
        # First create a booking
        booking = Booking.objects.create(
            user=self.user,
            flight=self.flight,
            seat_count=3,
            total_price=300.00,
            status=BookingStatus.CONFIRMED
        )
        
        self.flight.available_seats -= 3
        self.flight.save()
        
        url = reverse('booking-cancel', kwargs={'pk': booking.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify seats were added back
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 10)
        
        # Verify booking is cancelled
        booking.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.CANCELLED)

    def test_cancel_booking_already_cancelled(self):
        booking = Booking.objects.create(
            user=self.user,
            flight=self.flight,
            seat_count=3,
            total_price=300.00,
            status=BookingStatus.CANCELLED
        )
        
        url = reverse('booking-cancel', kwargs={'pk': booking.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

class BookingConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser2', email='testuser2@example.com', password='testpassword', first_name='Test', last_name='User')
        
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
            available_seats=5,
            status=FlightStatus.SCHEDULED
        )
        
    def test_concurrent_bookings(self):
        # We simulate multiple concurrent requests that would exceed total seats
        url = reverse('booking-list')
        
        # Define a function to make a booking
        def make_booking():
            # Django's test client is not thread-safe with connections, need to close them
            # so each thread gets its own.
            try:
                client = APIClient()
                client.force_authenticate(user=self.user)
                client.post(url, {'flight': str(self.flight.id), 'seat_count': 3}, format='json')
            finally:
                connection.close()
            
        threads = []
        for i in range(3):
            t = threading.Thread(target=make_booking)
            threads.append(t)
            t.start()
            
        for t in threads:
            t.join()
            
        # Total seats = 5. Each thread tries to book 3.
        # Only 1 thread should succeed, 2 should fail (due to locking or constraint).
        # So available seats should be 2.
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 2)
        self.assertEqual(Booking.objects.filter(flight=self.flight, status=BookingStatus.CONFIRMED).count(), 1)
