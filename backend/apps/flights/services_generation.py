import logging
from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone

from .models import FlightRoute, FlightInstance, InstanceStatus, Aircraft
from .services import generate_seats_for_instance, apply_premium_pricing
from .services_pricing import generate_fares_for_instance, PricingStrategy

logger = logging.getLogger(__name__)


def generate_upcoming_instances(
    today: date | None = None,
    horizon_days: int = 90,
    strategy: PricingStrategy | None = None,
    route_id: int | None = None,
) -> dict:
    """
    Rolling horizon generator: creates upcoming FlightInstance records
    for active routes based on operates_on_days and validity window.

    Idempotent: uses get_or_create to skip instances that already exist.

    Returns:
        {
            "created_instances_count": int,
            "created_seats_count": int,
            "created_fares_count": int,
            "skipped_instances_count": int,
        }
    """
    if today is None:
        today = timezone.now().date()

    end_date = today + timedelta(days=horizon_days)

    active_routes = FlightRoute.objects.filter(is_active=True).prefetch_related("fare_classes", "legs")
    if route_id is not None:
        active_routes = active_routes.filter(id=route_id)

    if not active_routes.exists():
        logger.info("No active flight routes found for instance generation.")
        return {
            "created_instances_count": 0,
            "created_seats_count": 0,
            "created_fares_count": 0,
            "skipped_instances_count": 0,
        }

    default_aircraft = Aircraft.objects.first()

    created_instances = 0
    skipped_instances = 0
    created_seats = 0
    created_fares = 0

    from datetime import datetime, time

    for route in active_routes:
        r_valid_from = route.valid_from
        r_valid_until = route.valid_until

        if route.operates_on_days:
            operating_days = {
                int(d.strip()) for d in route.operates_on_days.split(",") if d.strip().isdigit()
            }
        else:
            operating_days = {1, 2, 3, 4, 5, 6, 7}

        curr_date = today
        while curr_date <= end_date:
            if curr_date.isoweekday() in operating_days:
                if r_valid_from and curr_date < r_valid_from:
                    curr_date += timedelta(days=1)
                    continue
                if r_valid_until and curr_date > r_valid_until:
                    curr_date += timedelta(days=1)
                    continue

                dep_time = route.scheduled_departure_time
                if not dep_time:
                    first_leg = route.legs.order_by("leg_order").first()
                    if first_leg and first_leg.scheduled_departure_time:
                        dep_time = first_leg.scheduled_departure_time
                    elif first_leg and first_leg.scheduled_departure:
                        dep_time = first_leg.scheduled_departure.time()
                    else:
                        dep_time = time(8, 0)

                arr_time = route.scheduled_arrival_time
                if arr_time:
                    naive_dep = datetime.combine(curr_date, dep_time)
                    if arr_time < dep_time:
                        naive_arr = datetime.combine(curr_date + timedelta(days=1), arr_time)
                    else:
                        naive_arr = datetime.combine(curr_date, arr_time)
                else:
                    total_duration = sum((l.flight_duration_minutes or 0) + (l.layover_duration_minutes or 0) for l in route.legs.all()) or 120
                    naive_dep = datetime.combine(curr_date, dep_time)
                    naive_arr = naive_dep + timedelta(minutes=total_duration)

                sch_dep = timezone.make_aware(naive_dep) if timezone.is_naive(naive_dep) else naive_dep
                sch_arr = timezone.make_aware(naive_arr) if timezone.is_naive(naive_arr) else naive_arr

                with transaction.atomic():
                    import random
                    
                    # Try to fetch actual terminals if available
                    dep_term = "T1"
                    arr_term = "T1"
                    first_leg = route.legs.order_by("leg_order").first()
                    last_leg = route.legs.order_by("-leg_order").first()
                    
                    if first_leg and first_leg.departure_airport.terminals:
                        dep_term = random.choice(first_leg.departure_airport.terminals)
                    if last_leg and last_leg.arrival_airport.terminals:
                        arr_term = random.choice(last_leg.arrival_airport.terminals)

                    instance, created = FlightInstance.objects.get_or_create(
                        flight=route,
                        date=curr_date,
                        scheduled_departure=sch_dep,
                        defaults={
                            "aircraft": default_aircraft,
                            "scheduled_arrival": sch_arr,
                            "status": InstanceStatus.SCHEDULED,
                            "boarding_gate": f"G{random.randint(1, 20)}",
                            "departure_terminal": dep_term,
                            "arrival_terminal": arr_term,
                        },
                    )

                    if created:
                        created_instances += 1
                        s_count = generate_seats_for_instance(instance)
                        apply_premium_pricing(instance, window_fee=1500, legroom_fee=2500)
                        created_seats += s_count
                        f_list = generate_fares_for_instance(instance, strategy=strategy)
                        created_fares += len(f_list)
                    else:
                        skipped_instances += 1

            curr_date += timedelta(days=1)

    logger.info(
        f"Rolling instance generation finished: created {created_instances} instances, "
        f"{created_seats} seats, {created_fares} fares. Skipped {skipped_instances} existing instances."
    )

    return {
        "created_instances_count": created_instances,
        "created_seats_count": created_seats,
        "created_fares_count": created_fares,
        "skipped_instances_count": skipped_instances,
    }
