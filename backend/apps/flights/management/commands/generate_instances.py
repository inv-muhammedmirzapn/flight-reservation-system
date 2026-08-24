from django.core.management.base import BaseCommand
from apps.flights.services_generation import generate_upcoming_instances


class Command(BaseCommand):
    help = "Generates upcoming FlightInstance rows (with Seats & Fares) over a rolling 90-day horizon."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help="Number of days in the rolling horizon (default: 90).",
        )

    def handle(self, *args, **options):
        horizon_days = options["days"]
        self.stdout.write(
            self.style.NOTICE(f"Generating upcoming flight instances for {horizon_days}-day horizon...")
        )
        result = generate_upcoming_instances(horizon_days=horizon_days)
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully completed: created {result['created_instances_count']} instances, "
                f"{result['created_seats_count']} seats, {result['created_fares_count']} fares. "
                f"Skipped {result['skipped_instances_count']} existing instances."
            )
        )
