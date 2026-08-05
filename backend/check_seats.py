import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from apps.flights.models import FlightInstance
inst = FlightInstance.objects.order_by('-created_at').first()
if inst:
    print(f"Latest flight: {inst.id} - {inst.flight.flight_no}")
    print(f"Seats generated: {inst.seats.count()}")
    for cls in ['ECONOMY', 'BUSINESS', 'FIRST']:
        print(f"  {cls} seats: {inst.seats.filter(seat_class=cls).count()}")
    print(f"Fares:")
    for fare in inst.fares.all():
        print(f"  {fare.cabin_class}: price={fare.price}, real_available={inst.seats.filter(seat_class=fare.cabin_class, status='AVAILABLE').count()}")
