import threading
from django.test import TestCase
from django.core import mail
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, Seat, Fare,
    InstanceStatus, CabinClass
)
from apps.bookings.models import Booking, BookingStatus
from apps.notifications.models import Notification, NotificationType
from apps.notifications.services import NotificationService

User = get_user_model()


class NotificationServiceTests(TestCase):
    def setUp(self):
        # Run threads synchronously for testing
        self.original_thread_start = threading.Thread.start
        threading.Thread.start = threading.Thread.run

        self.user = User.objects.create_user(
            username='notifuser', email='notif@example.com', password='password123'
        )
        
        # Master Data
        self.country = Country.objects.create(name="United States", iso_code="USA")
        self.airport_dep = Airport.objects.create(
            airport_name="JFK", iata_code="JFK", city="New York", country=self.country
        )
        self.airport_arr = Airport.objects.create(
            airport_name="LAX", iata_code="LAX", city="Los Angeles", country=self.country
        )
        self.airline = Airline.objects.create(
            airline_name="Delta Air Lines", iata_airline_code="DL"
        )
        self.aircraft_model = AircraftModel.objects.create(
            manufacturer="Boeing", model_name="737"
        )
        self.aircraft = Aircraft.objects.create(
            registration="N102DL", aircraft_model=self.aircraft_model, airline=self.airline,
            economy_capacity=10, business_capacity=0, first_class_capacity=0
        )
        
        # Route & Leg
        self.route = FlightRoute.objects.create(airline=self.airline, flight_no="DL202")
        self.dep_time = timezone.now() + timedelta(days=2)
        self.arr_time = self.dep_time + timedelta(hours=6)
        self.leg = FlightLeg.objects.create(
            flight=self.route, leg_order=1,
            departure_airport=self.airport_dep, arrival_airport=self.airport_arr,
            scheduled_departure=self.dep_time, scheduled_arrival=self.arr_time
        )
        
        # Flight Instance
        self.flight_instance = FlightInstance.objects.create(
            flight=self.route, aircraft=self.aircraft, date=self.dep_time.date(),
            scheduled_departure=self.dep_time, scheduled_arrival=self.arr_time,
            status=InstanceStatus.SCHEDULED
        )
        
        self.booking = Booking.objects.create(
            user=self.user, flight=self.flight_instance, cabin_class=CabinClass.ECONOMY,
            seat_count=1, total_price=Decimal("300.00"), status=BookingStatus.CONFIRMED
        )
        mail.outbox = []

    def tearDown(self):
        threading.Thread.start = self.original_thread_start

    def test_send_booking_confirmation(self):
        NotificationService.send_booking_confirmation(self.booking)
        self.assertEqual(Notification.objects.count(), 1)
        notif = Notification.objects.first()
        self.assertEqual(notif.notification_type, NotificationType.BOOKING_CONFIRMED)
        self.assertEqual(notif.user, self.user)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.user.email])
        self.assertIn('Confirmed', mail.outbox[0].subject)

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
        new_time = self.dep_time + timedelta(hours=2)
        NotificationService.send_flight_delay(self.flight_instance, new_time)
        self.assertEqual(Notification.objects.count(), 1)
        notif = Notification.objects.first()
        self.assertEqual(notif.notification_type, NotificationType.FLIGHT_DELAYED)
        self.assertEqual(len(mail.outbox), 1)

    def test_send_flight_cancellation(self):
        NotificationService.send_flight_cancellation(self.flight_instance)
        self.assertEqual(Notification.objects.count(), 1)
        notif = Notification.objects.first()
        self.assertEqual(notif.notification_type, NotificationType.FLIGHT_CANCELLED)
        self.assertEqual(len(mail.outbox), 1)

    def test_send_password_reset_otp(self):
        NotificationService.send_password_reset_otp('test@test.com', '123456')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('123456', mail.outbox[0].body)

    def test_send_email_change_otp(self):
        NotificationService.send_email_change_otp('test@test.com', '654321')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('654321', mail.outbox[0].body)
