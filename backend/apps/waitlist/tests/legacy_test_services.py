from django.test import TestCase
from django.contrib.auth.models import User
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch

from apps.flights.models import Flight
from apps.waitlist.models import WaitlistEntry, WaitlistStatus
from apps.waitlist.services import (
    join_waitlist,
    cancel_waitlist_entry,
    process_waitlist_allocations,
    WaitlistError
)
from apps.bookings.models import Booking, BookingStatus

class WaitlistServicesTests(TestCase):
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
            available_seats=0, # Flight is full to allow waitlisting
            status='SCHEDULED'
        )
        
        self.passengers = [
            {"name": "John Doe", "age": 30, "gender": "M"}
        ]

    def test_join_waitlist_success(self):
        # We assume cabin_class='Economy' or None for legacy
        entry = join_waitlist(self.user, self.flight.id, self.passengers, cabin_class=None)
        self.assertEqual(entry.status, WaitlistStatus.PENDING)
        self.assertEqual(entry.passengers.count(), 1)
        self.assertEqual(entry.price, self.flight.base_fare)

    def test_join_waitlist_flight_not_found(self):
        import uuid
        with self.assertRaisesMessage(WaitlistError, "Flight not found"):
            join_waitlist(self.user, uuid.uuid4(), self.passengers, cabin_class=None)

    def test_join_waitlist_flight_departed(self):
        self.flight.departure_time = timezone.now() - timedelta(days=1)
        self.flight.save()
        with self.assertRaisesMessage(WaitlistError, "Cannot join the waitlist for a flight that has already departed."):
            join_waitlist(self.user, self.flight.id, self.passengers, cabin_class=None)

    def test_cancel_waitlist_entry_success(self):
        entry = join_waitlist(self.user, self.flight.id, self.passengers, cabin_class=None)
        result = cancel_waitlist_entry(entry)
        
        entry.refresh_from_db()
        self.assertEqual(entry.status, WaitlistStatus.CANCELLED)
        self.assertEqual(result["status"], WaitlistStatus.CANCELLED)

    def test_cancel_waitlist_entry_not_pending(self):
        entry = join_waitlist(self.user, self.flight.id, self.passengers, cabin_class=None)
        entry.status = WaitlistStatus.CONFIRMED
        entry.save()
        
        with self.assertRaisesMessage(WaitlistError, "Only pending waitlist entries can be cancelled."):
            cancel_waitlist_entry(entry)

    def test_process_waitlist_allocations(self):
        entry = join_waitlist(self.user, self.flight.id, self.passengers, cabin_class=None)
        
        # Free up a seat
        self.flight.available_seats = 1
        self.flight.save()
        
        # Mock NotificationService to avoid sending actual email in tests
        with patch("apps.notifications.services.NotificationService.send_booking_confirmation"):
            process_waitlist_allocations(self.flight)
            
        entry.refresh_from_db()
        self.assertEqual(entry.status, WaitlistStatus.CONFIRMED)
        
        booking = Booking.objects.filter(user=self.user, flight=self.flight).first()
        self.assertIsNotNone(booking)
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 0)
        
    def test_process_waitlist_allocations_no_seats(self):
        join_waitlist(self.user, self.flight.id, self.passengers, cabin_class=None)
        # 0 available seats
        promoted_count = process_waitlist_allocations(self.flight)
        self.assertIn(promoted_count, (0, None))
