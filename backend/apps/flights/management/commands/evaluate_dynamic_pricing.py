from django.core.management.base import BaseCommand
from apps.flights.services_pricing import reevaluate_route_fares_dynamically


class Command(BaseCommand):
    help = "Re-evaluates dynamic pricing for all future scheduled flight fares."

    def add_arguments(self, parser):
        parser.add_argument(
            "--route-id",
            type=int,
            default=None,
            help="Optional FlightRoute ID to restrict re-evaluation.",
        )

    def handle(self, *args, **options):
        route_id = options.get("route_id")
        if route_id:
            self.stdout.write(
                self.style.NOTICE(f"Re-evaluating dynamic pricing for FlightRoute ID {route_id}...")
            )
        else:
            self.stdout.write(
                self.style.NOTICE("Re-evaluating dynamic pricing for all scheduled route fares...")
            )

        updated_count = reevaluate_route_fares_dynamically(route_id=route_id)

        self.stdout.write(
            self.style.SUCCESS(
                f"Dynamic pricing evaluation completed. Updated {updated_count} future fares."
            )
        )
