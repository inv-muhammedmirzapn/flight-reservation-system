import logging
from django.db import transaction, DatabaseError
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import Booking, BookingStatus, Passenger
from apps.flights.models import FlightInstance, InstanceStatus, Fare, Seat, SeatStatus

logger = logging.getLogger(__name__)


def _resolve_flight_instance(flight_id) -> FlightInstance:
    """
    Resolve a FlightInstance from an integer PK.
    Raises ValidationError if not found.
    """
    try:
        return FlightInstance.objects.select_related(
            'flight', 'flight__airline', 'aircraft'
        ).get(pk=int(flight_id))
    except (FlightInstance.DoesNotExist, ValueError, TypeError):
        raise ValidationError("Flight not found.")


def create_booking(flight_id, user, passengers_data, cabin_class=None):
    """
    Creates a confirmed booking for the given user and FlightInstance.

    Args:
        flight_id: Integer PK of the FlightInstance.
        user: The User object making the booking.
        passengers_data: List of passenger dicts with name/age/gender/phone_number.
        cabin_class: Optional cabin class string ('ECONOMY', 'BUSINESS', 'FIRST').
    """
    seat_count = len(passengers_data)

    # ── Pre-validate outside any transaction ─────────────────────────────────
    flight_instance = _resolve_flight_instance(flight_id)

    if flight_instance.status in [
        InstanceStatus.CANCELLED, InstanceStatus.DEPARTED,
        InstanceStatus.ARRIVED, InstanceStatus.BOARDING,
    ]:
        raise ValidationError(
            f"Cannot book a flight that is already {flight_instance.status.lower()}."
        )

    if flight_instance.scheduled_departure < timezone.now():
        raise ValidationError("Cannot book a flight that has already departed.")

    # Seat availability check (use Seat table as source of truth)
    if cabin_class:
        available_count = flight_instance.seats.filter(
            seat_class=cabin_class, status=SeatStatus.AVAILABLE
        ).count()
        if available_count < seat_count:
            raise ValidationError(
                f"Only {available_count} {cabin_class.lower()} seat(s) available on this flight."
            )
    else:
        available_count = flight_instance.seats.filter(status=SeatStatus.AVAILABLE).count()
        if available_count < seat_count:
            raise ValidationError(
                f"Only {available_count} seats available on this flight."
            )

    # Validate passenger data
    for p in passengers_data:
        name = str(p.get('name', '') or '').strip()
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

        extra_kg = p.get('extra_baggage_kg', 0) or 0
        try:
            from decimal import Decimal
            extra_kg_dec = Decimal(str(extra_kg))
            if extra_kg_dec < 0:
                raise ValidationError("Extra baggage weight cannot be negative.")
            max_allowed = flight_instance.flight.max_extra_baggage_kg_per_person
            if extra_kg_dec > max_allowed:
                raise ValidationError(f"Extra baggage cannot exceed {max_allowed} kg per passenger.")
        except (ValueError, TypeError):
            raise ValidationError("Extra baggage weight must be a valid number.")

    # ── Atomic write: re-check with lock, then create ─────────────────────────
    with transaction.atomic():
        # Lock the flight instance row to prevent race conditions
        try:
            flight_instance = FlightInstance.objects.select_for_update(nowait=False).get(
                pk=flight_instance.pk
            )
        except FlightInstance.DoesNotExist:
            raise ValidationError("Flight not found.")
        except DatabaseError:
            try:
                flight_instance = FlightInstance.objects.get(pk=flight_instance.pk)
            except FlightInstance.DoesNotExist:
                raise ValidationError("Flight not found.")

        # Lock available seats and get per-class price
        fare_obj = None
        price_per_pax = 0

        if cabin_class:
            fare_obj = Fare.objects.select_for_update().filter(
                flight_instance=flight_instance,
                cabin_class=cabin_class
            ).first()
            if fare_obj:
                price_per_pax = fare_obj.price

            # Final guard inside the lock
            real_available = flight_instance.seats.filter(
                seat_class=cabin_class, status=SeatStatus.AVAILABLE
            ).count()
            if real_available < seat_count:
                raise ValidationError(
                    f"Only {real_available} {cabin_class.lower()} seat(s) available."
                )
        else:
            real_available = flight_instance.seats.filter(status=SeatStatus.AVAILABLE).count()
            if real_available < seat_count:
                raise ValidationError(
                    f"Only {real_available} seats available on this flight."
                )

        booking_kwargs = {
            "user": user,
            "flight": flight_instance,
            "status": BookingStatus.CONFIRMED,
            "seat_count": seat_count,
            "total_price": price_per_pax * seat_count,
        }
        if cabin_class:
            booking_kwargs["cabin_class"] = cabin_class

        booking = Booking.objects.create(**booking_kwargs)

        # Auto-assign seats from the Seat table (FIFO order)
        assigned_seats = []
        seat_filter_kwargs = {"status": SeatStatus.AVAILABLE}
        if cabin_class:
            seat_filter_kwargs["seat_class"] = cabin_class

        available_seat_qs = (
            flight_instance.seats
            .select_for_update()
            .filter(**seat_filter_kwargs)
            .order_by('seat_number')[:seat_count]
        )
        for seat_obj in available_seat_qs:
            seat_obj.status = SeatStatus.BOOKED
            seat_obj.save(update_fields=['status'])
            assigned_seats.append(seat_obj.seat_number)

        # Keep Fare.available_seats in sync
        if fare_obj and assigned_seats:
            fare_obj.available_seats = max(0, fare_obj.available_seats - len(assigned_seats))
            fare_obj.save(update_fields=['available_seats'])

        from decimal import Decimal
        from apps.flights.services_currency import CurrencyService
        route = flight_instance.flight
        booking_curr = fare_obj.currency if fare_obj else "INR"
        baggage_unit_rate = CurrencyService.convert_amount(
            route.extra_baggage_price_per_kg,
            route.extra_baggage_currency,
            booking_curr
        )

        total_meal_cost = Decimal("0.00")
        total_extra_baggage_cost = Decimal("0.00")

        for idx, p_data in enumerate(passengers_data):
            seat_num = assigned_seats[idx] if idx < len(assigned_seats) else None
            p_extra_kg = Decimal(str(p_data.get('extra_baggage_kg', 0) or 0))
            p_extra_cost = p_extra_kg * baggage_unit_rate
            total_extra_baggage_cost += p_extra_cost

            passenger_obj = Passenger.objects.create(
                booking=booking,
                name=p_data['name'],
                age=p_data['age'],
                gender=p_data['gender'],
                phone_number=p_data.get('phone_number', ''),
                meal_preference=p_data.get('meal_preference', 'NONE'),
                seat_number=seat_num,
                extra_baggage_kg=p_extra_kg,
                extra_baggage_cost=p_extra_cost,
            )

            complimentary_waived = False
            selected_meals_data = p_data.get('selected_meals', []) or []
            if isinstance(selected_meals_data, list):
                for meal_input in selected_meals_data:
                    food_item_id = meal_input.get('food_item_id')
                    flight_meal_id = meal_input.get('flight_meal_id')
                    flight_leg_id = meal_input.get('flight_leg_id')
                    qty = int(meal_input.get('quantity', 1) or 1)

                    if qty <= 0:
                        raise ValidationError("Meal quantity must be at least 1.")

                    if food_item_id and flight_meal_id:
                        raise ValidationError("Cannot select both food item and combo meal in a single entry.")
                    if not food_item_id and not flight_meal_id:
                        raise ValidationError("Must select either a food item or a combo meal.")

                    from apps.flights.models import FoodItem, FlightMeal, FlightLeg

                    food_item_obj = None
                    flight_meal_obj = None
                    flight_leg_obj = None
                    base_price = 0

                    if food_item_id:
                        try:
                            food_item_obj = FoodItem.objects.get(
                                pk=int(food_item_id),
                                airline=flight_instance.flight.airline
                            )
                            base_price = food_item_obj.price
                        except (FoodItem.DoesNotExist, ValueError):
                            raise ValidationError(f"Invalid food item ID: {food_item_id} for this flight's airline.")

                    if flight_meal_id:
                        try:
                            flight_meal_obj = FlightMeal.objects.get(pk=int(flight_meal_id), flight_instance=flight_instance)
                            base_price = flight_meal_obj.price
                        except (FlightMeal.DoesNotExist, ValueError):
                            raise ValidationError(f"Invalid combo meal ID: {flight_meal_id}")

                    if flight_leg_id:
                        try:
                            flight_leg_obj = FlightLeg.objects.get(pk=int(flight_leg_id), flight=flight_instance.flight)
                        except (FlightLeg.DoesNotExist, ValueError):
                            raise ValidationError(f"Invalid flight leg ID: {flight_leg_id}")

                    from .models import PassengerMeal
                    unit_price = base_price

                    if fare_obj and fare_obj.meal_included and not complimentary_waived:
                        if qty == 1:
                            unit_price = 0
                            complimentary_waived = True
                            PassengerMeal.objects.create(
                                passenger=passenger_obj,
                                flight_leg=flight_leg_obj,
                                food_item=food_item_obj,
                                flight_meal=flight_meal_obj,
                                quantity=1,
                                unit_price=0
                            )
                        else:
                            PassengerMeal.objects.create(
                                passenger=passenger_obj,
                                flight_leg=flight_leg_obj,
                                food_item=food_item_obj,
                                flight_meal=flight_meal_obj,
                                quantity=1,
                                unit_price=0
                            )
                            PassengerMeal.objects.create(
                                passenger=passenger_obj,
                                flight_leg=flight_leg_obj,
                                food_item=food_item_obj,
                                flight_meal=flight_meal_obj,
                                quantity=qty - 1,
                                unit_price=base_price
                            )
                            total_meal_cost += (base_price * (qty - 1))
                            complimentary_waived = True
                    else:
                        PassengerMeal.objects.create(
                            passenger=passenger_obj,
                            flight_leg=flight_leg_obj,
                            food_item=food_item_obj,
                            flight_meal=flight_meal_obj,
                            quantity=qty,
                            unit_price=unit_price
                        )
                        total_meal_cost += (unit_price * qty)

        # Update final booking total price including meals and extra baggage
        additions = total_meal_cost + total_extra_baggage_cost
        if additions > 0:
            booking.total_price = booking.total_price + additions
            booking.save(update_fields=['total_price'])

        try:
            from apps.notifications.services import NotificationService
            NotificationService.send_booking_confirmation(booking)
        except Exception:
            logger.exception("Failed to send booking confirmation notification")

        return booking


@transaction.atomic
def cancel_booking(booking_id, user):
    """
    Cancels a booking, frees the Seat rows and restores Fare.available_seats,
    then triggers waitlist auto-allocation.
    """
    try:
        booking = Booking.objects.select_for_update().get(id=booking_id, user=user)
    except Booking.DoesNotExist:
        raise ValidationError("Booking not found.")

    if booking.status == BookingStatus.CANCELLED:
        raise ValidationError("Booking is already cancelled.")

    booking.status = BookingStatus.CANCELLED
    booking.save()

    try:
        from apps.notifications.services import NotificationService
        NotificationService.send_booking_cancellation(booking)
    except Exception:
        logger.exception("Failed to send booking cancellation notification")

    # Free up passenger seats in the Seat table
    flight_instance = booking.flight
    passenger_seats = [p.seat_number for p in booking.passengers.all() if p.seat_number]
    if passenger_seats:
        seats_to_free = flight_instance.seats.select_for_update().filter(
            seat_number__in=passenger_seats, status=SeatStatus.BOOKED
        )
        for seat_obj in seats_to_free:
            seat_obj.status = SeatStatus.AVAILABLE
            seat_obj.save(update_fields=['status'])

    # Restore Fare.available_seats
    if booking.cabin_class:
        fare_obj = Fare.objects.select_for_update().filter(
            flight_instance=flight_instance,
            cabin_class=booking.cabin_class
        ).first()
        if fare_obj:
            total_physical = Seat.objects.filter(
                flight_instance=flight_instance,
                seat_class=booking.cabin_class,
            ).count()
            fare_obj.available_seats = min(
                fare_obj.available_seats + booking.seat_count,
                total_physical,
            )
            fare_obj.save(update_fields=['available_seats'])

    # Trigger waitlist auto-allocation
    from apps.waitlist.services import process_waitlist_allocations
    process_waitlist_allocations(flight_instance, booking.cabin_class)

    return booking