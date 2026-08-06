from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from datetime import timedelta
from apps.flights.models import Flight, FlightStatus
from apps.bookings.models import Booking, BookingStatus
from apps.waitlist.models import WaitlistEntry, WaitlistStatus
from apps.notifications.models import Notification, NotificationType

User = get_user_model()

class FlightStatusNotificationTests(TestCase):
    def setUp(self):
        self.user_booked = User.objects.create_user(
            username='booked_user',
            email='booked@example.com',
            password='password123'
        )
        self.user_waitlisted = User.objects.create_user(
            username='waitlisted_user',
            email='waitlist@example.com',
            password='password123'
        )
        
        self.flight = Flight.objects.create(
            flight_number='AI-101',
            airline='Air India',
            aircraft='A320',
            source_airport='COK',
            destination_airport='DEL',
            departure_time=timezone.now() + timedelta(days=1),
            arrival_time=timezone.now() + timedelta(days=1, hours=3),
            base_fare=5000.0,
            total_seats=180,
            available_seats=0,  # fully booked
            status=FlightStatus.SCHEDULED
        )
        
        # Confirmed booking
        self.booking = Booking.objects.create(
            user=self.user_booked,
            flight=self.flight,
            status=BookingStatus.CONFIRMED,
            seat_count=1,
            total_price=5000.0
        )
        
        # Pending waitlist entry
        self.waitlist_entry = WaitlistEntry.objects.create(
            user=self.user_waitlisted,
            flight=self.flight,
            seat_count=1,
            price=5000.0,
            status=WaitlistStatus.PENDING
        )
        
        # Clear outbox to ignore initial setup
        mail.outbox = []

    def test_status_change_to_delayed_sends_notifications(self):
        # Change status to DELAYED
        self.flight.status = FlightStatus.DELAYED
        self.flight.save()
        
        # Check database notifications
        booked_notifications = Notification.objects.filter(user=self.user_booked)
        waitlist_notifications = Notification.objects.filter(user=self.user_waitlisted)
        
        self.assertEqual(booked_notifications.count(), 1)
        self.assertEqual(waitlist_notifications.count(), 1)
        
        self.assertEqual(booked_notifications[0].notification_type, NotificationType.FLIGHT_DELAYED)
        self.assertEqual(waitlist_notifications[0].notification_type, NotificationType.FLIGHT_DELAYED)
        
        # Check email outbox
        self.assertEqual(len(mail.outbox), 2)
        recipients = [m.to[0] for m in mail.outbox]
        self.assertIn('booked@example.com', recipients)
        self.assertIn('waitlist@example.com', recipients)

    def test_status_change_to_cancelled_sends_notifications(self):
        # Change status to CANCELLED
        self.flight.status = FlightStatus.CANCELLED
        self.flight.save()
        
        booked_notifications = Notification.objects.filter(user=self.user_booked)
        waitlist_notifications = Notification.objects.filter(user=self.user_waitlisted)
        
        self.assertEqual(booked_notifications.count(), 1)
        self.assertEqual(waitlist_notifications.count(), 1)
        
        self.assertEqual(booked_notifications[0].notification_type, NotificationType.FLIGHT_CANCELLED)
        self.assertEqual(waitlist_notifications[0].notification_type, NotificationType.FLIGHT_CANCELLED)

    def test_status_change_to_boarding_sends_notifications(self):
        # Change status to BOARDING
        self.flight.status = FlightStatus.BOARDING
        self.flight.save()
        
        booked_notifications = Notification.objects.filter(user=self.user_booked)
        waitlist_notifications = Notification.objects.filter(user=self.user_waitlisted)
        
        self.assertEqual(booked_notifications.count(), 1)
        self.assertEqual(waitlist_notifications.count(), 1)
        
        self.assertEqual(booked_notifications[0].notification_type, NotificationType.FLIGHT_BOARDING)
        self.assertEqual(waitlist_notifications[0].notification_type, NotificationType.FLIGHT_BOARDING)

    def test_no_status_change_sends_no_notifications(self):
        # Save without changing status
        self.flight.save()
        
        booked_notifications = Notification.objects.filter(user=self.user_booked)
        waitlist_notifications = Notification.objects.filter(user=self.user_waitlisted)
        
        self.assertEqual(booked_notifications.count(), 0)
        self.assertEqual(waitlist_notifications.count(), 0)
