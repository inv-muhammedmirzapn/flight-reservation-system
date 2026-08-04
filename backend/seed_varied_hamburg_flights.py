import os
import django
import random
from datetime import datetime, date, time, timedelta
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

from django.utils import timezone
from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, InstanceStatus,
    Seat, CabinClass, SeatPosition, SeatStatus,
    Fare, RefundType
)

print("Starting expanded Hamburg flights seeding...")

# 1. Countries
india, _ = Country.objects.get_or_create(iso_code="IN", defaults={"name": "India"})
germany, _ = Country.objects.get_or_create(iso_code="DE", defaults={"name": "Germany"})
uae, _ = Country.objects.get_or_create(iso_code="AE", defaults={"name": "United Arab Emirates"})
qatar, _ = Country.objects.get_or_create(iso_code="QA", defaults={"name": "Qatar"})
turkey, _ = Country.objects.get_or_create(iso_code="TR", defaults={"name": "Turkey"})

# 2. Airports
del_airport, _ = Airport.objects.get_or_create(
    iata_code="DEL",
    defaults={
        "airport_name": "Indira Gandhi International Airport",
        "city": "New Delhi",
        "timezone": "Asia/Kolkata",
        "country": india,
        "terminals": ["T1", "T2", "T3"],
    }
)

ham_airport, _ = Airport.objects.get_or_create(
    iata_code="HAM",
    defaults={
        "airport_name": "Hamburg Airport",
        "city": "Hamburg",
        "timezone": "Europe/Berlin",
        "latitude": Decimal("53.630389"),
        "longitude": Decimal("9.988222"),
        "country": germany,
        "terminals": ["1", "2"],
    }
)

dxb_airport, _ = Airport.objects.get_or_create(
    iata_code="DXB",
    defaults={
        "airport_name": "Dubai International Airport",
        "city": "Dubai",
        "timezone": "Asia/Dubai",
        "country": uae,
        "terminals": ["1", "2", "3"],
    }
)

doh_airport, _ = Airport.objects.get_or_create(
    iata_code="DOH",
    defaults={
        "airport_name": "Hamad International Airport",
        "city": "Doha",
        "timezone": "Asia/Qatar",
        "country": qatar,
        "terminals": ["T1"],
    }
)

ist_airport, _ = Airport.objects.get_or_create(
    iata_code="IST",
    defaults={
        "airport_name": "Istanbul Airport",
        "city": "Istanbul",
        "timezone": "Europe/Istanbul",
        "country": turkey,
        "terminals": ["Main"],
    }
)

auh_airport, _ = Airport.objects.get_or_create(
    iata_code="AUH",
    defaults={
        "airport_name": "Zayed International Airport",
        "city": "Abu Dhabi",
        "timezone": "Asia/Dubai",
        "country": uae,
        "terminals": ["A"],
    }
)

bom_airport, _ = Airport.objects.get_or_create(
    iata_code="BOM",
    defaults={
        "airport_name": "Chhatrapati Shivaji Maharaj International Airport",
        "city": "Mumbai",
        "timezone": "Asia/Kolkata",
        "country": india,
        "terminals": ["T1", "T2"],
    }
)

fra_airport, _ = Airport.objects.get_or_create(
    iata_code="FRA",
    defaults={
        "airport_name": "Frankfurt Airport",
        "city": "Frankfurt",
        "timezone": "Europe/Berlin",
        "country": germany,
        "terminals": ["1", "2"],
    }
)

muc_airport, _ = Airport.objects.get_or_create(
    iata_code="MUC",
    defaults={
        "airport_name": "Munich Airport",
        "city": "Munich",
        "timezone": "Europe/Berlin",
        "country": germany,
        "terminals": ["1", "2"],
    }
)

# 3. Airlines
lufthansa, _ = Airline.objects.get_or_create(iata_airline_code="LH", defaults={"airline_name": "Lufthansa"})
air_india, _ = Airline.objects.get_or_create(iata_airline_code="AI", defaults={"airline_name": "Air India"})
emirates, _ = Airline.objects.get_or_create(iata_airline_code="EK", defaults={"airline_name": "Emirates"})
qatar_air, _ = Airline.objects.get_or_create(iata_airline_code="QR", defaults={"airline_name": "Qatar Airways"})
turkish, _ = Airline.objects.get_or_create(iata_airline_code="TK", defaults={"airline_name": "Turkish Airlines"})
etihad, _ = Airline.objects.get_or_create(iata_airline_code="EY", defaults={"airline_name": "Etihad Airways"})

# 4. Aircraft
b789, _ = AircraftModel.objects.get_or_create(manufacturer="Boeing", model_name="787-9 Dreamliner")
a350, _ = AircraftModel.objects.get_or_create(manufacturer="Airbus", model_name="A350-900")
b773, _ = AircraftModel.objects.get_or_create(manufacturer="Boeing", model_name="777-300ER")

ac_lh, _ = Aircraft.objects.get_or_create(registration="D-ABPA", defaults={"airline": lufthansa, "aircraft_model": b789, "economy_capacity": 180, "business_capacity": 30, "first_class_capacity": 10})
ac_ai, _ = Aircraft.objects.get_or_create(registration="VT-ANP", defaults={"airline": air_india, "aircraft_model": a350, "economy_capacity": 200, "business_capacity": 32, "first_class_capacity": 8})
ac_ek, _ = Aircraft.objects.get_or_create(registration="A6-EPD", defaults={"airline": emirates, "aircraft_model": b773, "economy_capacity": 250, "business_capacity": 42, "first_class_capacity": 12})
ac_qr, _ = Aircraft.objects.get_or_create(registration="A7-BHA", defaults={"airline": qatar_air, "aircraft_model": b789, "economy_capacity": 180, "business_capacity": 30, "first_class_capacity": 8})
ac_tk, _ = Aircraft.objects.get_or_create(registration="TC-LGA", defaults={"airline": turkish, "aircraft_model": a350, "economy_capacity": 220, "business_capacity": 28, "first_class_capacity": 0})
ac_ey, _ = Aircraft.objects.get_or_create(registration="A6-BLA", defaults={"airline": etihad, "aircraft_model": b789, "economy_capacity": 190, "business_capacity": 28, "first_class_capacity": 8})

# 5. Define Route Specs
# Structure: (flight_no, airline, aircraft, schedule_type, dep_time, base_fare, legs_list)
# legs_list: [(dep_ap, arr_ap, dur_mins, layover_mins), ...]
routes_specs = [
    # 0 STOPS (Direct)
    ("LH761", lufthansa, ac_lh, "DAILY", time(2, 30), 45000, [
        (del_airport, ham_airport, 570, 0) # 9h 30m
    ]),
    ("AI121", air_india, ac_ai, "ODD_DAYS", time(10, 15), 38000, [
        (del_airport, ham_airport, 585, 0) # 9h 45m
    ]),

    # 1 STOP
    ("EK061", emirates, ac_ek, "DAILY", time(4, 15), 42500, [
        (del_airport, dxb_airport, 225, 0),   # 3h 45m DEL -> DXB
        (dxb_airport, ham_airport, 410, 135) # 6h 50m DXB -> HAM, 2h 15m layover
    ]),
    ("QR078", qatar_air, ac_qr, "EVEN_DAYS", time(9, 40), 39900, [
        (del_airport, doh_airport, 250, 0),   # 4h 10m DEL -> DOH
        (doh_airport, ham_airport, 405, 105) # 6h 45m DOH -> HAM, 1h 45m layover
    ]),
    ("TK103", turkish, ac_tk, "EVERY_3RD_DAY", time(23, 20), 36500, [
        (del_airport, ist_airport, 390, 0),   # 6h 30m DEL -> IST
        (ist_airport, ham_airport, 210, 190) # 3h 30m IST -> HAM, 3h 10m layover
    ]),
    ("EY212", etihad, ac_ey, "MWFS", time(18, 5), 41000, [
        (del_airport, auh_airport, 230, 0),   # 3h 50m DEL -> AUH
        (auh_airport, ham_airport, 415, 150) # 6h 55m AUH -> HAM, 2h 30m layover
    ]),

    # 2 STOPS
    ("AI777", air_india, ac_ai, "ODD_DAYS", time(6, 0), 32000, [
        (del_airport, bom_airport, 130, 0),   # 2h 10m DEL -> BOM
        (bom_airport, fra_airport, 550, 120), # 9h 10m BOM -> FRA, 2h layover
        (fra_airport, ham_airport, 65, 110)   # 1h 05m FRA -> HAM, 1h 50m layover
    ]),
    ("LH402", lufthansa, ac_lh, "TTS", time(14, 20), 48000, [
        (del_airport, muc_airport, 490, 0),   # 8h 10m DEL -> MUC
        (muc_airport, fra_airport, 60, 90),   # 1h 00m MUC -> FRA, 1h 30m layover
        (fra_airport, ham_airport, 65, 105)   # 1h 05m FRA -> HAM, 1h 45m layover
    ])
]

created_routes_map = {}
for fno, airline, ac, sched, dep_t, fare, legs in routes_specs:
    fr, _ = FlightRoute.objects.get_or_create(
        flight_no=fno,
        defaults={
            "airline": airline,
            "baggage_weight_allowed_per_person": 30,
            "baggage_number_allowed_per_person": 2,
            "handbag_weight_allowed_per_person": 8,
        }
    )
    # Clear existing legs to update accurately
    FlightLeg.objects.filter(flight=fr).delete()
    
    for idx, (dep_ap, arr_ap, dur_m, layover_m) in enumerate(legs, start=1):
        FlightLeg.objects.create(
            flight=fr,
            leg_order=idx,
            departure_airport=dep_ap,
            arrival_airport=arr_ap,
            flight_duration_minutes=dur_m,
            layover_duration_minutes=layover_m,
        )
    created_routes_map[fno] = (fr, ac, sched, dep_t, fare, legs)

# Clear any instances outside August for these DEL-HAM routes
all_routes = [fr for fr, _, _, _, _, _ in created_routes_map.values()]
FlightInstance.objects.filter(flight__in=all_routes).exclude(date__month=8).delete()

# 6. Generate Flight Instances for all of August 2026 (Aug 1 to Aug 31)
start_dt = date(2026, 8, 1)
num_days = 31

from django.db import transaction

total_instances_created = 0
with transaction.atomic():
    for day_idx in range(num_days):
        curr_date = start_dt + timedelta(days=day_idx)
        weekday = curr_date.weekday() # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
        day_num = curr_date.day
        
        for fno, (fr, ac, sched, dep_t, base_fare, legs) in created_routes_map.items():
            # Check schedule filter
            should_run = False
            if sched == "DAILY":
                should_run = True
            elif sched == "ODD_DAYS" and day_num % 2 != 0:
                should_run = True
            elif sched == "EVEN_DAYS" and day_num % 2 == 0:
                should_run = True
            elif sched == "EVERY_3RD_DAY" and day_num % 3 == 0:
                should_run = True
            elif sched == "MWFS" and weekday in [0, 2, 4, 6]:
                should_run = True
            elif sched == "TTS" and weekday in [1, 3, 5]:
                should_run = True
                
            if not should_run:
                continue
            
        # Calculate total journey duration including layovers
        total_minutes = sum(l[2] + l[3] for l in legs)
        
        dep_datetime = datetime.combine(curr_date, dep_t)
        if timezone.is_naive(dep_datetime):
            dep_datetime = timezone.make_aware(dep_datetime)
            
        arr_datetime = dep_datetime + timedelta(minutes=total_minutes)
        
        inst, created = FlightInstance.objects.get_or_create(
            flight=fr,
            date=curr_date,
            scheduled_departure=dep_datetime,
            defaults={
                "aircraft": ac,
                "status": InstanceStatus.SCHEDULED,
                "scheduled_arrival": arr_datetime,
                "checkin_open": dep_datetime - timedelta(hours=24),
                "boarding_time": dep_datetime - timedelta(minutes=45),
                "boarding_gate": f"G{random.randint(1, 25)}",
                "departure_terminal": "T3",
                "arrival_terminal": "T1",
            }
        )
        total_instances_created += 1
        
        # Decide if fully booked (for waitlist test cases)
        is_full = (day_num + len(fno)) % 7 == 0
        if is_full:
            econ_seats = 0
            biz_seats = 0
            fst_seats = 0
        else:
            econ_seats = random.randint(20, 110)
            biz_seats = random.randint(4, 18)
            fst_seats = random.randint(1, 6)
            
        # Variations in daily pricing (+/- 15% range to create price differences for date carousel)
        price_factor = 1.0 + random.uniform(-0.12, 0.15)
        day_econ_fare = round(base_fare * price_factor, -2) # round to nearest 100
        
        Fare.objects.update_or_create(
            flight_instance=inst,
            cabin_class=CabinClass.ECONOMY,
            defaults={
                "fare_code": f"ECO-{inst.id}",
                "price": Decimal(str(day_econ_fare)),
                "currency": "INR",
                "available_seats": econ_seats,
                "refund_type": RefundType.PARTIAL if not is_full else RefundType.NON_REFUNDABLE,
                "change_fee": Decimal("3500.00"),
                "meal_included": True,
                "baggage_allowance": Decimal("30.0"),
            }
        )
        
        Fare.objects.update_or_create(
            flight_instance=inst,
            cabin_class=CabinClass.BUSINESS,
            defaults={
                "fare_code": f"BIZ-{inst.id}",
                "price": Decimal(str(round(day_econ_fare * 2.7, -2))),
                "currency": "INR",
                "available_seats": biz_seats,
                "refund_type": RefundType.REFUNDABLE,
                "change_fee": Decimal("0.00"),
                "meal_included": True,
                "baggage_allowance": Decimal("40.0"),
            }
        )
        
        Fare.objects.update_or_create(
            flight_instance=inst,
            cabin_class=CabinClass.FIRST,
            defaults={
                "fare_code": f"FST-{inst.id}",
                "price": Decimal(str(round(day_econ_fare * 4.8, -2))),
                "currency": "INR",
                "available_seats": fst_seats,
                "refund_type": RefundType.REFUNDABLE,
                "change_fee": Decimal("0.00"),
                "meal_included": True,
                "baggage_allowance": Decimal("50.0"),
            }
        )

print(f"Successfully seeded {total_instances_created} flight instances with varied schedules, stops, and dynamic prices from DEL to HAM!")
