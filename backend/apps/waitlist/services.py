import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.bookings.models import Booking, BookingStatus, Passenger
from .models import WaitlistEntry, WaitlistStatus

logger = logging.getLogger(__name__)



# ---------------------------------------------------------------------------
# Existing: auto-allocation on seat release
# ---------------------------------------------------------------------------

@transaction.atomic
def process_waitlist_allocations(flight, cancelled_cabin_class=None):
    """
    Called when available seats on a flight increase (due to cancellation).
    Scans the waitlist queue in FIFO order (by created_at) and allocates
    seats to pending entries that can be fully accommodated by the available seats.
    """
    from apps.flights.models import Flight
    flight = Flight.objects.select_for_update().get(id=flight.id)

    if flight.available_seats <= 0:
        return

    qs = WaitlistEntry.objects.filter(flight=flight, status=WaitlistStatus.PENDING).order_by("created_at")
    pending_entries = list(qs.select_for_update())

    # Resolve the flight instance once for this flight
    instance = None
    try:
        from apps.flights.models import FlightRoute, FlightInstance
        route = FlightRoute.objects.filter(flight_no=flight.flight_number).first()
        if route:
            instance = (
                FlightInstance.objects
                .filter(flight=route, scheduled_departure=flight.departure_time)
                .first()
            )
            if not instance:
                instance = (
                    FlightInstance.objects
                    .filter(flight=route)
                    .order_by('scheduled_departure')
                    .first()
                )
    except Exception:
        logger.exception("Error resolving flight instance for waitlist allocation")

    for entry in pending_entries:
        fare_obj = None
        has_seats = False

        if entry.cabin_class and instance:
            try:
                from apps.flights.models import Fare
                fare_obj = Fare.objects.select_for_update().filter(
                    flight_instance=instance,
                    cabin_class=entry.cabin_class
                ).first()
                if fare_obj and fare_obj.available_seats >= entry.seat_count:
                    has_seats = True
            except Exception:
                logger.exception("Error resolving fare_obj during waitlist allocation")

        if not entry.cabin_class:
            if flight.available_seats >= entry.seat_count:
                has_seats = True
        else:
            if fare_obj and fare_obj.available_seats >= entry.seat_count:
                has_seats = True
            elif not fare_obj and flight.available_seats >= entry.seat_count:
                has_seats = True

        if has_seats:
            Flight.objects.filter(pk=flight.pk).update(available_seats=flight.available_seats - entry.seat_count)
            flight.available_seats -= entry.seat_count

            if fare_obj:
                fare_obj.available_seats -= entry.seat_count
                fare_obj.save(update_fields=['available_seats'])

            booking_kwargs = {
                "user": entry.user,
                "flight": flight,
                "seat_count": entry.seat_count,
                "total_price": entry.price,
                "status": BookingStatus.CONFIRMED,
            }
            if entry.cabin_class:
                booking_kwargs["cabin_class"] = entry.cabin_class
            booking = Booking.objects.create(**booking_kwargs)

            assigned_seats = []
            target_class = entry.cabin_class or 'ECONOMY'
            if instance:
                try:
                    from apps.flights.models import SeatStatus
                    avail_seats = instance.seats.select_for_update().filter(
                        seat_class=target_class,
                        status=SeatStatus.AVAILABLE
                    ).order_by('seat_number')[:entry.seat_count]
                    for seat_obj in avail_seats:
                        seat_obj.status = SeatStatus.BOOKED
                        seat_obj.save(update_fields=['status'])
                        assigned_seats.append(seat_obj.seat_number)
                except Exception:
                    logger.exception("Error auto-assigning seats during waitlist allocation")

            for idx, wp in enumerate(entry.passengers.all()):
                Passenger.objects.create(
                    booking=booking,
                    name=wp.name,
                    age=wp.age,
                    gender=wp.gender,
                    phone_number=wp.phone_number,
                    seat_number=assigned_seats[idx] if idx < len(assigned_seats) else None,
                )

            entry.status = WaitlistStatus.CONFIRMED
            entry.booking = booking
            entry.save()

            try:
                from apps.notifications.services import NotificationService
                NotificationService.send_waitlist_allocation(booking)
            except Exception:
                logger.exception("Failed to send waitlist allocation notification")

            if flight.available_seats == 0:
                break


# ---------------------------------------------------------------------------
# Helpers shared across join / promote
# ---------------------------------------------------------------------------

def _resolve_fare_and_availability(flight, cabin_class):
    """
    Return (available_seats, price_per_pax) for *cabin_class* on *flight*.
    Falls back to flight-level values when no Fare row is found.
    """
    available_seats = flight.available_seats
    price_per_pax   = flight.base_fare

    if not cabin_class:
        return available_seats, price_per_pax

    try:
        from apps.flights.models import FlightRoute, FlightInstance, Fare
        route = FlightRoute.objects.filter(flight_no=flight.flight_number).first()
        if not route:
            return available_seats, price_per_pax
        instance = (
            FlightInstance.objects
            .filter(flight=route, scheduled_departure=flight.departure_time)
            .first()
        ) or (
            FlightInstance.objects
            .filter(flight=route)
            .order_by('scheduled_departure')
            .first()
        )
        if instance:
            fare_obj = Fare.objects.filter(
                flight_instance=instance, cabin_class=cabin_class
            ).first()
            if fare_obj:
                available_seats = fare_obj.available_seats
                price_per_pax   = fare_obj.price
    except Exception:
        logger.exception("Error resolving fare and availability")

    return available_seats, price_per_pax


def _validate_passengers(passengers_data: list) -> str | None:
    """
    Validate each passenger dict.
    Returns an error message string on the first failure, or None if all valid.
    """
    for p in passengers_data:
        name   = str(p.get('name', '') or '').strip()
        age    = p.get('age')
        gender = p.get('gender')

        if not name or not age or not gender:
            return 'Name, age, and gender are required for all passengers.'
        if len(name) < 2:
            return 'Passenger name must be at least 2 characters.'
        try:
            age_int = int(age)
            if age_int < 1 or age_int > 120:
                return 'Passenger age must be between 1 and 120.'
        except (ValueError, TypeError):
            return 'Passenger age must be a valid number.'
        if gender not in ('M', 'F', 'O'):
            return "Gender must be 'M', 'F', or 'O'."
    return None


# ---------------------------------------------------------------------------
# Join waitlist
# ---------------------------------------------------------------------------

class WaitlistError(Exception):
    """Raised by service functions to signal a business-rule violation."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def join_waitlist(user, flight_id: int, passengers_data: list, cabin_class: str | None) -> WaitlistEntry:
    """
    Validate all business rules and create a new WaitlistEntry + WaitlistPassenger rows.

    Raises WaitlistError on any rule violation.
    """
    from apps.flights.models import Flight, CabinClass

    # --- resolve flight ---
    try:
        flight = Flight.objects.get(id=flight_id)
    except (Flight.DoesNotExist, ValueError):
        raise WaitlistError("Flight not found.", status_code=404)

    # --- flight must not have departed ---
    if flight.departure_time <= timezone.now():
        raise WaitlistError("Cannot join the waitlist for a flight that has already departed.")

    # --- cabin class ---
    if cabin_class and cabin_class not in dict(CabinClass.choices):
        raise WaitlistError("Invalid cabin class.")

    # --- passenger count ---
    seat_count = len(passengers_data)
    if seat_count < 1 or seat_count > 9:
        raise WaitlistError("Seat count must be between 1 and 9 seats.")

    # --- passenger field validation ---
    passenger_error = _validate_passengers(passengers_data)
    if passenger_error:
        raise WaitlistError(passenger_error)

    # --- resolve availability for this class ---
    available_seats, price_per_pax = _resolve_fare_and_availability(flight, cabin_class)

    # --- flight must actually be full for this class ---
    if available_seats >= seat_count:
        msg = (
            "Waitlist tickets cannot be booked as there are enough available seats for this class"
            if cabin_class else
            "Waitlist tickets cannot be booked on the flight as there are enough available seats"
        )
        raise WaitlistError(msg)

    # --- no duplicate pending entry ---
    if WaitlistEntry.objects.filter(
        user=user, flight=flight, status=WaitlistStatus.PENDING
    ).exists():
        raise WaitlistError("You are already on the waitlist for this flight")

    # --- create entry and passengers ---
    entry_kwargs = {
        "user":       user,
        "flight":     flight,
        "seat_count": seat_count,
        "price":      price_per_pax * seat_count,
        "status":     WaitlistStatus.PENDING,
    }
    if cabin_class:
        entry_kwargs["cabin_class"] = cabin_class

    entry = WaitlistEntry.objects.create(**entry_kwargs)

    from .models import WaitlistPassenger
    for p in passengers_data:
        WaitlistPassenger.objects.create(
            waitlist_entry=entry,
            name=p['name'],
            age=p['age'],
            gender=p['gender'],
            phone_number=p.get('phone_number', ''),
        )

    return entry


# ---------------------------------------------------------------------------
# Cancel waitlist entry
# ---------------------------------------------------------------------------

def cancel_waitlist_entry(entry: WaitlistEntry) -> dict:
    """
    Cancel *entry* and compute refund amounts (95 % refund, 5 % processing fee).

    Raises WaitlistError if the entry is not pending.
    Returns a dict with refund details.
    """
    if entry.status != WaitlistStatus.PENDING:
        raise WaitlistError("Only pending waitlist entries can be cancelled.")

    entry.status = WaitlistStatus.CANCELLED
    entry.save()

    price           = entry.price
    processing_fee  = round(price * Decimal("0.05"), 2)
    refund_amount   = round(price * Decimal("0.95"), 2)

    # Notify user
    try:
        from apps.notifications.services import NotificationService
        NotificationService.send_waitlist_cancellation(entry.user, entry.flight, refund_amount)
    except Exception:
        logger.exception("Failed to create waitlist cancellation notification")

    return {
        "refund_amount":  refund_amount,
        "processing_fee": processing_fee,
        "status":         entry.status,
    }


# ---------------------------------------------------------------------------
# Promote waitlist entry → confirmed booking  (admin action)
# ---------------------------------------------------------------------------

@transaction.atomic
def promote_waitlist_entry(entry: WaitlistEntry) -> Booking:
    """
    Manually promote a pending waitlist entry to a confirmed booking.
    Handles locking, seat deduction, Booking creation, and notification.

    Raises WaitlistError on rule violations.
    """
    if entry.status != WaitlistStatus.PENDING:
        raise WaitlistError("Only pending waitlist entries can be promoted.")

    from apps.flights.models import Flight

    flight   = Flight.objects.select_for_update().get(id=entry.flight_id)
    fare_obj = None

    if entry.cabin_class:
        try:
            from apps.flights.models import FlightRoute, FlightInstance, Fare
            route = FlightRoute.objects.filter(flight_no=flight.flight_number).first()
            if route:
                instance = (
                    FlightInstance.objects
                    .filter(flight=route, scheduled_departure=flight.departure_time)
                    .first()
                ) or (
                    FlightInstance.objects
                    .filter(flight=route)
                    .order_by('scheduled_departure')
                    .first()
                )
                if instance:
                    fare_obj = Fare.objects.select_for_update().filter(
                        flight_instance=instance,
                        cabin_class=entry.cabin_class,
                    ).first()
        except Exception:
            logger.exception("Error resolving fare_obj during waitlist promotion")

    # --- seat availability check ---
    if fare_obj:
        if fare_obj.available_seats < entry.seat_count:
            raise WaitlistError(
                f"Not enough available seats in {entry.cabin_class} to promote this waitlist entry."
            )
    elif flight.available_seats < entry.seat_count:
        raise WaitlistError("Not enough available seats to promote this waitlist entry.")

    # --- deduct seats ---
    flight.available_seats = F('available_seats') - entry.seat_count
    flight.save(update_fields=['available_seats'])

    if fare_obj:
        fare_obj.available_seats = F('available_seats') - entry.seat_count
        fare_obj.save(update_fields=['available_seats'])

    # --- create booking ---
    booking_kwargs = {
        "user":        entry.user,
        "flight":      flight,
        "seat_count":  entry.seat_count,
        "total_price": entry.price,
        "status":      BookingStatus.CONFIRMED,
    }
    if entry.cabin_class:
        booking_kwargs["cabin_class"] = entry.cabin_class

    booking = Booking.objects.create(**booking_kwargs)

    entry.status  = WaitlistStatus.CONFIRMED
    entry.booking = booking
    entry.save(update_fields=['status', 'booking'])

    # --- notify user ---
    try:
        from apps.notifications.services import NotificationService
        NotificationService.send_waitlist_allocation(booking)
    except Exception:
        logger.exception("Failed to send waitlist promotion notification")

    return booking


def expire_departed_waitlist_entries(user=None):
    """
    Auto-expire pending waitlist entries whose flights have already departed.
    """
    from django.db.models import Sum
    now = timezone.now()
    qs = WaitlistEntry.objects.filter(
        status=WaitlistStatus.PENDING, flight__departure_time__lte=now
    )
    if user and not (user.is_staff or user.is_superuser):
        qs = qs.filter(user=user)
    return qs.update(status=WaitlistStatus.EXPIRED)


def get_waitlist_passenger_count(flight_id):
    """
    Get the total count of pending waitlisted passengers for a given flight.
    """
    from django.db.models import Sum
    result = WaitlistEntry.objects.filter(
        flight_id=flight_id, status=WaitlistStatus.PENDING
    ).aggregate(total=Sum("seat_count"))
    return result["total"] or 0