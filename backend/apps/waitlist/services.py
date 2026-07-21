from django.db import transaction
from apps.bookings.models import Booking, BookingStatus
from .models import WaitlistEntry, WaitlistStatus


@transaction.atomic
def process_waitlist_allocations(flight):
    """
    Called when available seats on a flight increase (due to cancellation).
    Scans the waitlist queue in FIFO order (by created_at) and allocates
    seats to pending entries that can be fully accommodated by the available seats.
    """
    if flight.available_seats <= 0:
        return

    # Select pending entries for update to prevent concurrent allocation conflicts
    pending_entries = (
        WaitlistEntry.objects.filter(flight=flight, status=WaitlistStatus.PENDING)
        .order_by("created_at")
        .select_for_update()
    )

    for entry in pending_entries:
        if flight.available_seats >= entry.seat_count:
            # Deduct seats
            flight.available_seats -= entry.seat_count
            flight.save()

            # Create confirmed booking
            booking = Booking.objects.create(
                user=entry.user,
                flight=flight,
                seat_count=entry.seat_count,
                total_price=flight.base_fare * entry.seat_count,
                status=BookingStatus.CONFIRMED,
            )

            # Confirm waitlist entry and link to new booking
            entry.status = WaitlistStatus.CONFIRMED
            entry.booking = booking
            entry.save()

            # Notify the user their waitlist spot was confirmed
            try:
                from apps.notifications.services import NotificationService
                NotificationService.send_waitlist_allocation(booking)
            except Exception:
                pass

            if flight.available_seats == 0:
                break