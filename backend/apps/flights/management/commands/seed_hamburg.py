import random
from datetime import datetime, date, time, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, InstanceStatus,
    Seat, CabinClass, SeatPosition, SeatStatus,
    Fare, RefundType
)

class Command(BaseCommand):
    help = "Seeds flights from New Delhi (DEL) to Hamburg (HAM) starting from Aug 5th, 2026 onwards."

    def handle(self, *args, **options):
        self.stdout.write("Starting Hamburg flights seeding...")

        # 1. Country Germany
        germany, _ = Country.objects.get_or_create(
            iso_code="DE",
            defaults={"name": "Germany"}
        )

        # 2. Hamburg Airport (HAM)
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

        # 3. Delhi Airport (DEL)
        del_airport = Airport.objects.filter(iata_code="DEL").first()
        if not del_airport:
            india, _ = Country.objects.get_or_create(iso_code="IN", defaults={"name": "India"})
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

        # 4. Airlines
        lufthansa = Airline.objects.filter(iata_airline_code="LH").first()
        if not lufthansa:
            lufthansa, _ = Airline.objects.get_or_create(iata_airline_code="LH", defaults={"airline_name": "Lufthansa"})

        air_india = Airline.objects.filter(iata_airline_code="AI").first()
        if not air_india:
            air_india, _ = Airline.objects.get_or_create(iata_airline_code="AI", defaults={"airline_name": "Air India"})

        emirates = Airline.objects.filter(iata_airline_code="EK").first()
        if not emirates:
            emirates, _ = Airline.objects.get_or_create(iata_airline_code="EK", defaults={"airline_name": "Emirates"})

        aircraft_model, _ = AircraftModel.objects.get_or_create(manufacturer="Boeing", model_name="787-9 Dreamliner")

        aircraft_lh, _ = Aircraft.objects.get_or_create(
            registration="D-ABPA",
            defaults={
                "airline": lufthansa,
                "aircraft_model": aircraft_model,
                "economy_capacity": 150,
                "business_capacity": 30,
                "first_class_capacity": 10,
            }
        )

        aircraft_ai, _ = Aircraft.objects.get_or_create(
            registration="VT-ANP",
            defaults={
                "airline": air_india,
                "aircraft_model": aircraft_model,
                "economy_capacity": 150,
                "business_capacity": 30,
                "first_class_capacity": 10,
            }
        )

        aircraft_ek, _ = Aircraft.objects.get_or_create(
            registration="A6-EPD",
            defaults={
                "airline": emirates,
                "aircraft_model": aircraft_model,
                "economy_capacity": 150,
                "business_capacity": 30,
                "first_class_capacity": 10,
            }
        )

        # 5. Define Routes DEL -> HAM
        routes_info = [
            ("LH761", lufthansa, aircraft_lh, 9, 30, 45000),
            ("AI121", air_india, aircraft_ai, 10, 15, 38000),
            ("EK061", emirates, aircraft_ek, 11, 45, 52000),
        ]

        created_routes = {}
        for fno, airline, ac, duration_hrs, duration_mins, base_fare in routes_info:
            fr, _ = FlightRoute.objects.get_or_create(
                flight_no=fno,
                defaults={
                    "airline": airline,
                    "baggage_weight_allowed_per_person": 30,
                    "baggage_number_allowed_per_person": 2,
                    "handbag_weight_allowed_per_person": 8,
                }
            )
            created_routes[fno] = (fr, ac, duration_hrs, duration_mins, base_fare)
            
            FlightLeg.objects.get_or_create(
                flight=fr,
                leg_order=1,
                defaults={
                    "departure_airport": del_airport,
                    "arrival_airport": ham_airport,
                    "flight_duration_minutes": duration_hrs * 60 + duration_mins,
                    "layover_duration_minutes": 0,
                }
            )

        # 6. Generate Flight Instances starting Aug 5, 2026 up to Aug 18, 2026 (14 days)
        start_date = date(2026, 8, 5)
        num_days = 14

        count_created = 0
        zero_seat_count = 0

        for d_offset in range(num_days):
            current_date = start_date + timedelta(days=d_offset)
            
            for idx, (fno, (fr, ac, d_hrs, d_mins, base_fare)) in enumerate(created_routes.items()):
                dep_hours = [2, 6, 14][idx % 3]
                dep_mins = [30, 15, 0][idx % 3]
                
                dep_dt = datetime.combine(current_date, time(dep_hours, dep_mins))
                if timezone.is_naive(dep_dt):
                    dep_dt = timezone.make_aware(dep_dt)
                    
                arr_dt = dep_dt + timedelta(hours=d_hrs, minutes=d_mins)
                
                inst, created = FlightInstance.objects.get_or_create(
                    flight=fr,
                    date=current_date,
                    scheduled_departure=dep_dt,
                    defaults={
                        "aircraft": ac,
                        "status": InstanceStatus.SCHEDULED,
                        "scheduled_arrival": arr_dt,
                        "checkin_open": dep_dt - timedelta(hours=24),
                        "boarding_time": dep_dt - timedelta(minutes=45),
                        "boarding_gate": f"G{random.randint(1, 20)}",
                        "departure_terminal": "T3",
                        "arrival_terminal": "T1",
                    }
                )
                count_created += 1
                
                # Make ~1 out of 3 flights fully booked (0 available seats)
                is_full = (d_offset + idx) % 3 == 0
                if is_full:
                    zero_seat_count += 1
                    econ_seats = 0
                    biz_seats = 0
                    fst_seats = 0
                else:
                    econ_seats = random.randint(15, 120)
                    biz_seats = random.randint(5, 20)
                    fst_seats = random.randint(1, 5)

                # Fares
                Fare.objects.update_or_create(
                    flight_instance=inst,
                    cabin_class=CabinClass.ECONOMY,
                    defaults={
                        "fare_code": f"ECO-{inst.id}",
                        "price": Decimal(str(int(base_fare))),
                        "currency": "INR",
                        "available_seats": 0,
                        "refund_type": RefundType.PARTIAL,
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
                        "price": Decimal(str(int(base_fare * 2.8))),
                        "currency": "INR",
                        "available_seats": 0,
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
                        "price": Decimal(str(int(base_fare * 5.2))),
                        "currency": "INR",
                        "available_seats": 0,
                        "refund_type": RefundType.REFUNDABLE,
                        "change_fee": Decimal("0.00"),
                        "meal_included": True,
                        "baggage_allowance": Decimal("50.0"),
                    }
                )

                # Seats
                if inst.seats.count() == 0:
                    from apps.flights.services import generate_seats_for_instance
                    generate_seats_for_instance(inst)
                    
                    if is_full:
                        inst.seats.update(status=SeatStatus.BOOKED)
                    else:
                        seats_list = list(inst.seats.all())
                        if seats_list:
                            booked_count = int(len(seats_list) * random.uniform(0.15, 0.5))
                            booked_seats = random.sample(seats_list, booked_count)
                            seat_ids = [s.id for s in booked_seats]
                            Seat.objects.filter(id__in=seat_ids).update(status=SeatStatus.BOOKED)

        self.stdout.write(self.style.SUCCESS(
            f"Successfully seeded {count_created} flights from DEL to HAM starting from Aug 5th, 2026 ({zero_seat_count} flights fully booked with 0 seats)."
        ))
