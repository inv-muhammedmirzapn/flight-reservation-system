import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from apps.flights.services_routing import FlightGraph

g = FlightGraph()
g.build_graph()

print("```mermaid")
print("graph TD;")
for source, targets in g.adj_list.items():
    for target, data in targets.items():
        dist = int(data['distance'])
        print(f"    {source} -->|{dist}km| {target};")
print("```")
