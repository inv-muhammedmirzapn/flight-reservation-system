import logging
from abc import ABC, abstractmethod
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import RouteFareClass, Fare, FarePriceChangeLog, InstanceStatus, FlightInstance

logger = logging.getLogger(__name__)


class PricingStrategy(ABC):
    @abstractmethod
    def calculate_price(self, route_fare: RouteFareClass, flight_date: date) -> Decimal:
        """Calculate the instance price for a given route_fare and flight date."""
        pass


class FlatPricingStrategy(PricingStrategy):
    """
    Default pricing strategy: instance fare price equals route base price.
    """
    def calculate_price(self, route_fare: RouteFareClass, flight_date: date) -> Decimal:
        return route_fare.base_price.quantize(Decimal("0.01"))


def generate_fares_for_instance(
    instance: FlightInstance, strategy: PricingStrategy | None = None
) -> list[Fare]:
    """
    Generate or update Fare rows for an instance based on its route's RouteFareClass templates.
    """
    if strategy is None:
        strategy = FlatPricingStrategy()

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
        strategy = FlatPricingStrategy()

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
