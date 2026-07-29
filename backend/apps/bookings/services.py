from django.db import transaction, DatabaseError
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Booking, BookingStatus, Passenger
from apps.flights.models import Flight, FlightStatus
from apps.waitlist.services import process_waitlist_allocations

def create_booking(flight_id, user, passengers_data, cabin_class=None):
    """
    Creates a confirmed booking for the given user and flight, along with passenger details.
    
    Args:
        flight_id: UUID of the legacy Flight record.
        user: The User object making the booking.
        passengers_data: List of passenger dicts with name/age/gender/phone_number.
        cabin_class: Optional cabin class string ('ECONOMY', 'BUSINESS', 'FIRST').
                     Used to look up per-class pricing from the Fare model.
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

        # Determine per-passenger price and resolve FlightInstance for seat assignment
        price_per_pax = flight.base_fare  # default fallback
        fare_obj = None
        flight_instance = None

        if cabin_class:
            try:
                from apps.flights.models import FlightRoute, FlightInstance, Fare, Seat, SeatStatus
                route = FlightRoute.objects.filter(flight_no=flight.flight_number).first()
                if route:
                    flight_instance = (
                        FlightInstance.objects
                        .filter(flight=route, scheduled_departure=flight.departure_time)
                        .first()
                    )
                    if not flight_instance:
                        flight_instance = (
                            FlightInstance.objects
                            .filter(flight=route)
                            .order_by('scheduled_departure')
                            .first()
                        )
                    if flight_instance:
                        fare_obj = Fare.objects.select_for_update().filter(
                            flight_instance=flight_instance,
                            cabin_class=cabin_class
                        ).first()
                        if fare_obj:
                            price_per_pax = fare_obj.price
                            # Count real AVAILABLE seats in the Seat table (source of truth)
                            real_available = flight_instance.seats.filter(
                                seat_class=cabin_class,
                                status=SeatStatus.AVAILABLE
                            ).count()
                            if real_available < seat_count:
                                raise ValidationError(
                                    f"Only {real_available} {cabin_class.lower()} seat(s) available."
                                )
            except ValidationError:
                raise
            except Exception:
                pass  # fall back to base_fare silently if new schema not set up

        # Deduct legacy available_seats counter
        flight.available_seats -= seat_count
        Flight.objects.filter(pk=flight.pk).update(available_seats=flight.available_seats)

        booking_kwargs = {
            "user": user,
            "flight": flight,
            "status": BookingStatus.CONFIRMED,
            "seat_count": seat_count,
            "total_price": price_per_pax * seat_count,
        }
        if cabin_class:
            booking_kwargs["cabin_class"] = cabin_class

        booking = Booking.objects.create(**booking_kwargs)

        # Auto-assign seats from the Seat table (FIFO order)
        assigned_seats = []
        if flight_instance and cabin_class:
            try:
                from apps.flights.models import Seat, SeatStatus
                available_seat_qs = flight_instance.seats.select_for_update().filter(
                    seat_class=cabin_class,
                    status=SeatStatus.AVAILABLE
                ).order_by('seat_number')[:seat_count]
                for seat_obj in available_seat_qs:
                    seat_obj.status = SeatStatus.BOOKED
                    seat_obj.save(update_fields=['status'])
                    assigned_seats.append(seat_obj.seat_number)
                # Keep Fare.available_seats in sync
                if fare_obj:
                    fare_obj.available_seats = max(0, fare_obj.available_seats - len(assigned_seats))
                    fare_obj.save(update_fields=['available_seats'])
            except Exception:
                pass  # seat assignment is best-effort; booking still succeeds

        for idx, p_data in enumerate(passengers_data):
            seat_num = assigned_seats[idx] if idx < len(assigned_seats) else None
            Passenger.objects.create(
                booking=booking,
                name=p_data['name'],
                age=p_data['age'],
                gender=p_data['gender'],
                phone_number=p_data.get('phone_number', ''),
                seat_number=seat_num,
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

    # Increment available seats on the flight (lock row to prevent race conditions).
    # Use update_fields to skip full_clean() and the status-change notification check.
    flight = Flight.objects.select_for_update().get(id=booking.flight_id)
    flight.available_seats += booking.seat_count
    Flight.objects.filter(pk=flight.pk).update(available_seats=flight.available_seats)

    # Also restore Fare.available_seats if this booking had a specific cabin_class
    if booking.cabin_class:
        try:
            from apps.flights.models import FlightRoute, FlightInstance, Fare, Seat, SeatStatus
            route = FlightRoute.objects.filter(flight_no=booking.flight.flight_number).first()
            if route:
                instance = (
                    FlightInstance.objects
                    .filter(flight=route, scheduled_departure=booking.flight.departure_time)
                    .first()
                )
                if not instance:
                    instance = (
                        FlightInstance.objects
                        .filter(flight=route)
                        .order_by('scheduled_departure')
                        .first()
                    )
                if instance:
                    # Free up passenger seats in Seat table
                    passenger_seats = [p.seat_number for p in booking.passengers.all() if p.seat_number]
                    if passenger_seats:
                        seats_to_free = instance.seats.select_for_update().filter(
                            seat_number__in=passenger_seats,
                            status=SeatStatus.BOOKED
                        )
                        for seat_obj in seats_to_free:
                            seat_obj.status = SeatStatus.AVAILABLE
                            seat_obj.save(update_fields=['status'])

                    fare_obj = Fare.objects.select_for_update().filter(
                        flight_instance=instance,
                        cabin_class=booking.cabin_class
                    ).first()
                    if fare_obj:
                        total_physical = Seat.objects.filter(
                            flight_instance=instance,
                            seat_class=booking.cabin_class
                        ).count()
                        fare_obj.available_seats = min(
                            fare_obj.available_seats + booking.seat_count,
                            total_physical
                        )
                        fare_obj.save(update_fields=['available_seats'])
        except Exception:
            pass

    # Trigger waitlist auto-allocation for the specific class if applicable
    process_waitlist_allocations(flight, booking.cabin_class)

    return booking