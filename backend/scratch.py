import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.flights.models import Country, Airport, Airline, AircraftModel, Aircraft, FlightRoute, FlightLeg, FlightInstance, Seat, SeatStatus
from django.utils import timezone

def create_mock_data():
    country, _ = Country.objects.get_or_create(name="USA", iso_code="USA")
    src_airport, _ = Airport.objects.get_or_create(iata_code="JFK", airport_name="John F. Kennedy", city="NYC", country=country)
    dst_airport, _ = Airport.objects.get_or_create(iata_code="LAX", airport_name="Los Angeles", city="LA", country=country)
    airline, _ = Airline.objects.get_or_create(iata_airline_code="TA", airline_name="TestAir")
    ac_model, _ = AircraftModel.objects.get_or_create(manufacturer="Boeing", model_name="737")
    aircraft, _ = Aircraft.objects.get_or_create(registration="N12345", airline=airline, aircraft_model=ac_model)
    route, _ = FlightRoute.objects.get_or_create(flight_no="TA001", airline=airline)
    FlightLeg.objects.get_or_create(flight=route, leg_order=1, departure_airport=src_airport, arrival_airport=dst_airport)
    
    fi = FlightInstance.objects.create(
        flight=route, 
        date=timezone.now().date(),
        aircraft=aircraft,
        scheduled_departure=timezone.now(),
        scheduled_arrival=timezone.now() + timezone.timedelta(hours=5)
    )
    for i in range(10):
        Seat.objects.create(flight_instance=fi, seat_number=str(i), seat_class="ECONOMY", status=SeatStatus.AVAILABLE)
    return fi

if __name__ == "__main__":
    create_mock_data()
    print("Done")
