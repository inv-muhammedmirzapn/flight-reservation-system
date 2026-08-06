import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from apps.flights.models import FlightInstance, Fare, Seat, SeatStatus
from apps.flights.serializers import FrontendFlightInstanceSerializer
from django.db.models import Q, Exists, OuterRef

def test():
    qs = FlightInstance.objects.filter(
        flight__legs__departure_airport__iata_code='DEL',
        flight__legs__arrival_airport__iata_code='HAM',
        date='2026-08-18'
    ).distinct()

    print(f"Total flights from DEL to HAM on 2026-08-18: {qs.count()}")
    for inst in qs:
        serializer_data = FrontendFlightInstanceSerializer(inst).data
        fares = serializer_data.get('fares', {})
        first_fare = fares.get('FIRST', {})
        econ_fare = fares.get('ECONOMY', {})
        biz_fare = fares.get('BUSINESS', {})
        
        has_seats_total = inst.seats.count()
        has_first_seats = inst.seats.filter(seat_class='FIRST').count()
        has_first_avail_seats = inst.seats.filter(seat_class='FIRST', status=SeatStatus.AVAILABLE).count()
        
        first_fare_obj = inst.fares.filter(cabin_class='FIRST').first()
        first_fare_avail = first_fare_obj.available_seats if first_fare_obj else None

        print(f"Flight ID {inst.id} ({inst.flight.flight_no}):")
        print(f"  Serializer Fares: FIRST={first_fare.get('available_seats')}, BIZ={biz_fare.get('available_seats')}, ECON={econ_fare.get('available_seats')}")
        print(f"  DB Seats Total: {has_seats_total}, FIRST seats: {has_first_seats} ({has_first_avail_seats} avail)")
        print(f"  DB Fare FIRST available_seats field: {first_fare_avail}")

        # Current waitlist_q for FIRST
        class_key = 'FIRST'
        waitlist_q = Q(fares__cabin_class=class_key) & ~Q(seats__seat_class=class_key, seats__status="AVAILABLE") & (
            Q(seats__seat_class=class_key) | Q(fares__cabin_class=class_key, fares__available_seats__lte=0)
        )
        match_current = FlightInstance.objects.filter(id=inst.id).filter(waitlist_q).exists()
        print(f"  Current waitlist_q match: {match_current}")

        # Exists subquery for FIRST
        has_first_avail_subquery = Exists(
            Seat.objects.filter(flight_instance=OuterRef('pk'), seat_class='FIRST', status='AVAILABLE')
        )
        has_first_seats_subquery = Exists(
            Seat.objects.filter(flight_instance=OuterRef('pk'), seat_class='FIRST')
        )
        first_fare_lte_zero_subquery = Exists(
            Fare.objects.filter(flight_instance=OuterRef('pk'), cabin_class='FIRST', available_seats__lte=0)
        )

        match_subquery = FlightInstance.objects.filter(id=inst.id).filter(
            Exists(Fare.objects.filter(flight_instance=OuterRef('pk'), cabin_class='FIRST'))
        ).filter(
            ~has_first_avail_subquery & (has_first_seats_subquery | first_fare_lte_zero_subquery)
        ).exists()
        print(f"  Subquery match: {match_subquery}\n")

if __name__ == '__main__':
    test()
