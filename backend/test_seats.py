import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.flights.models import Seat, FlightInstance, Fare

fi = FlightInstance.objects.filter(flight__flight_no="AI121").first()
print(f"FlightInstance ID: {fi.id}")

fares = Fare.objects.filter(flight_instance=fi)
for f in fares:
    real_avail = Seat.objects.filter(flight_instance=fi, seat_class=f.cabin_class, status="AVAILABLE").count()
    total = Seat.objects.filter(flight_instance=fi, seat_class=f.cabin_class).count()
    print(f"Fare: {f.cabin_class}, Total: {total}, Avail: {real_avail}, Fare Avail: {f.available_seats}")
