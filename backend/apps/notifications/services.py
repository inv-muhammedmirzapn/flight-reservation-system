import logging
import threading
# pyrefly: ignore [missing-import]
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from .models import Notification, NotificationType
from . import email_templates as tpl

logger = logging.getLogger(__name__)



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
    def _send_email_task(user_email: str, subject: str, html_body: str):
        """
        Send an HTML email with the logo embedded as a CID inline attachment.
        """
        if not user_email:
            return

        import re
        import os
        from email.mime.image import MIMEImage
        from django.core.mail import EmailMultiAlternatives

        from_email = getattr(settings, 'EMAIL_HOST_USER', 'noreply@flightreservation.com')

        # Replace base64 src with CID reference
        html_with_cid = re.sub(r'src="data:image/[^"]*"', 'src="cid:passenger_logo"', html_body)

        # Strip tags for plain-text fallback
        plain_text = re.sub(r'<[^>]+>', ' ', html_body)
        plain_text = re.sub(r'\s+', ' ', plain_text).strip()

        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_text,
                from_email=from_email,
                to=[user_email],
            )
            msg.attach_alternative(html_with_cid, "text/html")

            # Attach logo as inline CID image
            logo_path = os.path.normpath(
                os.path.join(str(settings.BASE_DIR), '..', 'frontend', 'public', 'updated logo.png')
            )
            if os.path.isfile(logo_path):
                with open(logo_path, 'rb') as f:
                    img = MIMEImage(f.read(), _subtype='png')
                img.add_header('Content-ID', '<passenger_logo>')
                img.add_header('Content-Disposition', 'inline')
                msg.attach(img)

            msg.send(fail_silently=False)
        except Exception:
            logger.exception(f"FAILED TO SEND EMAIL TO {user_email}")

    @staticmethod
    def _send_email(user_email: str, subject: str, html_body: str):
        import sys
        if 'test' in sys.argv or getattr(settings, 'TESTING', False):
            NotificationService._send_email_task(user_email, subject, html_body)
        else:
            thread = threading.Thread(
                target=NotificationService._send_email_task,
                args=(user_email, subject, html_body)
            )
            thread.daemon = True
            thread.start()

    # ── Booking ──────────────────────────────────────────────────────────────

    @classmethod
    def send_booking_confirmation(cls, booking):
        user = booking.user
        user_name = user.get_full_name() or user.email

        # Use the first passenger's name if available, else fall back to account name
        first_passenger = booking.passengers.first()
        passenger_name = first_passenger.name if first_passenger else user_name

        fi = booking.flight  # FlightInstance
        first_leg = fi.flight.legs.order_by('leg_order').first()
        last_leg = fi.flight.legs.order_by('leg_order').last()
        flight_number = fi.flight.flight_no
        origin = first_leg.departure_airport.iata_code if first_leg else "N/A"
        destination = last_leg.arrival_airport.iata_code if last_leg else "N/A"

        subject, html = tpl.booking_confirmation(
            user_name=user_name,
            passenger_name=passenger_name,
            flight_number=flight_number,
            origin=origin,
            destination=destination,
            seat_count=booking.seat_count,
            total_price=float(booking.total_price),
        )
        cls._create_notification(user, subject,
            f"Your booking for flight {flight_number} is confirmed!",
            NotificationType.BOOKING_CONFIRMED)
        cls._send_email(user.email, subject, html)

    @classmethod
    def send_booking_cancellation(cls, booking):
        user = booking.user
        name = user.first_name or user.email
        fi = booking.flight  # FlightInstance
        first_leg = fi.flight.legs.order_by('leg_order').first()
        last_leg = fi.flight.legs.order_by('leg_order').last()
        flight_number = fi.flight.flight_no
        origin = first_leg.departure_airport.iata_code if first_leg else "N/A"
        destination = last_leg.arrival_airport.iata_code if last_leg else "N/A"
        subject, html = tpl.booking_cancellation(
            user_name=name,
            flight_number=flight_number,
            origin=origin,
            destination=destination,
        )
        cls._create_notification(user, subject,
            f"Your booking for flight {flight_number} has been cancelled.",
            NotificationType.BOOKING_CANCELLED)
        cls._send_email(user.email, subject, html)

    # ── Waitlist ──────────────────────────────────────────────────────────────

    @classmethod
    def send_waitlist_allocation(cls, booking):
        user = booking.user
        name = user.first_name or user.email
        fi = booking.flight  # FlightInstance
        first_leg = fi.flight.legs.order_by('leg_order').first()
        last_leg = fi.flight.legs.order_by('leg_order').last()
        flight_number = fi.flight.flight_no
        origin = first_leg.departure_airport.iata_code if first_leg else "N/A"
        destination = last_leg.arrival_airport.iata_code if last_leg else "N/A"
        subject, html = tpl.waitlist_confirmed(
            user_name=name,
            flight_number=flight_number,
            origin=origin,
            destination=destination,
            seat_count=booking.seat_count,
        )
        cls._create_notification(user, subject,
            f"Your waitlist for flight {flight_number} has been confirmed!",
            NotificationType.WAITLIST_ALLOCATED)
        cls._send_email(user.email, subject, html)

    # ── Flight status (bulk notifications) ────────────────────────────────────

    @classmethod
    def send_flight_delay(cls, flight_instance, new_departure_time):
        new_time_str = new_departure_time.strftime('%d %b %Y, %H:%M')
        first_leg = flight_instance.flight.legs.order_by('leg_order').first()
        last_leg = flight_instance.flight.legs.order_by('leg_order').last()
        flight_number = flight_instance.flight.flight_no
        origin = first_leg.departure_airport.iata_code if first_leg else "N/A"
        destination = last_leg.arrival_airport.iata_code if last_leg else "N/A"
        for booking in flight_instance.bookings.filter(status='CONFIRMED'):
            user = booking.user
            name = user.first_name or user.email
            subject, html = tpl.flight_delayed(
                user_name=name,
                flight_number=flight_number,
                origin=origin,
                destination=destination,
                new_departure_time=new_time_str,
            )
            cls._create_notification(user, subject,
                f"Flight {flight_number} delayed. New departure: {new_time_str}.",
                NotificationType.FLIGHT_DELAYED)
            cls._send_email(user.email, subject, html)

    @classmethod
    def send_flight_cancellation(cls, flight_instance):
        first_leg = flight_instance.flight.legs.order_by('leg_order').first()
        last_leg = flight_instance.flight.legs.order_by('leg_order').last()
        flight_number = flight_instance.flight.flight_no
        origin = first_leg.departure_airport.iata_code if first_leg else "N/A"
        destination = last_leg.arrival_airport.iata_code if last_leg else "N/A"
        for booking in flight_instance.bookings.filter(status='CONFIRMED'):
            user = booking.user
            name = user.first_name or user.email
            subject, html = tpl.flight_cancelled(
                user_name=name,
                flight_number=flight_number,
                origin=origin,
                destination=destination,
            )
            cls._create_notification(user, subject,
                f"Flight {flight_number} has been cancelled.",
                NotificationType.FLIGHT_CANCELLED)
            cls._send_email(user.email, subject, html)

    @classmethod
    def send_flight_status_notification(cls, flight_instance, old_status, new_status):
        if old_status == new_status:
            return

        first_leg = flight_instance.flight.legs.order_by('leg_order').first()
        last_leg = flight_instance.flight.legs.order_by('leg_order').last()
        flight_number = flight_instance.flight.flight_no
        origin = first_leg.departure_airport.iata_code if first_leg else "N/A"
        destination = last_leg.arrival_airport.iata_code if last_leg else "N/A"
        departure_str = flight_instance.scheduled_departure.strftime('%d %b %Y, %H:%M')

        # Map status → template function
        _template_map = {
            'DELAYED':   lambda u, n: tpl.flight_delayed(n, flight_number, origin, destination, departure_str),
            'CANCELLED': lambda u, n: tpl.flight_cancelled(n, flight_number, origin, destination),
            'BOARDING':  lambda u, n: tpl.flight_boarding(n, flight_number, origin, destination),
            'DEPARTED':  lambda u, n: tpl.flight_departed(n, flight_number, origin, destination),
            'ARRIVED':   lambda u, n: tpl.flight_arrived(n, flight_number, origin, destination),
        }

        _notif_type_map = {
            'DELAYED':   NotificationType.FLIGHT_DELAYED,
            'CANCELLED': NotificationType.FLIGHT_CANCELLED,
            'BOARDING':  NotificationType.FLIGHT_BOARDING,
            'DEPARTED':  NotificationType.FLIGHT_DEPARTED,
            'ARRIVED':   NotificationType.FLIGHT_ARRIVED,
        }

        build_template = _template_map.get(new_status)
        notif_type = _notif_type_map.get(new_status)
        if not build_template or not notif_type:
            return

        confirmed_users = [(b.user, b.user.email) for b in flight_instance.bookings.filter(status='CONFIRMED')]
        waitlist_users = [(e.user, e.user.email) for e in flight_instance.waitlist_entries.filter(status='PENDING')]

        # Deduplicate by user id
        seen = set()
        users_to_notify = []
        for user, email in confirmed_users + waitlist_users:
            if user.id not in seen:
                seen.add(user.id)
                users_to_notify.append((user, email))

        for user, email in users_to_notify:
            name = user.first_name or email
            subject, html = build_template(user, name)
            cls._create_notification(user, subject,
                f"Flight {flight_number} status updated to {new_status}.",
                notif_type)
            cls._send_email(email, subject, html)

    # ── User Account ────────────────────────────────────────────────────────

    @classmethod
    def send_password_reset_otp(cls, email: str, otp: str):
        subject, html = tpl.password_reset_otp(otp)
        cls._send_email(email, subject, html)

    @classmethod
    def send_email_change_otp(cls, email: str, otp: str):
        subject, html = tpl.email_change_otp(otp, email)
        cls._send_email(email, subject, html)

    # ── Waitlist ─────────────────────────────────────────────────────────────

    @classmethod
    def send_waitlist_cancellation(cls, user, flight_instance, refund_amount):
        first_leg = flight_instance.flight.legs.order_by('leg_order').first()
        last_leg = flight_instance.flight.legs.order_by('leg_order').last()
        flight_number = flight_instance.flight.flight_no
        origin = first_leg.departure_airport.iata_code if first_leg else "N/A"
        destination = last_leg.arrival_airport.iata_code if last_leg else "N/A"
        cls._create_notification(
            user=user,
            title=f"Waitlist Cancelled — Flight {flight_number}",
            message=(
                f"Your waitlist entry for flight {flight_number} "
                f"({origin} → {destination}) has been cancelled. "
                f"A refund of ₹{refund_amount:.2f} will be processed (5% processing fee applied)."
            ),
            notification_type=NotificationType.BOOKING_CANCELLED
        )