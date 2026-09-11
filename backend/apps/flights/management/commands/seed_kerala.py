import random
from datetime import datetime, date, time, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, InstanceStatus,
    Seat, CabinClass, SeatStatus, Fare, RefundType, RouteFareClass,
)
from apps.flights.services import generate_seats_for_instance
from apps.flights.services_generation import generate_upcoming_instances


class Command(BaseCommand):
    help = "Seeds Kerala airports (COK, TRV, CCJ, CNN) and their domestic + international flight routes. Additive only — does not remove existing data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Number of days for rolling flight instance generation (default: 30).",
        )

    def handle(self, *args, **options):
        horizon_days = options["days"]
        self.stdout.write(self.style.WARNING("Starting Kerala airports & flights seeding (additive only)..."))

        # -----------------------------------------------------------------
        # 1. Ensure India country exists
        # -----------------------------------------------------------------
        india, _ = Country.objects.get_or_create(iso_code="IN", defaults={"name": "India"})
        uae, _ = Country.objects.get_or_create(iso_code="AE", defaults={"name": "United Arab Emirates"})

        # -----------------------------------------------------------------
        # 2. Kerala Airports
        # -----------------------------------------------------------------
        self.stdout.write("1. Seeding Kerala Airports...")
        kerala_airports_data = [
            ("COK", "Cochin International Airport", "Kochi", "Asia/Kolkata", Decimal("10.152000"), Decimal("76.401900"), india, ["T1", "T2", "T3"]),
            ("TRV", "Trivandrum International Airport", "Thiruvananthapuram", "Asia/Kolkata", Decimal("8.482100"), Decimal("76.919900"), india, ["T1", "T2"]),
            ("CCJ", "Calicut International Airport", "Kozhikode", "Asia/Kolkata", Decimal("11.136800"), Decimal("75.955300"), india, ["T1"]),
            ("CNN", "Kannur International Airport", "Kannur", "Asia/Kolkata", Decimal("11.918700"), Decimal("75.547200"), india, ["T1"]),
        ]
        airports_dict = {}
        for iata, name, city, tz, lat, lon, country, terminals in kerala_airports_data:
            ap, created = Airport.objects.get_or_create(
                iata_code=iata,
                defaults={
                    "airport_name": name,
                    "city": city,
                    "timezone": tz,
                    "latitude": lat,
                    "longitude": lon,
                    "country": country,
                    "terminals": terminals,
                }
            )
            airports_dict[iata] = ap
            if created:
                self.stdout.write(self.style.SUCCESS(f"   Created airport: {iata} – {name}"))
            else:
                self.stdout.write(f"   Airport {iata} already exists, skipping.")

        # -----------------------------------------------------------------
        # 3. Lookup existing airports & airlines needed for routes
        # -----------------------------------------------------------------
        self.stdout.write("2. Looking up existing airports & airlines...")
        for iata in ["DEL", "BOM", "DXB", "HAM", "FRA"]:
            ap = Airport.objects.filter(iata_code=iata).first()
            if ap:
                airports_dict[iata] = ap
            else:
                self.stdout.write(self.style.WARNING(f"   WARNING: Airport {iata} not found. Routes involving {iata} will be skipped."))

        airlines_dict = {}
        for code in ["AI", "6E", "EK", "LH"]:
            al = Airline.objects.filter(iata_airline_code=code).first()
            if al:
                airlines_dict[code] = al
            else:
                self.stdout.write(self.style.WARNING(f"   WARNING: Airline {code} not found. Routes with {code} will be skipped."))

        aircraft_dict = {}
        for reg in ["VT-ALN", "VT-IZI", "A6-EEO", "D-ABPA", "D-AIXA"]:
            ac = Aircraft.objects.filter(registration=reg).first()
            if ac:
                aircraft_dict[reg] = ac
            else:
                self.stdout.write(self.style.WARNING(f"   WARNING: Aircraft {reg} not found."))

        # -----------------------------------------------------------------
        # 4. Kerala Flight Routes
        # -----------------------------------------------------------------
        self.stdout.write("3. Seeding Kerala Flight Routes & Legs...")
        today = date.today()
        valid_from_date = today - timedelta(days=30)

        # (flight_no, airline_code, dep_airport, arr_airport, dur_hrs, dur_mins, aircraft_reg, base_fare_inr, departure_time)
        kerala_routes = [
            # Domestic – To/From Kochi (COK)
            ("AI681", "AI", "DEL", "COK", 3, 10, "VT-ALN", Decimal("8500.00"), time(6, 0)),
            ("6E301", "6E", "DEL", "COK", 3, 15, "VT-IZI", Decimal("5200.00"), time(5, 30)),
            ("AI683", "AI", "BOM", "COK", 1, 50, "VT-ALN", Decimal("5800.00"), time(10, 30)),
            ("6E303", "6E", "BOM", "COK", 1, 45, "VT-IZI", Decimal("3800.00"), time(14, 0)),
            # Domestic – To/From Trivandrum (TRV)
            ("AI685", "AI", "DEL", "TRV", 3, 15, "VT-ALN", Decimal("9200.00"), time(7, 15)),
            ("6E305", "6E", "DEL", "TRV", 3, 20, "VT-IZI", Decimal("5500.00"), time(22, 0)),
            ("6E307", "6E", "BOM", "TRV", 1, 55, "VT-IZI", Decimal("4200.00"), time(16, 30)),
            # Domestic – To/From Kozhikode (CCJ)
            ("AI687", "AI", "DEL", "CCJ", 3, 5, "VT-ALN", Decimal("8800.00"), time(9, 0)),
            ("6E309", "6E", "DEL", "CCJ", 3, 10, "VT-IZI", Decimal("5000.00"), time(11, 45)),
            ("6E311", "6E", "BOM", "CCJ", 1, 40, "VT-IZI", Decimal("3600.00"), time(8, 15)),
            # Domestic – To/From Kannur (CNN)
            ("6E313", "6E", "DEL", "CNN", 3, 20, "VT-IZI", Decimal("5300.00"), time(13, 0)),
            # International – Kerala ↔ Dubai
            ("AI689", "AI", "COK", "DXB", 4, 10, "VT-ALN", Decimal("16000.00"), time(3, 30)),
            ("EK529", "EK", "DXB", "COK", 4, 15, "A6-EEO", Decimal("18000.00"), time(9, 45)),
            ("AI691", "AI", "TRV", "DXB", 4, 20, "VT-ALN", Decimal("16500.00"), time(2, 0)),
            ("EK531", "EK", "DXB", "TRV", 4, 25, "A6-EEO", Decimal("18500.00"), time(10, 15)),
            ("AI693", "AI", "CCJ", "DXB", 4, 30, "VT-ALN", Decimal("17000.00"), time(4, 0)),
            # Direct Kerala -> Hamburg (COK -> HAM)
            ("AI123", "AI", "COK", "HAM", 8, 30, "VT-ALN", Decimal("39000.00"), time(6, 45)),
            ("LH763", "LH", "COK", "HAM", 9, 15, "D-ABPA", Decimal("43000.00"), time(2, 45)),
            ("EK063", "EK", "COK", "HAM", 8, 45, "A6-EEO", Decimal("47000.00"), time(14, 30)),
            ("6E193", "6E", "COK", "HAM", 14, 0, "VT-IZI", Decimal("25000.00"), time(23, 15)),
        ]

        created_routes_count = 0
        skipped_routes_count = 0

        for fno, al_code, dep_code, arr_code, hrs, mins, ac_reg, base_fare, dep_t in kerala_routes:
            # Skip if required entities are missing
            if al_code not in airlines_dict:
                self.stdout.write(f"   Skipping {fno}: airline {al_code} not found.")
                skipped_routes_count += 1
                continue
            if dep_code not in airports_dict or arr_code not in airports_dict:
                self.stdout.write(f"   Skipping {fno}: airport {dep_code} or {arr_code} not found.")
                skipped_routes_count += 1
                continue

            sch_dep = datetime.combine(today, dep_t)
            sch_arr = sch_dep + timedelta(hours=hrs, minutes=mins)

            fr, created = FlightRoute.objects.get_or_create(
                flight_no=fno,
                defaults={
                    "airline": airlines_dict[al_code],
                    "operates_on_days": "1,2,3,4,5,6,7",
                    "scheduled_departure_time": dep_t,
                    "scheduled_arrival_time": sch_arr.time(),
                    "valid_from": valid_from_date,
                    "is_active": True,
                    "baggage_weight_allowed_per_person": 25 if al_code == "6E" else 30,
                    "baggage_number_allowed_per_person": 1 if al_code == "6E" else 2,
                    "handbag_weight_allowed_per_person": 7,
                    "aircraft": aircraft_dict.get(ac_reg),
                }
            )

            FlightLeg.objects.get_or_create(
                flight=fr,
                leg_order=1,
                defaults={
                    "departure_airport": airports_dict[dep_code],
                    "arrival_airport": airports_dict[arr_code],
                    "departure_terminal": airports_dict[dep_code].terminals[0] if airports_dict[dep_code].terminals else "T1",
                    "arrival_terminal": airports_dict[arr_code].terminals[0] if airports_dict[arr_code].terminals else "T1",
                    "flight_duration_minutes": hrs * 60 + mins,
                    "layover_duration_minutes": 0,
                    "scheduled_departure_time": dep_t,
                    "scheduled_arrival_time": sch_arr.time(),
                    "scheduled_departure": timezone.make_aware(sch_dep),
                    "scheduled_arrival": timezone.make_aware(sch_arr),
                }
            )

            # Economy fare class
            RouteFareClass.objects.get_or_create(
                route=fr,
                cabin_class=CabinClass.ECONOMY,
                fare_code="ECO_STD",
                defaults={
                    "base_price": base_fare,
                    "currency": "INR",
                    "refund_type": RefundType.PARTIAL,
                    "change_fee": Decimal("2500.00"),
                    "meal_included": al_code != "6E",
                    "baggage_weight_allowed_kg": 25 if al_code == "6E" else 30,
                }
            )

            # Business fare class (only for airlines that have business class)
            if ac_reg in aircraft_dict and aircraft_dict[ac_reg].business_capacity > 0:
                RouteFareClass.objects.get_or_create(
                    route=fr,
                    cabin_class=CabinClass.BUSINESS,
                    fare_code="BIZ_STD",
                    defaults={
                        "base_price": (base_fare * Decimal("2.5")).quantize(Decimal("0.01")),
                        "currency": "INR",
                        "refund_type": RefundType.REFUNDABLE,
                        "change_fee": Decimal("0.00"),
                        "meal_included": True,
                        "baggage_weight_allowed_kg": 40,
                    }
                )

            if created:
                created_routes_count += 1
                self.stdout.write(self.style.SUCCESS(f"   Created route: {fno} ({dep_code} → {arr_code})"))
            else:
                skipped_routes_count += 1
                self.stdout.write(f"   Route {fno} already exists, skipping.")

        # 1-Stop Connecting Routes for Kerala (e.g. COK -> Layover -> HAM)
        connecting_kerala_routes = [
            ("LH765-C", "LH", "D-AIXA", Decimal("44000.00"), time(2, 30), [
                ("COK", "FRA", 550, 0, time(2, 30)),
                ("FRA", "HAM", 70, 100, time(13, 10)),
            ]),
            ("EK507-C", "EK", "A6-EEO", Decimal("49000.00"), time(9, 30), [
                ("COK", "DXB", 250, 0, time(9, 30)),
                ("DXB", "HAM", 390, 135, time(15, 45)),
            ]),
        ]

        for fno, al_code, ac_reg, base_fare, dep_t, legs_info in connecting_kerala_routes:
            if al_code not in airlines_dict:
                continue
            last_leg_info = legs_info[-1]
            last_sch_dep = datetime.combine(today, last_leg_info[4])
            last_sch_arr = last_sch_dep + timedelta(minutes=last_leg_info[2])
            fr, created = FlightRoute.objects.get_or_create(
                flight_no=fno,
                defaults={
                    "airline": airlines_dict[al_code],
                    "operates_on_days": "1,2,3,4,5,6,7",
                    "scheduled_departure_time": dep_t,
                    "scheduled_arrival_time": last_sch_arr.time(),
                    "valid_from": valid_from_date,
                    "is_active": True,
                    "baggage_weight_allowed_per_person": 30,
                    "baggage_number_allowed_per_person": 2,
                    "handbag_weight_allowed_per_person": 7,
                    "aircraft": aircraft_dict.get(ac_reg),
                }
            )
            for idx, (dep_ap, arr_ap, dur_m, lay_m, leg_dep_t) in enumerate(legs_info, start=1):
                sch_dep = timezone.make_aware(datetime.combine(today, leg_dep_t))
                sch_arr = sch_dep + timedelta(minutes=dur_m)
                FlightLeg.objects.get_or_create(
                    flight=fr,
                    leg_order=idx,
                    defaults={
                        "departure_airport": airports_dict[dep_ap],
                        "arrival_airport": airports_dict[arr_ap],
                        "departure_terminal": airports_dict[dep_ap].terminals[0] if airports_dict[dep_ap].terminals else "T1",
                        "arrival_terminal": airports_dict[arr_ap].terminals[0] if airports_dict[arr_ap].terminals else "T1",
                        "flight_duration_minutes": dur_m,
                        "layover_duration_minutes": lay_m,
                        "scheduled_departure_time": leg_dep_t,
                        "scheduled_arrival_time": sch_arr.time(),
                        "scheduled_departure": sch_dep,
                        "scheduled_arrival": sch_arr,
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
            if ac_reg in aircraft_dict and aircraft_dict[ac_reg].business_capacity > 0:
                RouteFareClass.objects.get_or_create(
                    route=fr,
                    cabin_class=CabinClass.BUSINESS,
                    fare_code="BIZ_STD",
                    defaults={
                        "base_price": (base_fare * Decimal("2.5")).quantize(Decimal("0.01")),
                        "currency": "INR",
                        "refund_type": RefundType.REFUNDABLE,
                        "change_fee": Decimal("0.00"),
                        "meal_included": True,
                        "baggage_weight_allowed_kg": 40,
                    }
                )
            if created:
                created_routes_count += 1
                self.stdout.write(self.style.SUCCESS(f"   Created connecting route: {fno}"))
            else:
                skipped_routes_count += 1

        # -----------------------------------------------------------------
        # 5. Generate Flight Instances for Kerala routes
        # -----------------------------------------------------------------
        self.stdout.write(f"4. Generating Flight Instances for Kerala routes ({horizon_days}-day horizon)...")

        # Generate instances only for Kerala routes
        kerala_flight_nos = [r[0] for r in kerala_routes] + [r[0] for r in connecting_kerala_routes]
        kerala_route_objs = FlightRoute.objects.filter(flight_no__in=kerala_flight_nos, is_active=True)

        total_instances = 0
        total_seats = 0
        total_fares = 0
        for route in kerala_route_objs:
            result = generate_upcoming_instances(horizon_days=horizon_days, route_id=route.id)
            total_instances += result["created_instances_count"]
            total_seats += result["created_seats_count"]
            total_fares += result["created_fares_count"]

        self.stdout.write(
            f"   Created {total_instances} instances, "
            f"{total_seats} seats, {total_fares} fares."
        )

        # -----------------------------------------------------------------
        # Summary
        # -----------------------------------------------------------------
        self.stdout.write(self.style.SUCCESS(
            "\n======================================================================\n"
            "KERALA SEEDING COMPLETE!\n"
            "======================================================================\n"
            f"Airports added: {len(kerala_airports_data)}\n"
            f"  - COK (Cochin/Kochi)\n"
            f"  - TRV (Trivandrum/Thiruvananthapuram)\n"
            f"  - CCJ (Calicut/Kozhikode)\n"
            f"  - CNN (Kannur)\n"
            f"Routes created: {created_routes_count} | Skipped: {skipped_routes_count}\n"
            f"Instances: {total_instances} | Seats: {total_seats} | Fares: {total_fares}\n"
            "======================================================================"
        ))
