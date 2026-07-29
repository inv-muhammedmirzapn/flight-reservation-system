from django.db import transaction
from apps.bookings.models import Booking, BookingStatus
from .models import WaitlistEntry, WaitlistStatus


@transaction.atomic
def process_waitlist_allocations(flight, cancelled_cabin_class=None):
    """
    Called when available seats on a flight increase (due to cancellation).
    Scans the waitlist queue in FIFO order (by created_at) and allocates
    seats to pending entries that can be fully accommodated by the available seats.
    """
    # Lock the flight row to ensure available_seats is accurate and not modified concurrently
    from apps.flights.models import Flight
    flight = Flight.objects.select_for_update().get(id=flight.id)

    if flight.available_seats <= 0:
        return

    # Select pending entries for update to prevent concurrent allocation conflicts
    qs = WaitlistEntry.objects.filter(flight=flight, status=WaitlistStatus.PENDING).order_by("created_at")
    # Strict queue position hierarchy (FIFO order)
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
        pass

    for entry in pending_entries:
        # Check specific fare availability if entry has a cabin class
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
                pass
                
        if not entry.cabin_class:
            # No class preference — use generic flight-level seat count
            if flight.available_seats >= entry.seat_count:
                has_seats = True
        else:
            # Class-specific: check fare_obj first
            if fare_obj and fare_obj.available_seats >= entry.seat_count:
                has_seats = True
            # If fare_obj not found (no Fare row), fall back to flight-level count
            elif not fare_obj and flight.available_seats >= entry.seat_count:
                has_seats = True
            # else: fare_obj exists but insufficient seats → skip this entry

        if has_seats:
            # Deduct seats — use .update() to bypass full_clean() constraints
            Flight.objects.filter(pk=flight.pk).update(available_seats=flight.available_seats - entry.seat_count)
            flight.available_seats -= entry.seat_count  # keep local obj in sync
            
            if fare_obj:
                fare_obj.available_seats -= entry.seat_count
                fare_obj.save(update_fields=['available_seats'])

            # Create confirmed booking
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

            # Auto-assign seats and copy passengers from WaitlistEntry
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
                    pass

            from apps.bookings.models import Passenger
            for idx, wp in enumerate(entry.passengers.all()):
                Passenger.objects.create(
                    booking=booking,
                    name=wp.name,
                    age=wp.age,
                    gender=wp.gender,
                    phone_number=wp.phone_number,
                    seat_number=assigned_seats[idx] if idx < len(assigned_seats) else None,
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