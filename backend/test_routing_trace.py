import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.flights.services_routing import RouteOptimizer
ro = RouteOptimizer()

# Call the recommend_routes method but add some debug print statements inside locally
# I will copy the recommend_routes logic and add prints

source_iata = 'SYD'
dest_iata = 'JFK'
travel_date = '2026-09-04'

from datetime import datetime as dt_class, timedelta as td
from django.utils import timezone
from apps.flights.models import FlightInstance
from collections import deque

travel_date = dt_class.strptime(travel_date, "%Y-%m-%d").date()
now = timezone.now()
booking_cutoff = now + td(hours=3)
window_end = travel_date + td(days=5)

instances = FlightInstance.objects.filter(
    date__gte=travel_date,
    date__lte=window_end,
    scheduled_departure__gt=booking_cutoff,
    status__in=["SCHEDULED", "DELAYED", "BOARDING"]
).select_related("flight", "flight__airline").prefetch_related("fares")

instance_map = {}
for inst in instances:
    flight_no = inst.flight.flight_no
    if flight_no not in instance_map:
        instance_map[flight_no] = []
    instance_map[flight_no].append(inst)

print(f"Total instances fetched: {len(instances)}")
print(f"Instance map keys: {list(instance_map.keys())}")

queue = deque([(source_iata, [])])
valid_routes = []
max_hops = 4

while queue:
    current_node, path = queue.popleft()
    if len(path) > max_hops:
        continue

    if current_node == dest_iata:
        if len(path) > 1:
            valid_routes.append(path)
        continue

    for neighbor, data in ro.graph.adj_list[current_node].items():
        if neighbor == source_iata:
            continue
        already_visited = any(hop.get("dest") == neighbor for hop in path)
        if already_visited:
            continue
        new_path = list(path)
        new_path.append({"dest": neighbor, "legs": data["legs"]})
        queue.append((neighbor, new_path))

print(f"Valid routes found by BFS: {len(valid_routes)}")
for r in valid_routes:
    print([hop['dest'] for hop in r])

for route_path in valid_routes:
    previous_earliest_arrival = None
    print(f"\nChecking route_path...")
    
    for hop_idx, hop in enumerate(route_path):
        candidate_legs = [leg for leg in hop["legs"] if len(leg.flight.legs.all()) == 1]
        print(f"  Hop {hop_idx}: dest {hop['dest']}, candidate_legs: {[l.flight.flight_no for l in candidate_legs]}")
        
        if not candidate_legs:
            print("  No candidate legs!")
            break
            
        options = []
        for leg in candidate_legs:
            flight_no = leg.flight.flight_no
            for inst in instance_map.get(flight_no, []):
                dep_dt = inst.scheduled_departure
                arr_dt = inst.scheduled_arrival
                
                print(f"    Checking inst {flight_no} at {dep_dt}")
                
                if previous_earliest_arrival is None:
                    if dep_dt.date() != travel_date:
                        print(f"      Rejected: dep_dt.date() {dep_dt.date()} != travel_date {travel_date}")
                        continue
                else:
                    if dep_dt < previous_earliest_arrival + td(hours=1):
                        print(f"      Rejected: dep_dt {dep_dt} < prev_arr {previous_earliest_arrival} + 1hr")
                        continue
                        
                options.append(inst)
        
        print(f"  Options found: len={len(options)}")
        if not options:
            print("  No options found!")
            break
            
        earliest_arriving = min(options, key=lambda o: o.scheduled_arrival)
        previous_earliest_arrival = earliest_arriving.scheduled_arrival
        print(f"  Earliest arrival for next hop: {previous_earliest_arrival}")
