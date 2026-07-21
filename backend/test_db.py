import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import transaction, connection, DatabaseError
from apps.flights.models import Flight

try:
    with transaction.atomic():
        print("Inside atomic")
        try:
            Flight.objects.select_for_update(nowait=False).first()
            print("Select for update succeeded")
        except DatabaseError as e:
            print("DatabaseError:", e)
            Flight.objects.first()
except Exception as e:
    print("Exception outside:", type(e), e)
