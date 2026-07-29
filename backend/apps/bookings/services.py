from django.db import transaction, DatabaseError
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Booking, BookingStatus, Passenger
from apps.flights.models import FlightInstance, InstanceStatus, Seat, SeatStatus, Fare, CabinClass
from decimal import Decimal
from apps.waitlist.services import process_waitlist_allocations

def create_booking(flight_id, user, passengers_data, requested_class=None):
    """
    Creates a confirmed booking for the given user and flight, along with passenger details.
    """
    seat_count = len(passengers_data)
    
    # ── Pre-validate outside any transaction ───────────────────────────────
    try:
        flight = FlightInstance.objects.get(id=flight_id)
    except FlightInstance.DoesNotExist:
        raise ValidationError("Flight not found.")

    if flight.status in [InstanceStatus.CANCELLED, InstanceStatus.DEPARTED, InstanceStatus.ARRIVED, InstanceStatus.BOARDING]:
        raise ValidationError(f"Cannot book a flight that is already {flight.status.lower()}.")

    if flight.scheduled_departure < timezone.now():
        raise ValidationError("Cannot book a flight that has already departed.")

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
            flight = FlightInstance.objects.select_for_update(nowait=False).get(id=flight_id)
        except (FlightInstance.DoesNotExist, DatabaseError):
            flight = FlightInstance.objects.get(id=flight_id)

        seats_to_book = []
        total_price = Decimal("0.00")

        for p_data in passengers_data:
            seat_id = p_data.get('seat_id')
            if seat_id:
                try:
                    seat = Seat.objects.select_for_update().get(id=seat_id, flight_instance=flight, status=SeatStatus.AVAILABLE)
                except Seat.DoesNotExist:
                    raise ValidationError(f"Seat {seat_id} is not available.")
            else:
                query_class = requested_class if requested_class else CabinClass.ECONOMY
                seat = Seat.objects.filter(flight_instance=flight, status=SeatStatus.AVAILABLE, seat_class=query_class).select_for_update().first()
                if not seat:
                    raise ValidationError(f"Not enough {query_class} seats available on this flight.")
            
            seats_to_book.append(seat)
            
            fare = Fare.objects.filter(flight_instance=flight, cabin_class=seat.seat_class).first()
            if fare:
                total_price += fare.price
            else:
                total_price += Decimal("5000.00")
                
            seat.status = SeatStatus.BOOKED
            seat.save(update_fields=['status'])

        for fare in flight.fares.all():
            fare.available_seats = flight.seats.filter(seat_class=fare.cabin_class, status=SeatStatus.AVAILABLE).count()
            fare.save(update_fields=["available_seats"])

        booking = Booking.objects.create(
            user=user,
            flight=flight,
            status=BookingStatus.CONFIRMED,
            seat_count=seat_count,
            total_price=total_price,
        )

        for p_data, seat in zip(passengers_data, seats_to_book):
            Passenger.objects.create(
                booking=booking,
                name=p_data['name'],
                age=p_data['age'],
                gender=p_data['gender'],
                phone_number=p_data.get('phone_number', ''),
                seat=seat
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
    flight = FlightInstance.objects.select_for_update().get(id=booking.flight_id)
    
    for passenger in booking.passengers.all():
        if passenger.seat:
            seat = Seat.objects.select_for_update().get(id=passenger.seat.id)
            seat.status = SeatStatus.AVAILABLE
            seat.save(update_fields=['status'])
            
    for fare in flight.fares.all():
        fare.available_seats = flight.seats.filter(seat_class=fare.cabin_class, status=SeatStatus.AVAILABLE).count()
        fare.save(update_fields=["available_seats"])

    # Trigger waitlist auto-allocation
    process_waitlist_allocations(flight)

    return booking