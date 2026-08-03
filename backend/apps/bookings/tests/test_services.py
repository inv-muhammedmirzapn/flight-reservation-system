from django.test import TestCase
from django.contrib.auth.models import User
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch

from apps.flights.models import Flight
from apps.bookings.models import Booking, BookingStatus
from django.core.exceptions import ValidationError as BookingError
from apps.bookings.services import create_booking, cancel_booking

class BookingServicesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="password")
        
        self.flight = Flight.objects.create(
            flight_number="TA101",
            airline="TestAir",
            aircraft="Boeing 737",
            source_airport="ORG",
            destination_airport="DST",
            departure_time=timezone.now() + timedelta(days=2),
            arrival_time=timezone.now() + timedelta(days=2, hours=2),
            base_fare=Decimal("5000.00"),
            total_seats=10,
            available_seats=10,
            status='SCHEDULED'
        )
        
        # Flight model auto-generates LegacySeat rows on save
        self.passengers = [
            {"name": "John Doe", "age": 30, "gender": "M", "seat_number": "1A"}
        ]

    def test_create_booking_success(self):
        booking = create_booking(self.flight.id, self.user, self.passengers)
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        self.assertEqual(booking.seat_count, 1)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 9)
        self.assertEqual(booking.passengers.count(), 1)

    def test_create_booking_invalid_flight(self):
        import uuid
        with self.assertRaisesMessage(BookingError, "Flight not found"):
            create_booking(uuid.uuid4(), self.user, self.passengers)

    def test_create_booking_flight_departed(self):
        self.flight.departure_time = timezone.now() - timedelta(days=1)
        self.flight.save()
        with self.assertRaisesMessage(BookingError, "Cannot book a flight that has already departed."):
            create_booking(self.flight.id, self.user, self.passengers)

    def test_create_booking_seat_already_booked(self):
        # Book it once
        create_booking(self.flight.id, self.user, self.passengers)
        
        # Try booking again for same user on same flight
        with self.assertRaisesMessage(BookingError, "You already have a confirmed booking for this flight."):
            create_booking(self.flight.id, self.user, self.passengers)

    def test_create_booking_not_enough_seats(self):
        self.flight.available_seats = 0
        self.flight.save()
        with self.assertRaisesMessage(BookingError, "Only 0 seats available on this flight."):
            create_booking(self.flight.id, self.user, self.passengers)

    def test_cancel_booking_success(self):
        booking = create_booking(self.flight.id, self.user, self.passengers)
        result_booking = cancel_booking(booking_id=booking.id, user=self.user)
        
        booking.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.CANCELLED)
        self.assertEqual(result_booking.status, BookingStatus.CANCELLED)
        
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 10)

    def test_cancel_booking_not_found_or_unauthorized(self):
        other_user = User.objects.create_user(username="other", password="pwd")
        booking = create_booking(self.flight.id, self.user, self.passengers)
        
        with self.assertRaisesMessage(BookingError, "Booking not found."):
            cancel_booking(booking.id, other_user)
            
    def test_cancel_already_cancelled(self):
        booking = create_booking(self.flight.id, self.user, self.passengers)
        cancel_booking(booking.id, self.user)
        
        with self.assertRaisesMessage(BookingError, "Booking is already cancelled."):
            cancel_booking(booking.id, self.user)
