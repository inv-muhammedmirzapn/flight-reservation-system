import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.flights.models import FlightLeg, FlightRoute
print(FlightLeg.objects.count())
print(FlightRoute.objects.filter(is_active=True).count())
