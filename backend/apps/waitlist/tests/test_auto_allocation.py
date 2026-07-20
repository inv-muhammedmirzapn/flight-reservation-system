from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from apps.flights.models import Flight, FlightStatus
from apps.bookings.models import Booking, BookingStatus
from apps.bookings.services import cancel_booking
from apps.waitlist.models import WaitlistEntry, WaitlistStatus

User = get_user_model()

class WaitlistAutoAllocationTestCase(TestCase):
    def setUp(self):
        # Create users
        self.user_booking = User.objects.create_user(username='bookinguser', password='pw')
        self.user_waitlist_1 = User.objects.create_user(username='waitlist1', password='pw')
        self.user_waitlist_2 = User.objects.create_user(username='waitlist2', password='pw')
        
        # Create a full flight
        self.flight = Flight.objects.create(
            flight_number='FL_AUTO', airline='TestAir', aircraft='Boeing 737',
            source_airport='JFK', destination_airport='LHR',
            departure_time=timezone.now() + timedelta(days=1),
            arrival_time=timezone.now() + timedelta(days=1, hours=8),
            base_fare=500.00, total_seats=1, available_seats=0,
            status=FlightStatus.SCHEDULED
        )
        
        # Create one confirmed booking (takes up the only seat)
        self.booking = Booking.objects.create(
            user=self.user_booking,
            flight=self.flight,
            status=BookingStatus.CONFIRMED
        )
        
        # Create two waitlist entries
        self.entry1 = WaitlistEntry.objects.create(user=self.user_waitlist_1, flight=self.flight)
        # Manually alter joined_at if needed, but sequential creation works
        self.entry2 = WaitlistEntry.objects.create(user=self.user_waitlist_2, flight=self.flight)

    def test_auto_allocation_on_cancel(self):
        """
        Verify that cancelling a booking triggers the waitlist auto-allocation,
        grants the seat to the first person in queue, and maintains seats at 0.
        """
        # Initially, seats are 0 and waitlist entries are PENDING
        self.assertEqual(self.flight.available_seats, 0)
        self.assertEqual(self.entry1.status, WaitlistStatus.PENDING)
        self.assertEqual(self.entry2.status, WaitlistStatus.PENDING)
        
        # User cancels booking
        cancel_booking(self.booking.id, self.user_booking)
        
        # Refresh from db
        self.flight.refresh_from_db()
        self.entry1.refresh_from_db()
        self.entry2.refresh_from_db()
        
        # Waitlist 1 should be ALLOCATED, Waitlist 2 should still be PENDING
        self.assertEqual(self.entry1.status, WaitlistStatus.ALLOCATED)
        self.assertEqual(self.entry2.status, WaitlistStatus.PENDING)
        
        # A new booking should have been created for user_waitlist_1
        new_booking_exists = Booking.objects.filter(user=self.user_waitlist_1, flight=self.flight, status=BookingStatus.CONFIRMED).exists()
        self.assertTrue(new_booking_exists)
        
        # The flight should STILL have 0 available seats (since 1 opened, and 1 was immediately taken)
        self.assertEqual(self.flight.available_seats, 0)

    def test_auto_allocation_multiple_cancellations(self):
        """
        Verify the queue cascades properly. If another booking is cancelled,
        the second person gets the seat.
        """
        # User 1 gets the seat after the first cancellation
        cancel_booking(self.booking.id, self.user_booking)
        new_booking = Booking.objects.get(user=self.user_waitlist_1)
        
        # Now User 1 cancels their newly allocated booking
        cancel_booking(new_booking.id, self.user_waitlist_1)
        
        self.entry2.refresh_from_db()
        self.assertEqual(self.entry2.status, WaitlistStatus.ALLOCATED)
        self.assertTrue(Booking.objects.filter(user=self.user_waitlist_2, flight=self.flight).exists())
