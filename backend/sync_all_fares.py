import os
import sys
import django

sys.path.insert(0, '/home/abidmuhammed/Projects/personal/flight-management/flight-reservation-system/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.flights.models import FlightInstance, Fare, Seat, SeatStatus

def sync():
    synced_count = 0
    total_fares = Fare.objects.count()
    for fare in Fare.objects.all():
        inst = fare.flight_instance
        if inst.seats.exists():
            real_avail = inst.seats.filter(seat_class=fare.cabin_class, status=SeatStatus.AVAILABLE).count()
            if fare.available_seats != real_avail:
                print(f"Syncing Flight {inst.id} ({fare.cabin_class}): fare.available_seats={fare.available_seats} -> real_avail={real_avail}")
                fare.available_seats = real_avail
                fare.save(update_fields=['available_seats'])
                synced_count += 1
    print(f"Done. Checked {total_fares} fares. Updated {synced_count} fares.")

if __name__ == '__main__':
    sync()
