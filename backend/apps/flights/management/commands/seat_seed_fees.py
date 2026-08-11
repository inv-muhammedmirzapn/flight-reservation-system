from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.flights.models import Seat, SeatPosition, CabinClass

class Command(BaseCommand):
    help = "Seeds/updates existing seats with premium seat fees based on cabin class, position, exit row, and extra legroom flags."

    def handle(self, *args, **options):
        self.stdout.write("Starting seat fees seeding/updates...")

        # Define pricing rules per cabin class
        PRICING_BY_CLASS = {
            CabinClass.ECONOMY: {
                "exit_row_or_legroom": Decimal("600.00"),
                "window": Decimal("460.00"),
                "aisle": Decimal("250.00"),
                "middle": Decimal("0.00")
            },
            CabinClass.BUSINESS: {
                "exit_row_or_legroom": Decimal("1500.00"),
                "window": Decimal("1200.00"),
                "aisle": Decimal("800.00"),
                "middle": Decimal("500.00")
            },
            CabinClass.FIRST: {
                "exit_row_or_legroom": Decimal("3000.00"),
                "window": Decimal("2500.00"),
                "aisle": Decimal("1800.00"),
                "middle": Decimal("1200.00")
            }
        }

        # Count counters
        updated_count = 0
        
        # We will retrieve all seats and update them
        seats = Seat.objects.all()
        total_seats = seats.count()
        self.stdout.write(f"Found {total_seats} seats to process.")

        to_update = []
        for seat in seats:
            cabin_rules = PRICING_BY_CLASS.get(seat.seat_class, PRICING_BY_CLASS[CabinClass.ECONOMY])
            
            fee = Decimal("0.00")
            rule = ""

            # Check premium flags first (highest priority)
            if seat.exit_row or seat.extra_legroom:
                fee = cabin_rules["exit_row_or_legroom"]
                rule = f"{seat.seat_class.lower()}_exit_row_premium"
            # Otherwise position-based fees
            elif seat.position == SeatPosition.WINDOW:
                fee = cabin_rules["window"]
                rule = f"{seat.seat_class.lower()}_window_premium"
            elif seat.position == SeatPosition.AISLE:
                fee = cabin_rules["aisle"]
                rule = f"{seat.seat_class.lower()}_aisle_premium"
            else:
                fee = cabin_rules["middle"]
                rule = f"{seat.seat_class.lower()}_middle_default"

            # Only update if different to avoid redundant DB writes
            if seat.seat_fee != fee or seat.last_rule_applied != rule:
                seat.seat_fee = fee
                seat.last_rule_applied = rule
                to_update.append(seat)

        if to_update:
            self.stdout.write(f"Updating {len(to_update)} seats with premium seat fees...")
            with transaction.atomic():
                # Perform bulk update in batches of 1000 to prevent SQLite parameter limits
                Seat.objects.bulk_update(to_update, ["seat_fee", "last_rule_applied"], batch_size=1000)
            updated_count = len(to_update)
            self.stdout.write(f"Successfully updated {updated_count} seats.")
        else:
            self.stdout.write("All seats already have correct seat fees applied.")

        self.stdout.write(self.style.SUCCESS(
            f"Successfully finished seeding seat fees! Processed {total_seats} seats in total."
        ))
