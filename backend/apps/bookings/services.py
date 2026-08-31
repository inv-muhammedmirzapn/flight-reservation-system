import logging
from datetime import timedelta
from django.db import transaction, DatabaseError
from django.core.exceptions import ValidationError
from django.utils import timezone

BOOKING_CUTOFF_HOURS = 3  # bookings close this many hours before scheduled departure

from .models import Booking, BookingStatus, Passenger, SeatHold, SEAT_HOLD_MINUTES, Ticket
from apps.flights.models import FlightInstance, InstanceStatus, Fare, Seat, SeatStatus

logger = logging.getLogger(__name__)

def expire_stale_holds(flight_instance):
    """
    Lazy expiry: release all expired SeatHolds for a given flight instance.
    Call this before any seat availability check or seat map read.
    Runs inside the caller's transaction if one is active.
    """
    stale_holds = SeatHold.objects.select_related('seat').filter(
        flight_instance=flight_instance,
        expires_at__lt=timezone.now(),
    )
    seat_ids = list(stale_holds.values_list('seat_id', flat=True))
    if seat_ids:
        stale_holds.delete()  # cascade removes SeatHold rows
        Seat.objects.filter(id__in=seat_ids, status=SeatStatus.HELD).update(
            status=SeatStatus.AVAILABLE
        )


def hold_seat(flight_instance, seat_number, user, old_seat_number=None):
    """
    Temporarily hold a seat for a user for SEAT_HOLD_MINUTES minutes.
    If old_seat_number is provided, explicitly releases that prior seat hold.
    Supports holding multiple seats (e.g. for multi-passenger bookings) up to 10 active holds.
    Raises ValidationError if the seat is unavailable or already held.
    Returns the SeatHold instance.
    """
    MAX_HELD_SEATS_PER_USER = 10
    with transaction.atomic():
        # Lazy expiry first
        expire_stale_holds(flight_instance)

        try:
            seat = Seat.objects.select_for_update().get(
                flight_instance=flight_instance,
                seat_number=seat_number,
            )
        except Seat.DoesNotExist:
            raise ValidationError(f"Seat {seat_number} does not exist on this flight.")

        if seat.status == SeatStatus.HELD:
            # If the same user already holds it, just return the existing hold
            existing_hold = SeatHold.objects.filter(seat=seat, user=user).first()
            if existing_hold and not existing_hold.is_expired:
                return existing_hold
            raise ValidationError(f"Seat {seat_number} is currently held by another user.")

        if seat.status != SeatStatus.AVAILABLE:
            raise ValidationError(f"Seat {seat_number} is not available (status: {seat.status}).")

        # If old_seat_number is provided (e.g. user selected a different seat for a passenger), release that hold first
        if old_seat_number:
            old_holds = SeatHold.objects.select_related('seat').filter(
                flight_instance=flight_instance,
                user=user,
                seat__seat_number=old_seat_number,  
            )
            old_seat_ids = list(old_holds.values_list('seat_id', flat=True))
            old_holds.delete()
            if old_seat_ids:
                Seat.objects.filter(id__in=old_seat_ids, status=SeatStatus.HELD).update(
                    status=SeatStatus.AVAILABLE
                )

        # Enforce maximum active holds limit per user for this flight
        user_holds_count = SeatHold.objects.filter(
            flight_instance=flight_instance, user=user
        ).count()
        if user_holds_count >= MAX_HELD_SEATS_PER_USER:
            raise ValidationError(f"Maximum limit of {MAX_HELD_SEATS_PER_USER} held seats reached.")

        # Mark seat as HELD
        seat.status = SeatStatus.HELD
        seat.save(update_fields=['status'])

        # Create the hold with an explicit expires_at
        hold = SeatHold.objects.create(
            seat=seat,
            flight_instance=flight_instance,
            user=user,
            expires_at=timezone.now() + timedelta(minutes=SEAT_HOLD_MINUTES),
        )
        return hold


def release_hold(hold_id, user):
    """
    Explicitly release a seat hold before it expires (user deselects seat).
    Frees the seat back to AVAILABLE immediately.
    Raises ValidationError if the hold is not found or does not belong to the user.
    """
    with transaction.atomic():
        try:
            hold = SeatHold.objects.select_related('seat').select_for_update().get(
                id=hold_id, user=user
            )
        except SeatHold.DoesNotExist:
            raise ValidationError("Seat hold not found or does not belong to you.")

        seat = hold.seat
        hold.delete()

        # Only free the seat if it is still HELD (guard against double-free)
        if seat.status == SeatStatus.HELD:
            seat.status = SeatStatus.AVAILABLE
            seat.save(update_fields=['status'])




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

    # Booking cutoff: 3 hours before ORIGINAL scheduled departure (delays never extend this)
    cutoff_time = flight_instance.scheduled_departure - timedelta(hours=BOOKING_CUTOFF_HOURS)
    if timezone.now() >= cutoff_time:
        raise ValidationError(
            "Bookings for this flight are closed. "
            f"Online booking closes {BOOKING_CUTOFF_HOURS} hours before scheduled departure."
        )

    # Seat availability check (use Seat table as source of truth).
    # Include HELD seats in the count — lazy expiry inside the atomic block
    # will free any stale holds, so we must not pre-reject based on held seats.
    if cabin_class:
        available_count = flight_instance.seats.filter(
            seat_class=cabin_class, status__in=[SeatStatus.AVAILABLE, SeatStatus.HELD]
        ).count()
        if available_count < seat_count:
            raise ValidationError(
                f"Only {available_count} {cabin_class.lower()} seat(s) available on this flight."
            )
    else:
        available_count = flight_instance.seats.filter(
            status__in=[SeatStatus.AVAILABLE, SeatStatus.HELD]
        ).count()
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
            if extra_kg_dec % 1 != 0:
                raise ValidationError("Extra baggage weight must be specified in whole kg increments.")
            max_allowed = flight_instance.flight.max_extra_baggage_kg_per_person
            if extra_kg_dec > max_allowed:
                raise ValidationError(f"Extra baggage cannot exceed {max_allowed} kg per passenger.")
        except (ValueError, TypeError):
            raise ValidationError("Extra baggage weight must be a valid number.")

    # ── Atomic write: re-check with lock, then create ─────────────────────────
    with transaction.atomic():
        # Lazy expiry: release stale holds before any seat check
        expire_stale_holds(flight_instance)

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

        # Fetch IDs of seats currently held by this user for this flight
        user_held_seat_ids = set(SeatHold.objects.filter(
            flight_instance=flight_instance, user=user
        ).values_list('seat_id', flat=True))

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

            # Final guard inside the lock (AVAILABLE or HELD by current user)
            class_seats = flight_instance.seats.filter(seat_class=cabin_class)
            real_available = sum(
                1 for s in class_seats
                if s.status == SeatStatus.AVAILABLE or (s.status == SeatStatus.HELD and s.id in user_held_seat_ids)
            )
            if real_available < seat_count:
                raise ValidationError(
                    f"Only {real_available} {cabin_class.lower()} seat(s) available."
                )
        else:
            all_seats = flight_instance.seats.all()
            real_available = sum(
                1 for s in all_seats
                if s.status == SeatStatus.AVAILABLE or (s.status == SeatStatus.HELD and s.id in user_held_seat_ids)
            )
            if real_available < seat_count:
                raise ValidationError(
                    f"Only {real_available} seats available on this flight."
                )

        assigned_seats = []
        total_seat_fee = 0

        # Extract requested seats from passenger data
        requested_seat_numbers = [str(p.get('seat_number')).strip() for p in passengers_data if p.get('seat_number')]
        
        if len(requested_seat_numbers) == seat_count:
            # All seats were explicitly requested
            requested_seats_qs = flight_instance.seats.select_for_update().filter(
                seat_number__in=requested_seat_numbers,
            )
            if cabin_class:
                requested_seats_qs = requested_seats_qs.filter(seat_class=cabin_class)
                
            requested_seats = list(requested_seats_qs)
            if len(requested_seats) != seat_count:
                raise ValidationError("One or more selected seats are not available or invalid for this cabin class.")
                
            for seat_obj in requested_seats:
                if seat_obj.status == SeatStatus.HELD:
                    if seat_obj.id not in user_held_seat_ids:
                        raise ValidationError(f"Seat {seat_obj.seat_number} is currently held by another user.")
                elif seat_obj.status != SeatStatus.AVAILABLE:
                    raise ValidationError(f"Seat {seat_obj.seat_number} is not available (status: {seat_obj.status}).")

            for seat_obj in requested_seats:
                seat_obj.status = SeatStatus.BOOKED
                seat_obj.save(update_fields=['status'])
                total_seat_fee += seat_obj.seat_fee
            assigned_seats = requested_seat_numbers
        else:
            if len(requested_seat_numbers) > 0:
                raise ValidationError("You must either select a seat for all passengers or none.")
                
            # Fallback: Auto-assign seats (FIFO)
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
                total_seat_fee += seat_obj.seat_fee

        booking_kwargs = {
            "user": user,
            "flight": flight_instance,
            "status": BookingStatus.CONFIRMED,
            "seat_count": seat_count,
            "total_price": (price_per_pax * seat_count) + total_seat_fee,
        }
        if cabin_class:
            booking_kwargs["cabin_class"] = cabin_class

        booking = Booking.objects.create(**booking_kwargs)

        # Clean up any active SeatHold records for this user/flight after successful booking
        SeatHold.objects.filter(flight_instance=flight_instance, user=user).delete()

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
            seat_num = str(p_data.get('seat_number')).strip() if p_data.get('seat_number') else (assigned_seats[idx] if idx < len(assigned_seats) else None)
            p_extra_kg = Decimal(str(p_data.get('extra_baggage_kg', 0) or 0))
            p_extra_cost = p_extra_kg * baggage_unit_rate
            total_extra_baggage_cost += p_extra_cost


            free_checked_kg = fare_obj.effective_baggage_allowance_kg if fare_obj else route.baggage_weight_allowed_per_person
            free_handbag_kg = fare_obj.effective_handbag_allowance_kg if fare_obj else route.handbag_weight_allowed_per_person

            passenger_obj = Passenger.objects.create(
                booking=booking,
                name=p_data['name'],
                age=p_data['age'],
                gender=p_data['gender'],
                phone_number=p_data.get('phone_number', ''),
                meal_preference=p_data.get('meal_preference', 'NONE'),
                seat_number=seat_num,
                free_baggage_allowance_kg=free_checked_kg,
                free_handbag_allowance_kg=free_handbag_kg,
                extra_baggage_kg=p_extra_kg,
                extra_baggage_cost=p_extra_cost,
            )

            # Immutable ticket price snapshot
            seat_obj = None
            if seat_num:
                seat_obj = flight_instance.seats.filter(seat_number=seat_num).first()

            if seat_obj and fare_obj:
                Ticket.objects.create(
                    booking=booking,
                    flight_instance=flight_instance,
                    fare=fare_obj,
                    passenger=passenger_obj,
                    seat=seat_obj,
                    price_paid=price_per_pax + seat_obj.seat_fee,
                    currency=booking_curr,
                    fare_code=fare_obj.fare_code,
                    cabin_class=cabin_class or fare_obj.cabin_class,
                    refund_type=fare_obj.refund_type,
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
                            base_price = CurrencyService.convert_amount(
                                food_item_obj.price,
                                getattr(food_item_obj, 'currency', None) or "INR",
                                booking_curr
                            )
                        except (FoodItem.DoesNotExist, ValueError):
                            raise ValidationError(f"Invalid food item ID: {food_item_id} for this flight's airline.")

                    if flight_meal_id:
                        try:
                            flight_meal_obj = FlightMeal.objects.get(pk=int(flight_meal_id), flight_instance=flight_instance)
                            base_price = CurrencyService.convert_amount(
                                flight_meal_obj.price,
                                getattr(flight_meal_obj, 'currency', None) or "INR",
                                booking_curr
                            )
                        except (FlightMeal.DoesNotExist, ValueError):
                            raise ValidationError(f"Invalid combo meal ID: {flight_meal_id}")

                    if flight_leg_id:
                        try:
                            flight_leg_obj = FlightLeg.objects.get(pk=int(flight_leg_id), flight=flight_instance.flight)
                        except (FlightLeg.DoesNotExist, ValueError):
                            raise ValidationError(f"Invalid flight leg ID: {flight_leg_id}")

                    from .models import PassengerMeal
                    unit_price = base_price

                    # Only waive complimentary fee for combo meals (FlightMeal), NOT for paid food items (FoodItem)
                    is_complimentary_eligible = flight_meal_obj is not None
                    if fare_obj and fare_obj.meal_included and not complimentary_waived and is_complimentary_eligible:
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

        # Update final booking total price including meals, extra baggage, and 12% GST
        from decimal import ROUND_HALF_UP
        sub_total = booking.total_price + total_meal_cost + total_extra_baggage_cost
        gst_amount = (sub_total * Decimal("0.12")).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        booking.total_price = sub_total + gst_amount
        booking.save(update_fields=['total_price'])

        try:
            from apps.notifications.services import NotificationService
            NotificationService.send_booking_confirmation(booking)
        except Exception:
            logger.exception("Failed to send booking confirmation notification")

        try:
            from apps.flights.services_pricing import reevaluate_route_fares_dynamically
            reevaluate_route_fares_dynamically(route_id=flight_instance.flight_id)
        except Exception:
            logger.exception("Failed to reevaluate dynamic pricing after booking creation")

        return booking


@transaction.atomic
def cancel_booking(booking_id, user=None, is_admin_cancel=False):
    """
    Cancel a booking (frees up seats and decreases fare available_seats).,
    then triggers waitlist auto-allocation.
    """
    try:
        booking = Booking.objects.select_for_update().get(id=booking_id, user=user) if user else Booking.objects.select_for_update().get(id=booking_id)
    except Booking.DoesNotExist:
        raise ValidationError("Booking not found.")

    if booking.status == BookingStatus.CANCELLED:
        raise ValidationError("Booking is already cancelled.")

    booking.status = BookingStatus.CANCELLED
    booking.save()

    try:
        from apps.notifications.services import NotificationService
        if is_admin_cancel:
            NotificationService.send_admin_booking_cancellation(booking)
        else:
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