import logging
from abc import ABC, abstractmethod
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.bookings.models import Booking, BookingStatus
from apps.flights.models import (
    RouteFareClass,
    Fare,
    FarePriceChangeLog,
    InstanceStatus,
    FlightInstance,
)
from apps.pricing.models import (
    DynamicPricingConfig,
    HolidayEvent,
    DynamicPriceLog,
)

logger = logging.getLogger(__name__)


class PricingStrategy(ABC):
    @abstractmethod
    def calculate_price(self, route_fare: RouteFareClass, flight_date: date) -> Decimal:
        """Calculate the instance price for a given route_fare and flight date."""
        pass


class FlatPricingStrategy(PricingStrategy):
    """
    Default fallback pricing strategy: instance fare price equals route base price.
    """
    def calculate_price(self, route_fare: RouteFareClass, flight_date: date) -> Decimal:
        return route_fare.base_price.quantize(Decimal("0.01"))


class DynamicPricingStrategy(PricingStrategy):
    """
    Calculates dynamic instance price considering:
    1. Weekend Multiplier
    2. Location-aware Holiday Multiplier (Global or Country-specific origin/destination match)
    3. Demand Velocity Surge (Rolling N-day window booking count vs thresholds)
    """
    def __init__(self, config: DynamicPricingConfig | None = None):
        if config is None:
            config = DynamicPricingConfig.objects.filter(is_active=True).first()
            if config is None:
                config, _ = DynamicPricingConfig.objects.get_or_create(
                    name="Global Dynamic Pricing Settings",
                    defaults={
                        "is_active": True,
                        "weekend_multiplier": Decimal("1.15"),
                        "initial_surge_percent": Decimal("10.00"),
                        "step_surge_percent": Decimal("2.00"),
                        "max_demand_surge_percent": Decimal("50.00"),
                    }
                )
        self.config = config

    def calculate_price_breakdown(
        self,
        route_fare: RouteFareClass,
        flight_date: date,
        flight_instance: FlightInstance | None = None,
        mock_booking_count: int | None = None
    ) -> dict:
        """
        Returns a detailed dictionary breakdown of the dynamic price computation.
        """
        base_price = route_fare.base_price.quantize(Decimal("0.01"))
        if not self.config or not self.config.is_active:
            return {
                "base_price": base_price,
                "weekend_multiplier": Decimal("1.00"),
                "holiday_multiplier": Decimal("1.00"),
                "holiday_name": "",
                "demand_surge_percent": Decimal("0.00"),
                "recent_booking_count": 0,
                "final_price": base_price,
            }

        w_mult = Decimal("1.00")
        h_mult = Decimal("1.00")
        h_name = ""
        d_percent = Decimal("0.00")

        # 1. Weekend Check
        if self.config.weekend_surge_enabled and self.config.weekend_days:
            weekend_iso_days = [
                int(d.strip()) for d in self.config.weekend_days.split(",") if d.strip().isdigit()
            ]
            if flight_date.isoweekday() in weekend_iso_days:
                w_mult = Decimal(str(self.config.weekend_multiplier))

        # 2. Location-aware Holiday Check
        route = route_fare.route if hasattr(route_fare, "route") else None
        origin_country = route.origin_airport.country if route and route.origin_airport else ""
        dest_country = route.destination_airport.country if route and route.destination_airport else ""

        active_holidays = HolidayEvent.objects.filter(
            is_active=True,
            start_date__lte=flight_date,
            end_date__gte=flight_date,
        )

        for holiday in active_holidays:
            applies = False
            if holiday.is_global:
                applies = True
            else:
                countries = [c.strip().lower() for c in (holiday.applicable_countries or [])]
                if (origin_country and str(origin_country).lower() in countries) or (
                    dest_country and str(dest_country).lower() in countries
                ):
                    applies = True

            if applies:
                mult = Decimal(str(holiday.surge_multiplier))
                if mult > h_mult:
                    h_mult = mult
                    h_name = holiday.name

        # 3. Demand Velocity Surge (Rolling Window)
        booking_count = 0
        if self.config.demand_surge_enabled:
            if mock_booking_count is not None:
                booking_count = mock_booking_count
            elif route:
                window_days = self.config.rolling_window_days or 7
                cutoff_date = timezone.now() - timedelta(days=window_days)
                booking_count = Booking.objects.filter(
                    flight__flight=route,
                    status=BookingStatus.CONFIRMED,
                    created_at__gte=cutoff_date,
                ).count()

            init_thresh = self.config.initial_booking_threshold
            if booking_count >= init_thresh:
                init_surge = Decimal(str(self.config.initial_surge_percent))
                step_size = self.config.booking_step_size or 10
                step_surge = Decimal(str(self.config.step_surge_percent))
                max_surge = Decimal(str(self.config.max_demand_surge_percent))

                extra_bookings = booking_count - init_thresh
                steps = extra_bookings // step_size if step_size > 0 else 0
                calc_surge = init_surge + (Decimal(steps) * step_surge)
                d_percent = min(calc_surge, max_surge)

        d_mult = Decimal("1.00") + (d_percent / Decimal("100.00"))
        final_price = (base_price * w_mult * h_mult * d_mult).quantize(Decimal("0.01"))

        return {
            "base_price": base_price,
            "weekend_multiplier": w_mult,
            "holiday_multiplier": h_mult,
            "holiday_name": h_name,
            "demand_surge_percent": d_percent,
            "recent_booking_count": booking_count,
            "final_price": final_price,
        }

    def calculate_price(self, route_fare: RouteFareClass, flight_date: date) -> Decimal:
        breakdown = self.calculate_price_breakdown(route_fare, flight_date)
        return breakdown["final_price"]


def generate_fares_for_instance(
    instance: FlightInstance, strategy: PricingStrategy | None = None
) -> list[Fare]:
    """
    Generate or update Fare rows for an instance based on its route's RouteFareClass templates.
    Defaults to DynamicPricingStrategy.
    """
    if strategy is None:
        strategy = DynamicPricingStrategy()

    route_fares = instance.flight.fare_classes.all()
    created_or_updated_fares = []

    for rf in route_fares:
        price = strategy.calculate_price(rf, instance.date)
        avail_count = instance.seats.filter(
            seat_class=rf.cabin_class, status="AVAILABLE"
        ).count()

        fare, _ = Fare.objects.update_or_create(
            flight_instance=instance,
            cabin_class=rf.cabin_class,
            fare_code=rf.fare_code,
            defaults={
                "price": price,
                "currency": rf.currency,
                "available_seats": avail_count,
                "refund_type": rf.refund_type,
                "change_fee": rf.change_fee,
                "meal_included": rf.meal_included,
                "baggage_allowance": rf.baggage_weight_allowed_kg,
            },
        )
        created_or_updated_fares.append(fare)

    return created_or_updated_fares


def update_route_fare_price(
    route_fare: RouteFareClass,
    new_base_price: Decimal,
    changed_by=None,
    strategy: PricingStrategy | None = None,
) -> int:
    """
    Update a RouteFareClass base price and re-price unsold future fares on SCHEDULED instances.
    Logs each modified fare in FarePriceChangeLog.
    Returns the number of future fares updated.
    """
    if strategy is None:
        strategy = DynamicPricingStrategy()

    new_base_price = Decimal(str(new_base_price)).quantize(Decimal("0.01"))
    old_base_price = route_fare.base_price

    with transaction.atomic():
        if old_base_price != new_base_price:
            FarePriceChangeLog.objects.create(
                route_fare=route_fare,
                old_price=old_base_price,
                new_price=new_base_price,
                changed_by=changed_by,
            )

        route_fare.base_price = new_base_price
        route_fare.save(update_fields=["base_price"])

        today = timezone.now().date()
        fares_qs = (
            Fare.objects.select_for_update()
            .filter(
                flight_instance__flight=route_fare.route,
                flight_instance__date__gte=today,
                flight_instance__status=InstanceStatus.SCHEDULED,
                cabin_class=route_fare.cabin_class,
            )
        )

        updated_count = 0
        for fare in fares_qs:
            new_instance_price = strategy.calculate_price(route_fare, fare.flight_instance.date)
            if fare.price != new_instance_price:
                FarePriceChangeLog.objects.create(
                    fare=fare,
                    route_fare=route_fare,
                    old_price=fare.price,
                    new_price=new_instance_price,
                    changed_by=changed_by,
                )
                fare.price = new_instance_price
                fare.save(update_fields=["price"])
                updated_count += 1

    return updated_count


def reevaluate_route_fares_dynamically(
    route_id: int | None = None,
    strategy: DynamicPricingStrategy | None = None
) -> int:
    """
    Re-evaluates unsold future instance fares for a given route (or all routes)
    using the DynamicPricingStrategy, updating prices and recording dynamic price logs.
    """
    if strategy is None:
        strategy = DynamicPricingStrategy()

    today = timezone.now().date()
    fares_qs = Fare.objects.select_related(
        "flight_instance",
        "flight_instance__flight",
        "flight_instance__flight__airline",
    ).prefetch_related(
        "flight_instance__flight__legs",
        "flight_instance__flight__legs__departure_airport",
        "flight_instance__flight__legs__arrival_airport",
    ).filter(
        flight_instance__date__gte=today,
        flight_instance__status=InstanceStatus.SCHEDULED,
    )

    if route_id:
        fares_qs = fares_qs.filter(flight_instance__flight_id=route_id)

    updated_count = 0
    with transaction.atomic():
        for fare in fares_qs:
            route_fare = RouteFareClass.objects.filter(
                route=fare.flight_instance.flight,
                cabin_class=fare.cabin_class,
                fare_code=fare.fare_code,
            ).first()

            if not route_fare:
                continue

            breakdown = strategy.calculate_price_breakdown(
                route_fare, fare.flight_instance.date, flight_instance=fare.flight_instance
            )
            new_price = breakdown["final_price"]

            if fare.price != new_price:
                old_p = fare.price
                fare.price = new_price
                fare.save(update_fields=["price"])
                updated_count += 1

                FarePriceChangeLog.objects.create(
                    fare=fare,
                    route_fare=route_fare,
                    old_price=old_p,
                    new_price=new_price,
                )

            # Log dynamic price computation snapshot
            DynamicPriceLog.objects.create(
                fare=fare,
                flight_instance=fare.flight_instance,
                cabin_class=fare.cabin_class,
                base_price=breakdown["base_price"],
                weekend_multiplier=breakdown["weekend_multiplier"],
                holiday_multiplier=breakdown["holiday_multiplier"],
                holiday_applied=breakdown["holiday_name"],
                demand_surge_percent=breakdown["demand_surge_percent"],
                recent_booking_count=breakdown["recent_booking_count"],
                final_calculated_price=breakdown["final_price"],
            )

    return updated_count