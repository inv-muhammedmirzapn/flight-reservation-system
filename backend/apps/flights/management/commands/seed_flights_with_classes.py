import datetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, Seat, Fare,
    CabinClass, SeatStatus, InstanceStatus
)

class Command(BaseCommand):
    help = "Seeds database with realistic flight instances containing multiple fare classes."

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding flights with classes...")

        country, _ = Country.objects.get_or_create(name="India", iso_code="IN")
        delhi, _ = Airport.objects.get_or_create(iata_code="DEL", defaults={"airport_name": "Indira Gandhi International", "city": "Delhi", "country": country})
        mumbai, _ = Airport.objects.get_or_create(iata_code="BOM", defaults={"airport_name": "Chhatrapati Shivaji Maharaj", "city": "Mumbai", "country": country})
        bangalore, _ = Airport.objects.get_or_create(iata_code="BLR", defaults={"airport_name": "Kempegowda International", "city": "Bangalore", "country": country})
        
        airline, _ = Airline.objects.get_or_create(iata_airline_code="AI", defaults={"airline_name": "Air India"})
        model, _ = AircraftModel.objects.get_or_create(manufacturer="Boeing", model_name="737-800")
        aircraft, _ = Aircraft.objects.get_or_create(
            registration="VT-XYZ",
            defaults={
                "airline": airline, "aircraft_model": model,
                "economy_capacity": 60, "business_capacity": 12, "first_class_capacity": 4
            }
        )

        routes = [
            (delhi, mumbai, "AI101"),
            (mumbai, bangalore, "AI102"),
            (bangalore, delhi, "AI103")
        ]

        now = timezone.now()
        
        for source, dest, flight_no in routes:
            route, _ = FlightRoute.objects.get_or_create(flight_no=flight_no, airline=airline)
            
            # create leg if not exists
            if not route.legs.exists():
                FlightLeg.objects.create(
                    flight=route, leg_order=1,
                    departure_airport=source, arrival_airport=dest,
                    scheduled_departure=now + datetime.timedelta(days=1),
                    scheduled_arrival=now + datetime.timedelta(days=1, hours=2)
                )

            # create instances
            for i in range(1, 4):
                dep_time = now + datetime.timedelta(days=i, hours=10)
                arr_time = dep_time + datetime.timedelta(hours=2)

                instance, created = FlightInstance.objects.get_or_create(
                    flight=route,
                    date=dep_time.date(),
                    defaults={
                        "aircraft": aircraft,
                        "status": InstanceStatus.SCHEDULED,
                        "scheduled_departure": dep_time,
                        "scheduled_arrival": arr_time
                    }
                )

                if created or not instance.seats.exists():
                    self.stdout.write(f"Generating seats and fares for {flight_no} on {dep_time.date()}")
                    
                    seats_to_create = []
                    # First
                    for j in range(1, aircraft.first_class_capacity + 1):
                        seats_to_create.append(Seat(flight_instance=instance, seat_number=f"F{j}", seat_class=CabinClass.FIRST, status=SeatStatus.AVAILABLE))
                    # Business
                    for j in range(1, aircraft.business_capacity + 1):
                        seats_to_create.append(Seat(flight_instance=instance, seat_number=f"B{j}", seat_class=CabinClass.BUSINESS, status=SeatStatus.AVAILABLE))
                    # Economy
                    for j in range(1, aircraft.economy_capacity + 1):
                        seats_to_create.append(Seat(flight_instance=instance, seat_number=f"E{j}", seat_class=CabinClass.ECONOMY, status=SeatStatus.AVAILABLE))
                    
                    Seat.objects.bulk_create(seats_to_create)

                # Generate Fares
                if not instance.fares.exists():
                    Fare.objects.create(flight_instance=instance, fare_code=f"ECO-{flight_no}", cabin_class=CabinClass.ECONOMY, price=Decimal("5000.00"), available_seats=aircraft.economy_capacity)
                    Fare.objects.create(flight_instance=instance, fare_code=f"BUS-{flight_no}", cabin_class=CabinClass.BUSINESS, price=Decimal("15000.00"), available_seats=aircraft.business_capacity)
                    Fare.objects.create(flight_instance=instance, fare_code=f"FIR-{flight_no}", cabin_class=CabinClass.FIRST, price=Decimal("35000.00"), available_seats=aircraft.first_class_capacity)

        self.stdout.write(self.style.SUCCESS("Database seeded with realistic flights, seats, and fares!"))
