import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

from datetime import timedelta
from django.utils import timezone
from apps.flights.models import FlightInstance
from apps.flights.services_routing import RouteOptimizer

now = timezone.now()

# 1. Find a flight instance departing in < 3 hours and one in > 3 hours
soon_instance = FlightInstance.objects.filter(
    scheduled_departure__gt=now,
    scheduled_departure__lte=now + timedelta(hours=3),
    status__in=["SCHEDULED", "DELAYED", "BOARDING"]
).first()

later_instance = FlightInstance.objects.filter(
    scheduled_departure__gt=now + timedelta(hours=4),
    status__in=["SCHEDULED", "DELAYED", "BOARDING"]
).first()

print(f"Soon instance found: {soon_instance} (Departs: {soon_instance.scheduled_departure if soon_instance else 'N/A'})")
print(f"Later instance found: {later_instance} (Departs: {later_instance.scheduled_departure if later_instance else 'N/A'})")

# 2. Test recommend_routes for both (if they exist) to see if soon_instance is excluded
optimizer = RouteOptimizer()

if soon_instance:
    src = soon_instance.flight.route.departure_airport.iata_code
    dest = soon_instance.flight.route.arrival_airport.iata_code
    date = soon_instance.scheduled_departure.date()
    
    print(f"\nTesting recommendation for {src} to {dest} on {date}")
    res = optimizer.recommend_routes(src, dest, travel_date=date)
    
    # Check if soon_instance is in the results
    found = False
    if "recommended_routes" in res:
        for route in res["recommended_routes"]:
            for hop in route["hops"]:
                for opt in hop["options"]:
                    if opt.get("instance_id") == soon_instance.id:
                        found = True
                        
    print(f"Soon instance (ID {soon_instance.id}) found in recommendations? {found}")

