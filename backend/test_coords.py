import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.flights.models import Airport
print(list(Airport.objects.values('iata_code', 'latitude', 'longitude')))
