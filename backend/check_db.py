import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from apps.flights.models import FlightInstance, Seat
inst = FlightInstance.objects.order_by('-created_at').first()
if inst:
    print(f"Latest instance: {inst}")
    print(f"Aircraft: {inst.aircraft}")
    print(f"Aircraft capacities: E={inst.aircraft.economy_capacity}, B={inst.aircraft.business_capacity}, F={inst.aircraft.first_class_capacity}")
    print(f"Total seats generated: {inst.seats.count()}")
    for fare in inst.fares.all():
        count = inst.seats.filter(seat_class=fare.cabin_class, status="AVAILABLE").count()
        print(f"Fare {fare.cabin_class}: calculated available_seats={count}")
else:
    print("No instances.")
