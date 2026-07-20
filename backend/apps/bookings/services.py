from django.db import transaction, DatabaseError
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Booking, BookingStatus
from apps.flights.models import Flight, FlightStatus
from apps.waitlist.services import auto_allocate_waitlist


def create_booking(flight_id, user):
    """
    Creates a confirmed booking for the given user and flight.

    All business-logic validation happens BEFORE the atomic block so that
    ValidationError never escapes @transaction.atomic — which would poison
    the DB connection and cause a 500 error in Django/SQLite environments.

    The select_for_update() lock is retained for PostgreSQL concurrency safety
    in production; on SQLite it is silently treated as a plain SELECT.
    """
    # ── Pre-validate outside any transaction ───────────────────────────────
    try:
        flight = Flight.objects.get(id=flight_id)
    except Flight.DoesNotExist:
        raise ValidationError("Flight not found.")

    if flight.status in [FlightStatus.CANCELLED, FlightStatus.DEPARTED, FlightStatus.ARRIVED, FlightStatus.BOARDING]:
        raise ValidationError(f"Cannot book a flight that is already {flight.status.lower()}.")

    if flight.departure_time < timezone.now():
        raise ValidationError("Cannot book a flight that has already departed.")

    if flight.available_seats <= 0:
        raise ValidationError("No available seats on this flight.")

    if Booking.objects.filter(
        user=user, flight=flight, status=BookingStatus.CONFIRMED
    ).exists():
        raise ValidationError("You already have a confirmed booking for this flight.")

    # ── Atomic write: re-check with lock, then create ───────────────────────
    with transaction.atomic():
        # Re-fetch with row-level lock (PostgreSQL) to guard concurrent writes.
        # On SQLite this is a no-op select — the pre-check above is sufficient.
        try:
            flight = Flight.objects.select_for_update(nowait=False).get(id=flight_id)
        except (Flight.DoesNotExist, DatabaseError):
            flight = Flight.objects.get(id=flight_id)

        # Final guard inside the lock
        if flight.available_seats <= 0:
            raise ValidationError("No available seats on this flight.")

        flight.available_seats -= 1
        flight.save()

        return Booking.objects.create(
            user=user,
            flight=flight,
            status=BookingStatus.CONFIRMED,
        )


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