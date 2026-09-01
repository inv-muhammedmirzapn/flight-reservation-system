from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.flights.models import FlightInstance, InstanceStatus
from apps.pricing.models import DynamicPricingConfig
from apps.pricing.services import DynamicPricingStrategy, reevaluate_route_fares_dynamically


class Command(BaseCommand):
    help = (
        "Re-prices Fare rows for all FlightInstances currently inside the "
        "proximity window (departure within proximity_window_days). "
        "Intended to be run daily, e.g. via cron."
    )

    def handle(self, *args, **options):
        config = DynamicPricingConfig.objects.filter(is_active=True).first()
        if not config or not config.proximity_pricing_enabled:
            self.stdout.write(
                self.style.WARNING(
                    "Proximity pricing is disabled or no active config found. Skipping."
                )
            )
            return

        today = timezone.now().date()
        window_end = today + timedelta(days=config.proximity_window_days)

        # Collect distinct route IDs for instances inside the window
        route_ids = (
            FlightInstance.objects.filter(
                date__gte=today,
                date__lte=window_end,
                status=InstanceStatus.SCHEDULED,
            )
            .values_list("flight_id", flat=True)
            .distinct()
        )

        if not route_ids:
            self.stdout.write(
                self.style.NOTICE("No scheduled instances found inside the proximity window.")
            )
            return

        strategy = DynamicPricingStrategy(config=config)
        total_updated = 0
        for route_id in route_ids:
            updated = reevaluate_route_fares_dynamically(route_id=route_id, strategy=strategy)
            total_updated += updated

        self.stdout.write(
            self.style.SUCCESS(
                f"Proximity repricing complete. Updated {total_updated} fare(s) across "
                f"{len(route_ids)} route(s) inside the {config.proximity_window_days}-day window."
            )
        )
