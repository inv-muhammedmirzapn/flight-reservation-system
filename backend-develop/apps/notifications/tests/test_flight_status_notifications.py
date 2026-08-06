import threading
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, Seat, Fare,
    InstanceStatus, CabinClass, SeatStatus
)
from apps.bookings.models import Booking, BookingStatus
from apps.waitlist.models import WaitlistEntry, WaitlistStatus
from apps.notifications.models import Notification, NotificationType
from apps.notifications.services import NotificationService

User = get_user_model()


class FlightStatusNotificationTests(TestCase):
    def setUp(self):
        # Run threads synchronously for testing
        self.original_thread_start = threading.Thread.start
        threading.Thread.start = threading.Thread.run

        self.user_booked = User.objects.create_user(
            username='booked_user', email='booked@example.com', password='password123'
        )
        self.user_waitlisted = User.objects.create_user(
            username='waitlisted_user', email='waitlist@example.com', password='password123'
        )
        
        # Master Data
        self.country = Country.objects.create(name="India", iso_code="IND")
        self.airport_dep = Airport.objects.create(
            airport_name="DEL", iata_code="DEL", city="New Delhi", country=self.country
        )
        self.airport_arr = Airport.objects.create(
            airport_name="BOM", iata_code="BOM", city="Mumbai", country=self.country
        )
        self.airline = Airline.objects.create(
            airline_name="Air India", iata_airline_code="AI"
        )
        self.aircraft_model = AircraftModel.objects.create(
            manufacturer="Boeing", model_name="737"
        )
        self.aircraft = Aircraft.objects.create(
            registration="VT-AI1", aircraft_model=self.aircraft_model, airline=self.airline,
            economy_capacity=10, business_capacity=0, first_class_capacity=0
        )
        
        # Route & Leg
        self.route = FlightRoute.objects.create(airline=self.airline, flight_no="AI101")
        self.dep_time = timezone.now() + timedelta(days=1)
        self.arr_time = self.dep_time + timedelta(hours=3)
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
        
        # Confirmed booking
        self.booking = Booking.objects.create(
            user=self.user_booked, flight=self.flight_instance, cabin_class=CabinClass.ECONOMY,
            status=BookingStatus.CONFIRMED, seat_count=1, total_price=Decimal("5000.00")
        )
        
        # Pending waitlist entry
        self.waitlist_entry = WaitlistEntry.objects.create(
            user=self.user_waitlisted, flight=self.flight_instance, cabin_class=CabinClass.ECONOMY,
            seat_count=1, price=Decimal("5000.00"), status=WaitlistStatus.PENDING
        )
        
        # Clear outbox to ignore initial setup
        mail.outbox = []

    def tearDown(self):
        threading.Thread.start = self.original_thread_start

    def test_status_change_to_delayed_sends_notifications(self):
        # Call status change service/method
        # Let's check how status change is done. If done via save, we call send_flight_status_notification manually
        # since models.py does not import NotificationService to prevent circular dependencies.
        NotificationService.send_flight_status_notification(
            self.flight_instance, InstanceStatus.SCHEDULED, InstanceStatus.DELAYED
        )
        
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
        NotificationService.send_flight_status_notification(
            self.flight_instance, InstanceStatus.SCHEDULED, InstanceStatus.CANCELLED
        )
        
        booked_notifications = Notification.objects.filter(user=self.user_booked)
        waitlist_notifications = Notification.objects.filter(user=self.user_waitlisted)
        
        self.assertEqual(booked_notifications.count(), 1)
        self.assertEqual(waitlist_notifications.count(), 1)
        
        self.assertEqual(booked_notifications[0].notification_type, NotificationType.FLIGHT_CANCELLED)
        self.assertEqual(waitlist_notifications[0].notification_type, NotificationType.FLIGHT_CANCELLED)

    def test_status_change_to_boarding_sends_notifications(self):
        NotificationService.send_flight_status_notification(
            self.flight_instance, InstanceStatus.SCHEDULED, InstanceStatus.BOARDING
        )
        
        booked_notifications = Notification.objects.filter(user=self.user_booked)
        waitlist_notifications = Notification.objects.filter(user=self.user_waitlisted)
        
        self.assertEqual(booked_notifications.count(), 1)
        self.assertEqual(waitlist_notifications.count(), 1)
        
        self.assertEqual(booked_notifications[0].notification_type, NotificationType.FLIGHT_BOARDING)
        self.assertEqual(waitlist_notifications[0].notification_type, NotificationType.FLIGHT_BOARDING)

    def test_no_status_change_sends_no_notifications(self):
        NotificationService.send_flight_status_notification(
            self.flight_instance, InstanceStatus.SCHEDULED, InstanceStatus.SCHEDULED
        )
        
        booked_notifications = Notification.objects.filter(user=self.user_booked)
        waitlist_notifications = Notification.objects.filter(user=self.user_waitlisted)
        
        self.assertEqual(booked_notifications.count(), 0)
        self.assertEqual(waitlist_notifications.count(), 0)
