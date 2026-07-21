from django.core.mail import send_mail
from django.conf import settings
from .models import Notification, NotificationType

class NotificationService:
    @staticmethod
    def _create_notification(user, title, message, notification_type):
        return Notification.objects.create(
            user=user,
            title=title,
            message=message,
            notification_type=notification_type
        )

    @staticmethod
    def _send_email(user, title, message):
        if user.email:
            try:
                send_mail(
                    subject=title,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@flightreservation.com',
                    recipient_list=[user.email],
                    fail_silently=True,
                )
            except Exception:
                pass # Fail silently for email errors in this scope

    @classmethod
    def send_booking_confirmation(cls, booking):
        title = "Booking Confirmation"
        message = f"Dear {booking.user.first_name or booking.user.email},\n\nYour booking for flight {booking.flight.flight_number} from {booking.flight.source_airport} to {booking.flight.destination_airport} is confirmed!\n\nSafe travels!"
        cls._create_notification(booking.user, title, message, NotificationType.BOOKING_CONFIRMED)
        cls._send_email(booking.user, title, message)

    @classmethod
    def send_booking_cancellation(cls, booking):
        title = "Booking Cancellation"
        message = f"Dear {booking.user.first_name or booking.user.email},\n\nYour booking for flight {booking.flight.flight_number} from {booking.flight.source_airport} to {booking.flight.destination_airport} has been successfully cancelled.\n\nWe hope to see you again soon."
        cls._create_notification(booking.user, title, message, NotificationType.BOOKING_CANCELLED)
        cls._send_email(booking.user, title, message)

    @classmethod
    def send_waitlist_allocation(cls, booking):
        title = "Waitlist Confirmation: You are booked!"
        message = f"Great news, {booking.user.first_name or booking.user.email}!\n\nA seat became available on flight {booking.flight.flight_number} from {booking.flight.source_airport} to {booking.flight.destination_airport} and your waitlist entry was automatically upgraded to a confirmed booking.\n\nEnjoy your flight!"
        cls._create_notification(booking.user, title, message, NotificationType.WAITLIST_ALLOCATED)
        cls._send_email(booking.user, title, message)

    @classmethod
    def send_flight_delay(cls, flight, new_departure_time):
        title = f"Flight Delayed: {flight.flight_number}"
        message = f"Important update regarding your flight {flight.flight_number} from {flight.source_airport} to {flight.destination_airport}. The flight has been delayed and is now scheduled to depart at {new_departure_time.strftime('%Y-%m-%d %H:%M:%S')}."
        # Notify all users with confirmed bookings for this flight
        for booking in flight.bookings.filter(status='CONFIRMED'):
            cls._create_notification(booking.user, title, message, NotificationType.FLIGHT_DELAYED)
            cls._send_email(booking.user, title, message)

    @classmethod
    def send_flight_cancellation(cls, flight):
        title = f"Flight Cancelled: {flight.flight_number}"
        message = f"We regret to inform you that your flight {flight.flight_number} from {flight.source_airport} to {flight.destination_airport} has been cancelled. Please contact support for rebooking or refunds."
        # Notify all users with confirmed bookings for this flight
        for booking in flight.bookings.filter(status='CONFIRMED'):
            cls._create_notification(booking.user, title, message, NotificationType.FLIGHT_CANCELLED)
            cls._send_email(booking.user, title, message)