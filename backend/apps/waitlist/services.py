from django.db import transaction
from .models import WaitlistEntry, WaitlistStatus
from apps.bookings.models import Booking, BookingStatus

@transaction.atomic
def auto_allocate_waitlist(flight):
    """
    Checks if there are available seats on the flight and if there are users
    on the waitlist. If so, automatically allocates the oldest PENDING waitlist
    entry by creating a Booking for them and decrementing available seats.
    """
    # Only proceed if seats are available
    if flight.available_seats <= 0:
        return None

    # Fetch the oldest pending waitlist entry
    # Using select_for_update to lock the row and prevent race conditions
    entry = WaitlistEntry.objects.select_for_update().filter(
        flight=flight,
        status=WaitlistStatus.PENDING
    ).order_by('joined_at').first()

    if not entry:
        return None

    # We found someone in the queue!
    # Update waitlist status
    entry.status = WaitlistStatus.ALLOCATED
    entry.save()

    # Create the confirmed booking
    new_booking = Booking.objects.create(
        user=entry.user,
        flight=flight,
        status=BookingStatus.CONFIRMED
    )

    try:
        from apps.notifications.services import NotificationService
        NotificationService.send_waitlist_allocation(new_booking)
    except Exception:
        pass

    # Decrement flight seats
    flight.available_seats -= 1
    flight.save()

    return new_booking