import random
from decimal import Decimal
from datetime import datetime, date, time, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.flights.models import (
    Country, Airport, Airline, Aircraft,
    FlightRoute, FlightLeg, RouteFareClass, CabinClass, RefundType
)
from apps.flights.services_generation import generate_upcoming_instances

class Command(BaseCommand):
    help = "Appends the custom destinations (GYD, NGO, EWR, DOH, IST) and their routes to the database without wiping existing data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Number of days for rolling flight instance generation (default: 30).",
        )

    def handle(self, *args, **options):
        horizon_days = options["days"]
        self.stdout.write("Appending custom destinations safely...")

        # 1. Countries
        c_az, _ = Country.objects.get_or_create(iso_code="AZ", defaults={"name": "Azerbaijan"})
        c_jp, _ = Country.objects.get_or_create(iso_code="JP", defaults={"name": "Japan"})
        c_us, _ = Country.objects.get_or_create(iso_code="US", defaults={"name": "United States"})
        c_qa, _ = Country.objects.get_or_create(iso_code="QA", defaults={"name": "Qatar"})
        c_tr, _ = Country.objects.get_or_create(iso_code="TR", defaults={"name": "Turkey"})

        # 2. Airports
        airports_data = [
            ("GYD", "Heydar Aliyev International Airport", "Baku", "Asia/Baku", Decimal("40.4675"), Decimal("50.046667"), c_az, ["1", "2"]),
            ("NGO", "Chubu Centrair International Airport", "Nagoya", "Asia/Tokyo", Decimal("34.858333"), Decimal("136.805278"), c_jp, ["1", "2"]),
            ("EWR", "Newark Liberty International Airport", "New York", "America/New_York", Decimal("40.6925"), Decimal("-74.168611"), c_us, ["A", "B", "C"]),
            ("DOH", "Hamad International Airport", "Doha", "Asia/Qatar", Decimal("25.273056"), Decimal("51.608056"), c_qa, ["1"]),
            ("IST", "Istanbul Airport", "Istanbul", "Europe/Istanbul", Decimal("41.259722"), Decimal("28.745556"), c_tr, ["1"]),
        ]
        
        for iata, name, city, tz, lat, lon, country, term in airports_data:
            Airport.objects.get_or_create(
                iata_code=iata,
                defaults={
                    "airport_name": name,
                    "city": city,
                    "timezone": tz,
                    "latitude": lat,
                    "longitude": lon,
                    "country": country,
                    "terminals": term,
                }
            )

        # 3. Routes from DEL and COK
        del_ap = Airport.objects.filter(iata_code="DEL").first()
        cok_ap = Airport.objects.filter(iata_code="COK").first()
        
        if not del_ap or not cok_ap:
            self.stdout.write(self.style.ERROR("DEL or COK not found in DB! Cannot add routes."))
            return

        airlines_dict = {
            "AI": Airline.objects.filter(iata_airline_code="AI").first(),
            "QR": Airline.objects.filter(iata_airline_code="QR").first(),
            "TK": Airline.objects.filter(iata_airline_code="TK").first(),
        }
        
        aircraft_dict = {
            "VT-ALN": Aircraft.objects.filter(registration="VT-ALN").first(),
            "A7-BBA": Aircraft.objects.filter(registration="A7-BBA").first(),
            "TC-JNA": Aircraft.objects.filter(registration="TC-JNA").first(),
        }

        today = date.today()
        valid_from_date = today - timedelta(days=30)

        routes_data = [
            # From DEL
            ("AI801", "AI", "DEL", "GYD", 4, 30, "VT-ALN", Decimal("22000.00"), time(10, 0)),
            ("AI803", "AI", "DEL", "NGO", 8, 15, "VT-ALN", Decimal("45000.00"), time(22, 30)),
            ("AI805", "AI", "DEL", "EWR", 15, 0, "VT-ALN", Decimal("78000.00"), time(2, 15)),
            ("QR501", "QR", "DEL", "DOH", 4, 15, "A7-BBA", Decimal("18000.00"), time(11, 0)),
            ("TK701", "TK", "DEL", "IST", 7, 0, "TC-JNA", Decimal("35000.00"), time(6, 45)),
            # From COK
            ("AI807", "AI", "COK", "GYD", 5, 45, "VT-ALN", Decimal("26000.00"), time(9, 30)),
            ("AI809", "AI", "COK", "NGO", 9, 30, "VT-ALN", Decimal("48000.00"), time(21, 0)),
            ("AI811", "AI", "COK", "EWR", 16, 30, "VT-ALN", Decimal("82000.00"), time(1, 45)),
            ("QR503", "QR", "COK", "DOH", 4, 45, "A7-BBA", Decimal("20000.00"), time(10, 30)),
            ("TK703", "TK", "COK", "IST", 8, 15, "TC-JNA", Decimal("38000.00"), time(5, 45)),
        ]

        new_route_ids = []

        for fno, al_code, dep_code, arr_code, hrs, mins, ac_reg, base_fare, dep_t in routes_data:
            sch_dep = datetime.combine(today, dep_t)
            sch_arr = sch_dep + timedelta(hours=hrs, minutes=mins)
            
            airline = airlines_dict.get(al_code)
            aircraft = aircraft_dict.get(ac_reg)
            dep_airport = Airport.objects.filter(iata_code=dep_code).first()
            arr_airport = Airport.objects.filter(iata_code=arr_code).first()

            if not all([airline, aircraft, dep_airport, arr_airport]):
                self.stdout.write(self.style.WARNING(f"Skipping route {fno} due to missing references."))
                continue

            fr, created = FlightRoute.objects.get_or_create(
                flight_no=fno,
                defaults={
                    "airline": airline,
                    "operates_on_days": "1,2,3,4,5,6,7",
                    "scheduled_departure_time": dep_t,
                    "scheduled_arrival_time": sch_arr.time(),
                    "valid_from": valid_from_date,
                    "is_active": True,
                    "baggage_weight_allowed_per_person": 30,
                    "baggage_number_allowed_per_person": 2,
                    "handbag_weight_allowed_per_person": 7,
                    "aircraft": aircraft,
                }
            )

            if created:
                new_route_ids.append(fr.id)
                FlightLeg.objects.get_or_create(
                    flight=fr,
                    leg_order=1,
                    defaults={
                        "departure_airport": dep_airport,
                        "arrival_airport": arr_airport,
                        "departure_terminal": dep_airport.terminals[0] if dep_airport.terminals else "T1",
                        "arrival_terminal": arr_airport.terminals[0] if arr_airport.terminals else "T1",
                        "flight_duration_minutes": hrs * 60 + mins,
                        "layover_duration_minutes": 0,
                        "scheduled_departure_time": dep_t,
                        "scheduled_arrival_time": sch_arr.time(),
                        "scheduled_departure": timezone.make_aware(sch_dep),
                        "scheduled_arrival": timezone.make_aware(sch_arr),
                    }
                )

                RouteFareClass.objects.get_or_create(
                    route=fr,
                    cabin_class=CabinClass.ECONOMY,
                    fare_code="ECO_STD",
                    defaults={
                        "base_price": base_fare,
                        "currency": "INR",
                        "refund_type": RefundType.PARTIAL,
                        "change_fee": Decimal("3000.00"),
                        "meal_included": True,
                        "baggage_weight_allowed_kg": 30,
                    }
                )

        self.stdout.write(f"Generating instances for the {len(new_route_ids)} new routes over {horizon_days} days...")
        for route_id in new_route_ids:
            generate_upcoming_instances(route_id=route_id, horizon_days=horizon_days)

        self.stdout.write(self.style.SUCCESS("Custom destinations successfully appended!"))
