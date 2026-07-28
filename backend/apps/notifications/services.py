import threading
# pyrefly: ignore [missing-import]
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from .models import Notification, NotificationType
from . import email_templates as tpl


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
        except Exception as e:
            print(f"FAILED TO SEND EMAIL TO {user_email}: {e}")

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

        subject, html = tpl.booking_confirmation(
            user_name=user_name,
            passenger_name=passenger_name,
            flight_number=booking.flight.flight_number,
            origin=booking.flight.source_airport,
            destination=booking.flight.destination_airport,
            seat_count=booking.seat_count,
            total_price=float(booking.total_price),
        )
        cls._create_notification(user, subject,
            f"Your booking for flight {booking.flight.flight_number} is confirmed!",
            NotificationType.BOOKING_CONFIRMED)
        cls._send_email(user.email, subject, html)

    @classmethod
    def send_booking_cancellation(cls, booking):
        user = booking.user
        name = user.first_name or user.email
        subject, html = tpl.booking_cancellation(
            user_name=name,
            flight_number=booking.flight.flight_number,
            origin=booking.flight.source_airport,
            destination=booking.flight.destination_airport,
        )
        cls._create_notification(user, subject,
            f"Your booking for flight {booking.flight.flight_number} has been cancelled.",
            NotificationType.BOOKING_CANCELLED)
        cls._send_email(user.email, subject, html)

    # ── Waitlist ──────────────────────────────────────────────────────────────

    @classmethod
    def send_waitlist_allocation(cls, booking):
        user = booking.user
        name = user.first_name or user.email
        subject, html = tpl.waitlist_confirmed(
            user_name=name,
            flight_number=booking.flight.flight_number,
            origin=booking.flight.source_airport,
            destination=booking.flight.destination_airport,
            seat_count=booking.seat_count,
        )
        cls._create_notification(user, subject,
            f"Your waitlist for flight {booking.flight.flight_number} has been confirmed!",
            NotificationType.WAITLIST_ALLOCATED)
        cls._send_email(user.email, subject, html)

    # ── Flight status (bulk notifications) ────────────────────────────────────

    @classmethod
    def send_flight_delay(cls, flight, new_departure_time):
        new_time_str = new_departure_time.strftime('%d %b %Y, %H:%M')
        for booking in flight.bookings.filter(status='CONFIRMED'):
            user = booking.user
            name = user.first_name or user.email
            subject, html = tpl.flight_delayed(
                user_name=name,
                flight_number=flight.flight_number,
                origin=flight.source_airport,
                destination=flight.destination_airport,
                new_departure_time=new_time_str,
            )
            cls._create_notification(user, subject,
                f"Flight {flight.flight_number} delayed. New departure: {new_time_str}.",
                NotificationType.FLIGHT_DELAYED)
            cls._send_email(user.email, subject, html)

    @classmethod
    def send_flight_cancellation(cls, flight):
        for booking in flight.bookings.filter(status='CONFIRMED'):
            user = booking.user
            name = user.first_name or user.email
            subject, html = tpl.flight_cancelled(
                user_name=name,
                flight_number=flight.flight_number,
                origin=flight.source_airport,
                destination=flight.destination_airport,
            )
            cls._create_notification(user, subject,
                f"Flight {flight.flight_number} has been cancelled.",
                NotificationType.FLIGHT_CANCELLED)
            cls._send_email(user.email, subject, html)

    @classmethod
    def send_flight_status_notification(cls, flight, old_status, new_status):
        if old_status == new_status:
            return

        # Map status → template function
        _template_map = {
            'DELAYED':   lambda u, n: tpl.flight_delayed(n, flight.flight_number,
                             flight.source_airport, flight.destination_airport,
                             flight.departure_time.strftime('%d %b %Y, %H:%M')),
            'CANCELLED': lambda u, n: tpl.flight_cancelled(n, flight.flight_number,
                             flight.source_airport, flight.destination_airport),
            'BOARDING':  lambda u, n: tpl.flight_boarding(n, flight.flight_number,
                             flight.source_airport, flight.destination_airport),
            'DEPARTED':  lambda u, n: tpl.flight_departed(n, flight.flight_number,
                             flight.source_airport, flight.destination_airport),
            'ARRIVED':   lambda u, n: tpl.flight_arrived(n, flight.flight_number,
                             flight.source_airport, flight.destination_airport),
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

        confirmed_users = [(b.user, b.user.email) for b in flight.bookings.filter(status='CONFIRMED')]
        waitlist_users = [(e.user, e.user.email) for e in flight.waitlist_entries.filter(status='PENDING')]

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
                f"Flight {flight.flight_number} status updated to {new_status}.",
                notif_type)
            cls._send_email(email, subject, html)