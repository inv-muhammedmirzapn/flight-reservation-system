from django.db import transaction, DatabaseError
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Booking, BookingStatus, Passenger
from apps.flights.models import Flight, FlightStatus
from apps.waitlist.services import process_waitlist_allocations

def create_booking(flight_id, user, passengers_data):
    """
    Creates a confirmed booking for the given user and flight, along with passenger details.
    """
    seat_count = len(passengers_data)
    
    # ── Pre-validate outside any transaction ───────────────────────────────
    try:
        flight = Flight.objects.get(id=flight_id)
    except Flight.DoesNotExist:
        raise ValidationError("Flight not found.")

    if flight.status in [FlightStatus.CANCELLED, FlightStatus.DEPARTED, FlightStatus.ARRIVED, FlightStatus.BOARDING]:
        raise ValidationError(f"Cannot book a flight that is already {flight.status.lower()}.")

    if flight.departure_time < timezone.now():
        raise ValidationError("Cannot book a flight that has already departed.")

    if flight.available_seats < seat_count:
        raise ValidationError(f"Only {flight.available_seats} seats available on this flight.")

    if Booking.objects.filter(
        user=user, flight=flight, status=BookingStatus.CONFIRMED
    ).exists():
        raise ValidationError("You already have a confirmed booking for this flight.")

    # Validate passenger data
    for p in passengers_data:
        name = p.get('name', '')
        if isinstance(name, str):
            name = name.strip()
        age = p.get('age')
        gender = p.get('gender')

        if not name or not age or not gender:
            raise ValidationError("Name, age, and gender are required for all passengers.")
            
        if len(name) < 2:
            raise ValidationError("Passenger name must be at least 2 characters.")
            
        try:
            age_int = int(age)
            if age_int < 1 or age_int > 120:
                raise ValidationError("Passenger age must be between 1 and 120.")
        except (ValueError, TypeError):
            raise ValidationError("Passenger age must be a valid number.")
            
        if gender not in ['M', 'F', 'O']:
            raise ValidationError("Gender must be 'M', 'F', or 'O'.")

    # ── Atomic write: re-check with lock, then create ───────────────────────
    with transaction.atomic():
        try:
            flight = Flight.objects.select_for_update(nowait=False).get(id=flight_id)
        except (Flight.DoesNotExist, DatabaseError):
            flight = Flight.objects.get(id=flight_id)

        # Final guard inside the lock
        if flight.available_seats < seat_count:
            raise ValidationError(f"Only {flight.available_seats} seats available on this flight.")

        flight.available_seats -= seat_count
        flight.save()

        booking = Booking.objects.create(
            user=user,
            flight=flight,
            status=BookingStatus.CONFIRMED,
            seat_count=seat_count,
            total_price=flight.base_fare * seat_count,
        )

        for p_data in passengers_data:
            Passenger.objects.create(
                booking=booking,
                name=p_data['name'],
                age=p_data['age'],
                gender=p_data['gender'],
                phone_number=p_data.get('phone_number', '')
            )

        try:
            from apps.notifications.services import NotificationService
            NotificationService.send_booking_confirmation(booking)
        except Exception:
            pass
            
        return booking


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

    try:
        from apps.notifications.services import NotificationService
        NotificationService.send_booking_cancellation(booking)
    except Exception:
        pass

    # Increment available seats on the flight (lock row to prevent race conditions)
    flight = Flight.objects.select_for_update().get(id=booking.flight_id)
    flight.available_seats += booking.seat_count
    flight.save()

    # Trigger waitlist auto-allocation
    process_waitlist_allocations(flight)

    return booking