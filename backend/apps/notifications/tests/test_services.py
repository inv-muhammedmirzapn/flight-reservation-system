from django.test import TestCase
from django.core import mail
from django.contrib.auth import get_user_model
from apps.flights.models import Flight, FlightStatus
from apps.bookings.models import Booking, BookingStatus
from apps.notifications.models import Notification, NotificationType
from apps.notifications.services import NotificationService
from datetime import timedelta
from django.utils import timezone

User = get_user_model()

class NotificationServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='password123',
            first_name='Test'
        )
        self.flight = Flight.objects.create(
            flight_number='TEST1234',
            airline='TestAir',
            aircraft='B737',
            source_airport='JFK',
            destination_airport='LAX',
            departure_time=timezone.now() + timedelta(days=2),
            arrival_time=timezone.now() + timedelta(days=2, hours=6),
            base_fare=100.0,
            total_seats=100,
            available_seats=100,
            status=FlightStatus.SCHEDULED
        )
        self.booking = Booking.objects.create(
            user=self.user,
            flight=self.flight,
            status=BookingStatus.CONFIRMED
        )

    def test_send_booking_confirmation(self):
        NotificationService.send_booking_confirmation(self.booking)
        self.assertEqual(Notification.objects.count(), 1)
        notif = Notification.objects.first()
        self.assertEqual(notif.notification_type, NotificationType.BOOKING_CONFIRMED)
        self.assertEqual(notif.user, self.user)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.user.email])
        self.assertIn('Confirmation', mail.outbox[0].subject)

    def test_send_booking_cancellation(self):
        NotificationService.send_booking_cancellation(self.booking)
        self.assertEqual(Notification.objects.count(), 1)
        notif = Notification.objects.first()
        self.assertEqual(notif.notification_type, NotificationType.BOOKING_CANCELLED)
        self.assertEqual(len(mail.outbox), 1)

    def test_send_waitlist_allocation(self):
        NotificationService.send_waitlist_allocation(self.booking)
        self.assertEqual(Notification.objects.count(), 1)
        notif = Notification.objects.first()
        self.assertEqual(notif.notification_type, NotificationType.WAITLIST_ALLOCATED)
        self.assertEqual(len(mail.outbox), 1)

    def test_send_flight_delay(self):
        new_time = self.flight.departure_time + timedelta(hours=2)
        NotificationService.send_flight_delay(self.flight, new_time)
        self.assertEqual(Notification.objects.count(), 1)
        notif = Notification.objects.first()
        self.assertEqual(notif.notification_type, NotificationType.FLIGHT_DELAYED)
        self.assertEqual(len(mail.outbox), 1)

    def test_send_flight_cancellation(self):
        NotificationService.send_flight_cancellation(self.flight)
        self.assertEqual(Notification.objects.count(), 1)
        notif = Notification.objects.first()
        self.assertEqual(notif.notification_type, NotificationType.FLIGHT_CANCELLED)
        self.assertEqual(len(mail.outbox), 1)
