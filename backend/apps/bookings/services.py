from django.db import transaction
from django.core.exceptions import ValidationError
from .models import Booking, BookingStatus
from apps.waitlist.services import auto_allocate_waitlist

@transaction.atomic
def cancel_booking(booking_id, user):
    """
    Cancels a booking, increments the available seats for the flight,
    and triggers the waitlist auto-allocation logic.
    """
    try:
        booking = Booking.objects.select_for_update().get(id=booking_id, user=user)
    except Booking.DoesNotExist:
        raise ValidationError("Booking not found.")

    if booking.status == BookingStatus.CANCELLED:
        raise ValidationError("Booking is already cancelled.")

    # Update booking status
    booking.status = BookingStatus.CANCELLED
    booking.save()

    # Increment available seats on the flight
    flight = booking.flight
    flight.available_seats += 1
    flight.save()

    # Trigger waitlist auto-allocation
    auto_allocate_waitlist(flight)

    return booking