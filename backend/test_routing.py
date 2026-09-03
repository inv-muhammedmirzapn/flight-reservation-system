import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.flights.services_routing import RouteOptimizer
ro = RouteOptimizer()
print(ro.recommend_routes('SYD', 'JFK', travel_date='2026-09-04'))
