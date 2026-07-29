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
    # Lock the flight row to ensure available_seats is accurate and not modified concurrently
    from apps.flights.models import FlightInstance, Seat, SeatStatus, Fare
    flight = FlightInstance.objects.select_for_update().get(id=flight.id)

    available_seats_count = flight.seats.filter(status=SeatStatus.AVAILABLE).count()
    if available_seats_count <= 0:
        return

    # Select pending entries for update to prevent concurrent allocation conflicts
    pending_entries = (
        WaitlistEntry.objects.filter(flight=flight, status=WaitlistStatus.PENDING)
        .order_by("created_at")
        .select_for_update()
    )

    for entry in pending_entries:
        available_seats_count = flight.seats.filter(status=SeatStatus.AVAILABLE).count()
        if available_seats_count >= entry.seat_count:
            # Deduct seats
            seats_to_book = list(flight.seats.filter(status=SeatStatus.AVAILABLE).select_for_update()[:entry.seat_count])
            for seat in seats_to_book:
                seat.status = SeatStatus.BOOKED
                seat.save(update_fields=['status'])
            
            for fare in flight.fares.all():
                fare.available_seats = flight.seats.filter(seat_class=fare.cabin_class, status=SeatStatus.AVAILABLE).count()
                fare.save(update_fields=["available_seats"])

            # Create confirmed booking
            booking = Booking.objects.create(
                user=entry.user,
                flight=flight,
                seat_count=entry.seat_count,
                total_price=entry.price,
                status=BookingStatus.CONFIRMED,
            )

            from apps.bookings.models import Passenger
            for wp, seat in zip(entry.passengers.all(), seats_to_book):
                Passenger.objects.create(
                    booking=booking,
                    name=wp.name,
                    age=wp.age,
                    gender=wp.gender,
                    phone_number=wp.phone_number,
                    seat=seat
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

            if flight.seats.filter(status=SeatStatus.AVAILABLE).count() == 0:
                break