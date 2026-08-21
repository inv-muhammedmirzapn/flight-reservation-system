from decimal import Decimal
import random
from datetime import datetime, date, time, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.users.models import Profile
from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, InstanceStatus,
    Seat, CabinClass, SeatPosition, SeatStatus,
    Fare, RefundType, FoodItem, FlightMeal, FlightMealItem,
)
from apps.flights.services import generate_seats_for_instance
from apps.bookings.models import Booking, BookingStatus, Passenger
from apps.waitlist.models import WaitlistEntry, WaitlistStatus, WaitlistPassenger
from apps.notifications.models import Notification, NotificationType

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds database with real-world mock data, including DEL to HAM flights for the next 7 days"

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Wiping existing data..."))

        Notification.objects.all().delete()
        WaitlistPassenger.objects.all().delete()
        WaitlistEntry.objects.all().delete()
        Passenger.objects.all().delete()
        Booking.objects.all().delete()
        FlightMealItem.objects.all().delete()
        FlightMeal.objects.all().delete()
        FoodItem.objects.all().delete()
        Fare.objects.all().delete()
        Seat.objects.all().delete()
        FlightInstance.objects.all().delete()
        FlightLeg.objects.all().delete()
        FlightRoute.objects.all().delete()
        Aircraft.objects.all().delete()
        AircraftModel.objects.all().delete()
        Airline.objects.all().delete()
        Airport.objects.all().delete()
        Country.objects.all().delete()
        Profile.objects.all().delete()
        User.objects.exclude(is_superuser=True).delete()
        
        self.stdout.write(self.style.SUCCESS("Database wiped successfully. Starting seed..."))

        # 1. Users & Profiles (1 Admin, 1 Customer)
        self.stdout.write("Seeding Users & Profiles...")
        admin_user, _ = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@skyflow.com",
                "first_name": "Admin",
                "last_name": "User",
                "is_staff": True,
                "is_superuser": True,
            }
        )
        if not admin_user.check_password("admin123"):
            admin_user.set_password("admin123")
            admin_user.save()
        
        admin_profile, _ = Profile.objects.get_or_create(user=admin_user)
        admin_profile.role = Profile.Role.ADMIN
        admin_profile.phone_number = "+1 555-0199"
        admin_profile.date_of_birth = "1988-05-14"
        admin_profile.gender = Profile.Gender.MALE
        admin_profile.country = "United States"
        admin_profile.state = "New York"
        admin_profile.city = "New York"
        admin_profile.save()

        customer_user, _ = User.objects.get_or_create(
            username="customer",
            defaults={
                "email": "customer@gmail.com",
                "first_name": "John",
                "last_name": "Doe",
                "is_staff": False,
                "is_superuser": False,
            }
        )
        customer_user.set_password("customer123")
        customer_user.save()

        customer_profile, _ = Profile.objects.get_or_create(user=customer_user)
        customer_profile.role = Profile.Role.CUSTOMER
        customer_profile.phone_number = "+1 555-0123"
        customer_profile.date_of_birth = "1994-09-22"
        customer_profile.gender = Profile.Gender.MALE
        customer_profile.country = "United Kingdom"
        customer_profile.state = "England"
        customer_profile.city = "London"
        customer_profile.save()

        # 2. Countries
        self.stdout.write("Seeding Countries...")
        countries_data = [
            ("United States", "US"), ("India", "IN"), ("United Kingdom", "GB"),
            ("United Arab Emirates", "AE"), ("Japan", "JP"), ("Singapore", "SG"),
            ("Germany", "DE"), ("France", "FR"), ("Canada", "CA"), ("Australia", "AU"),
            ("Qatar", "QA"), ("Turkey", "TR"), ("Thailand", "TH"), ("Malaysia", "MY"),
            ("South Korea", "KR"), ("Netherlands", "NL"), ("Switzerland", "CH"),
        ]
        countries_dict = {}
        for name, iso in countries_data:
            c, _ = Country.objects.get_or_create(iso_code=iso, defaults={"name": name})
            countries_dict[iso] = c

        # 3. Airports
        self.stdout.write("Seeding Airports...")
        airports_data = [
            ("JFK", "John F. Kennedy International Airport", "New York", "America/New_York", Decimal("40.641311"), Decimal("-73.778139"), "US", ["1", "4", "7", "8"]),
            ("LHR", "Heathrow Airport", "London", "Europe/London", Decimal("51.470020"), Decimal("-0.454295"), "GB", ["2", "3", "4", "5"]),
            ("DXB", "Dubai International Airport", "Dubai", "Asia/Dubai", Decimal("25.253175"), Decimal("55.365673"), "AE", ["1", "2", "3"]),
            ("DEL", "Indira Gandhi International Airport", "New Delhi", "Asia/Kolkata", Decimal("28.556167"), Decimal("77.100281"), "IN", ["T1", "T2", "T3"]),
            ("HAM", "Hamburg Airport", "Hamburg", "Europe/Berlin", Decimal("53.630389"), Decimal("9.988222"), "DE", ["1", "2"]),
            ("BOM", "Chhatrapati Shivaji Maharaj International Airport", "Mumbai", "Asia/Kolkata", Decimal("19.089559"), Decimal("72.865614"), "IN", ["T1", "T2"]),
            ("HND", "Tokyo Haneda Airport", "Tokyo", "Asia/Tokyo", Decimal("35.549393"), Decimal("139.779839"), "JP", ["1", "2", "3"]),
            ("SIN", "Singapore Changi Airport", "Singapore", "Asia/Singapore", Decimal("1.364420"), Decimal("103.991531"), "SG", ["T1", "T2", "T3", "T4"]),
            ("CDG", "Charles de Gaulle Airport", "Paris", "Europe/Paris", Decimal("49.009690"), Decimal("2.547925"), "FR", ["2A", "2E", "2F"]),
            ("FRA", "Frankfurt Airport", "Frankfurt", "Europe/Berlin", Decimal("50.037933"), Decimal("8.562152"), "DE", ["1", "2"]),
            ("SYD", "Sydney Kingsford Smith Airport", "Sydney", "Australia/Sydney", Decimal("-33.939923"), Decimal("151.175276"), "AU", ["T1", "T2", "T3"]),
            ("DOH", "Hamad International Airport", "Doha", "Asia/Qatar", Decimal("25.273056"), Decimal("51.608056"), "QA", ["1"]),
            ("IST", "Istanbul Airport", "Istanbul", "Europe/Istanbul", Decimal("41.259722"), Decimal("28.745556"), "TR", ["1"]),
            ("BKK", "Suvarnabhumi Airport", "Bangkok", "Asia/Bangkok", Decimal("13.681108"), Decimal("100.747283"), "TH", ["1"]),
        ]
        airports_dict = {}
        for iata, name, city, tz, lat, lon, country_iso, term in airports_data:
            ap, _ = Airport.objects.get_or_create(
                iata_code=iata,
                defaults={
                    "airport_name": name,
                    "city": city,
                    "timezone": tz,
                    "latitude": lat,
                    "longitude": lon,
                    "country": countries_dict.get(country_iso),
                    "terminals": term,
                }
            )
            airports_dict[iata] = ap

        # 4. Airlines
        self.stdout.write("Seeding Airlines...")
        airlines_data = [
            ("EK", "Emirates"), ("BA", "British Airways"), ("AA", "American Airlines"),
            ("AI", "Air India"), ("SQ", "Singapore Airlines"), ("JL", "Japan Airlines"),
            ("LH", "Lufthansa"), ("AF", "Air France"), ("QF", "Qantas Airways"),
            ("6E", "IndiGo Airlines"), ("QR", "Qatar Airways"), ("TK", "Turkish Airlines")
        ]
        airlines_dict = {}
        for code, name in airlines_data:
            al, _ = Airline.objects.get_or_create(iata_airline_code=code, defaults={"airline_name": name})
            airlines_dict[code] = al

        # 5. Aircraft Models
        self.stdout.write("Seeding Aircraft Models...")
        models_data = [
            ("Boeing", "777-300ER"), ("Boeing", "787-9 Dreamliner"),
            ("Airbus", "A380-800"), ("Airbus", "A350-900"),
            ("Airbus", "A320neo"), ("Boeing", "737 MAX 8")
        ]
        models_dict = {}
        for mfg, mname in models_data:
            am, _ = AircraftModel.objects.get_or_create(manufacturer=mfg, model_name=mname)
            models_dict[f"{mfg} {mname}"] = am

        # 6. Aircraft
        self.stdout.write("Seeding Aircraft...")
        aircraft_data = [
            ("N777AA", "AA", "Boeing 777-300ER", 216, 52, 8),
            ("A6-EEO", "EK", "Airbus A380-800", 399, 76, 14),
            ("G-ZBLB", "BA", "Boeing 787-9 Dreamliner", 154, 42, 8),
            ("VT-ALN", "AI", "Boeing 777-300ER", 256, 35, 4),
            ("9V-SNA", "SQ", "Airbus A350-900", 187, 42, 0),
            ("JA873A", "JL", "Boeing 787-9 Dreamliner", 156, 52, 0),
            ("D-AIXA", "LH", "Airbus A350-900", 224, 48, 0),
            ("F-HTYA", "AF", "Airbus A350-900", 224, 34, 0),
            ("VH-ZNA", "QF", "Boeing 787-9 Dreamliner", 166, 42, 0),
            ("VT-IZI", "6E", "Airbus A320neo", 186, 0, 0),
            ("A7-BBA", "QR", "Boeing 777-300ER", 216, 42, 0),
            ("TC-JNA", "TK", "Airbus A350-900", 224, 34, 0),
            ("D-ABPA", "LH", "Boeing 787-9 Dreamliner", 150, 30, 10),
        ]
        aircraft_dict = {}
        for reg, al_code, mkey, econ, bus, fst in aircraft_data:
            ac, _ = Aircraft.objects.get_or_create(
                registration=reg,
                defaults={
                    "airline": airlines_dict[al_code],
                    "aircraft_model": models_dict[mkey],
                    "economy_capacity": econ,
                    "business_capacity": bus,
                    "first_class_capacity": fst,
                }
            )
            aircraft_dict[reg] = ac

        # 7. Food Items (In INR)
        self.stdout.write("Seeding Food Items...")
        food_items_data = [
            ("EK", "Mediterranean Hummus & Pita Wrap", 450.00, True, True, True),
            ("BA", "Grilled Atlantic Salmon with Asparagus", 1200.00, False, False, False),
            ("AA", "Gourmet Beef Tenderloin with Red Wine Reduction", 1400.00, False, False, False),
            ("AI", "Butter Chicken with Jeera Rice & Naan", 650.00, False, True, False),
            ("SQ", "Vegan Thai Green Curry with Jasmine Rice", 750.00, True, True, True),
            ("JL", "Traditional Japanese Bento Box", 1100.00, False, False, False),
            ("LH", "Artisanal Cheese & Fresh Fruit Platter", 800.00, True, False, False),
            ("6E", "Hyderabadi Chicken Biryani", 400.00, False, True, False),
        ]
        food_items_list = []
        for al_code, name, price, is_v, is_h, is_vg in food_items_data:
            fi, _ = FoodItem.objects.get_or_create(
                airline=airlines_dict[al_code],
                name=name,
                defaults={
                    "price": price,
                    "currency": "INR",
                    "is_veg": is_v,
                    "is_halal": is_h,
                    "is_vegan": is_vg,
                }
            )
            food_items_list.append(fi)

        # 8. Define DEL -> HAM Routes (Direct & Connecting)
        self.stdout.write("Seeding DEL -> HAM Routes (Direct & Connecting)...")
        
        # Direct DEL -> HAM Routes
        direct_del_ham_routes = [
            ("LH761", "LH", "D-ABPA", 9, 30, 45000, time(2, 30)),   # Lufthansa Morning
            ("AI121", "AI", "VT-ALN", 10, 15, 38000, time(6, 15)),  # Air India Early Morning
            ("EK061", "EK", "A6-EEO", 9, 45, 52000, time(14, 0)),   # Emirates Afternoon
            ("6E191", "6E", "VT-IZI", 10, 0, 32000, time(23, 45)),  # IndiGo Night
        ]

        del_ham_route_objs = {}
        for fno, al_code, ac_reg, dur_hrs, dur_mins, base_fare, dep_t in direct_del_ham_routes:
            fr, _ = FlightRoute.objects.get_or_create(
                flight_no=fno,
                defaults={
                    "airline": airlines_dict[al_code],
                    "baggage_weight_allowed_per_person": 30,
                    "baggage_number_allowed_per_person": 2,
                    "handbag_weight_allowed_per_person": 8,
                }
            )
            del_ham_route_objs[fno] = {
                "route": fr,
                "aircraft": aircraft_dict[ac_reg],
                "dur_hrs": dur_hrs,
                "dur_mins": dur_mins,
                "base_fare": base_fare,
                "dep_time": dep_t,
                "is_connecting": False,
            }
            FlightLeg.objects.get_or_create(
                flight=fr,
                leg_order=1,
                defaults={
                    "departure_airport": airports_dict["DEL"],
                    "arrival_airport": airports_dict["HAM"],
                    "flight_duration_minutes": dur_hrs * 60 + dur_mins,
                    "layover_duration_minutes": 0,
                }
            )

        # 1-Stop Connecting Routes (DEL -> Layover -> HAM)
        connecting_del_ham_routes = [
            # LH763 via FRA
            ("LH763-C", "LH", "D-AIXA", 42000, time(3, 15), [
                ("DEL", "FRA", 510, 0),
                ("FRA", "HAM", 70, 105), # 1h45m layover
            ]),
            # EK505 via DXB
            ("EK505-C", "EK", "A6-EEO", 48000, time(10, 30), [
                ("DEL", "DXB", 225, 0),
                ("DXB", "HAM", 390, 135), # 2h15m layover
            ]),
            # BA143 via LHR
            ("BA143-C", "BA", "G-ZBLB", 46000, time(11, 45), [
                ("DEL", "LHR", 555, 0),
                ("LHR", "HAM", 100, 120), # 2h layover
            ]),
            # TK717 via IST
            ("TK717-C", "TK", "TC-JNA", 41000, time(18, 20), [
                ("DEL", "IST", 420, 0),
                ("IST", "HAM", 195, 90), # 1h30m layover
            ]),
        ]

        for fno, al_code, ac_reg, base_fare, dep_t, legs_info in connecting_del_ham_routes:
            fr, _ = FlightRoute.objects.get_or_create(
                flight_no=fno,
                defaults={
                    "airline": airlines_dict[al_code],
                    "baggage_weight_allowed_per_person": 30,
                    "baggage_number_allowed_per_person": 2,
                    "handbag_weight_allowed_per_person": 7,
                }
            )
            total_dur = sum(l[2] + l[3] for l in legs_info)
            del_ham_route_objs[fno] = {
                "route": fr,
                "aircraft": aircraft_dict[ac_reg],
                "dur_hrs": total_dur // 60,
                "dur_mins": total_dur % 60,
                "base_fare": base_fare,
                "dep_time": dep_t,
                "is_connecting": True,
            }
            for idx, (dep_ap, arr_ap, dur_m, lay_m) in enumerate(legs_info, start=1):
                FlightLeg.objects.get_or_create(
                    flight=fr,
                    leg_order=idx,
                    defaults={
                        "departure_airport": airports_dict[dep_ap],
                        "arrival_airport": airports_dict[arr_ap],
                        "flight_duration_minutes": dur_m,
                        "layover_duration_minutes": lay_m,
                    }
                )

        # 9. Other International Route Templates
        other_route_templates = [
            ("EK201", "EK", "DXB", "JFK", 14, 0, "A6-EEO"),
            ("BA177", "BA", "LHR", "JFK", 8, 0, "G-ZBLB"),
            ("AI101", "AI", "DEL", "JFK", 15, 30, "VT-ALN"),
            ("SQ026", "SQ", "SIN", "JFK", 18, 0, "9V-SNA"),
            ("JL006", "JL", "HND", "JFK", 13, 0, "JA873A"),
            ("LH400", "LH", "FRA", "JFK", 8, 30, "D-AIXA"),
            ("AF006", "AF", "CDG", "JFK", 8, 15, "F-HTYA"),
            ("AA100", "AA", "JFK", "LHR", 7, 0, "N777AA"),
            ("QF001", "QF", "SYD", "LHR", 22, 0, "VH-ZNA"),
            ("6E055", "6E", "BOM", "DXB", 3, 30, "VT-IZI"),
            ("QR001", "QR", "DOH", "LHR", 7, 15, "A7-BBA"),
            ("TK001", "TK", "IST", "JFK", 10, 45, "TC-JNA"),
            ("AI202", "AI", "DEL", "LHR", 9, 30, "VT-ALN"),
            ("EK501", "EK", "DXB", "BOM", 3, 15, "A6-EEO"),
            ("SQ318", "SQ", "SIN", "LHR", 13, 15, "9V-SNA"),
            ("QF009", "QF", "SYD", "DXB", 14, 30, "VH-ZNA"),
            ("JL041", "JL", "HND", "LHR", 14, 10, "JA873A"),
            ("AF218", "AF", "CDG", "BOM", 8, 30, "F-HTYA"),
            ("LH764", "LH", "FRA", "BOM", 8, 10, "D-ABPA"),
            ("QR015", "QR", "DOH", "JFK", 14, 15, "A7-BBA"),
            ("6E112", "6E", "DEL", "SIN", 5, 50, "VT-IZI"),
            ("AA050", "AA", "JFK", "CDG", 7, 15, "N777AA"),
            ("BA011", "BA", "LHR", "SIN", 12, 50, "G-ZBLB"),
            ("TK720", "TK", "IST", "BOM", 6, 30, "TC-JNA"),
            ("EK007", "EK", "DXB", "LHR", 7, 30, "A6-EEO"),
        ]

        other_routes_dict = {}
        for fno, al_code, dep_code, arr_code, hrs, mins, _ in other_route_templates:
            fr, _ = FlightRoute.objects.get_or_create(
                flight_no=fno,
                defaults={
                    "airline": airlines_dict[al_code],
                    "baggage_weight_allowed_per_person": 30,
                    "baggage_number_allowed_per_person": 2,
                    "handbag_weight_allowed_per_person": 7,
                }
            )
            other_routes_dict[fno] = fr
            FlightLeg.objects.get_or_create(
                flight=fr,
                leg_order=1,
                defaults={
                    "departure_airport": airports_dict[dep_code],
                    "arrival_airport": airports_dict[arr_code],
                    "flight_duration_minutes": hrs * 60 + mins,
                    "layover_duration_minutes": 0,
                }
            )

        # 10. Generate Flight Instances (Next 7 days for DEL -> HAM, plus past/future general flights)
        self.stdout.write("Generating Flight Instances for the next 7 days for DEL -> HAM...")

        flight_instances_created = []
        flight_counter = 5000

        # Target range: Today to 1 week from today (7 days)
        start_aug = timezone.now().date()
        end_aug = start_aug + timedelta(days=7)
        
        all_del_ham_keys = list(del_ham_route_objs.keys())

        # For every date between Aug 6 and Aug 20, create multiple DEL -> HAM flight instances
        curr_d = start_aug
        while curr_d <= end_aug:
            # Pick 4 to 6 different DEL -> HAM flights per day
            daily_keys = random.sample(all_del_ham_keys, k=random.randint(4, 6))
            
            for key in daily_keys:
                flight_counter += 1
                r_data = del_ham_route_objs[key]
                fr = r_data["route"]
                ac = r_data["aircraft"]
                base_fare = r_data["base_fare"]
                t_dep = r_data["dep_time"]

                dep_dt = datetime.combine(curr_d, t_dep)
                if timezone.is_naive(dep_dt):
                    dep_dt = timezone.make_aware(dep_dt)
                
                arr_dt = dep_dt + timedelta(hours=r_data["dur_hrs"], minutes=r_data["dur_mins"])

                inst, _ = FlightInstance.objects.get_or_create(
                    flight=fr,
                    date=curr_d,
                    scheduled_departure=dep_dt,
                    defaults={
                        "aircraft": ac,
                        "status": InstanceStatus.SCHEDULED,
                        "scheduled_arrival": arr_dt,
                        "checkin_open": dep_dt - timedelta(hours=24),
                        "boarding_time": dep_dt - timedelta(minutes=45),
                        "boarding_gate": f"G{random.randint(1, 25)}",
                        "departure_terminal": "T3",
                        "arrival_terminal": "T1",
                    }
                )
                flight_instances_created.append(inst)

                # Determine seat availability (randomize so some have 0 seats to test waitlist)
                is_fully_booked = (curr_d.day + flight_counter) % 5 == 0
                econ_avail = 0 if is_fully_booked else random.randint(12, 110)
                biz_avail = 0 if is_fully_booked else random.randint(4, 22)
                fst_avail = 0 if is_fully_booked else random.randint(1, 6)

                # Fares
                Fare.objects.update_or_create(
                    flight_instance=inst,
                    cabin_class=CabinClass.ECONOMY,
                    defaults={
                        "fare_code": f"ECO-{inst.id}",
                        "price": Decimal(str(base_fare)),
                        "currency": "INR",
                        "available_seats": 0, # Will be auto-calculated by seats
                        "refund_type": RefundType.PARTIAL,
                        "change_fee": Decimal("3500.00"),
                        "meal_included": True,
                        "baggage_allowance": Decimal("30.0"),
                    }
                )
                if ac.business_capacity > 0:
                    Fare.objects.update_or_create(
                        flight_instance=inst,
                        cabin_class=CabinClass.BUSINESS,
                        defaults={
                            "fare_code": f"BIZ-{inst.id}",
                            "price": Decimal(str(int(base_fare * 2.6))),
                            "currency": "INR",
                            "available_seats": 0,
                            "refund_type": RefundType.REFUNDABLE,
                            "change_fee": Decimal("0.00"),
                            "meal_included": True,
                            "baggage_allowance": Decimal("40.0"),
                        }
                    )
                if ac.first_class_capacity > 0:
                    Fare.objects.update_or_create(
                        flight_instance=inst,
                        cabin_class=CabinClass.FIRST,
                        defaults={
                            "fare_code": f"FST-{inst.id}",
                            "price": Decimal(str(int(base_fare * 5.0))),
                            "currency": "INR",
                            "available_seats": 0,
                            "refund_type": RefundType.REFUNDABLE,
                            "change_fee": Decimal("0.00"),
                            "meal_included": True,
                            "baggage_allowance": Decimal("50.0"),
                        }
                    )

                # Seats — use the shared service so all cabin classes are generated correctly
                if inst.seats.count() == 0:
                    generate_seats_for_instance(inst)
                    
                    if is_fully_booked:
                        inst.seats.update(status=SeatStatus.BOOKED)
                    else:
                        # Randomly book some seats (e.g. 20-50%)
                        seats_list = list(inst.seats.all())
                        if seats_list:
                            booked_count = int(len(seats_list) * random.uniform(0.2, 0.6))
                            booked_seats = random.sample(seats_list, booked_count)
                            seat_ids = [s.id for s in booked_seats]
                            Seat.objects.filter(id__in=seat_ids).update(status=SeatStatus.BOOKED)

                # Meal
                fm, _ = FlightMeal.objects.get_or_create(
                    flight_instance=inst,
                    name=f"Menu - {fr.flight_no}",
                )
                if food_items_list:
                    FlightMealItem.objects.get_or_create(
                        flight_meal=fm,
                        food_item=random.choice(food_items_list),
                        defaults={"quantity": 2}
                    )

            curr_d += timedelta(days=1)

        # 11. Historical and General Other Flights (past 30 days & future 14 days)
        now_dt = timezone.now()
        dates_to_gen = [now_dt - timedelta(days=i) for i in range(30, 0, -3)] + [now_dt + timedelta(days=i) for i in range(15)]
        
        for d in dates_to_gen:
            sample_routes = random.sample(other_route_templates, 3)
            for fno, al_code, dep_code, arr_code, hrs, mins, ac_reg in sample_routes:
                flight_counter += 1
                dep_dt = d.replace(hour=random.randint(1, 22), minute=random.choice([0, 15, 30, 45]), second=0, microsecond=0)
                arr_dt = dep_dt + timedelta(hours=hrs, minutes=mins)
                inst, _ = FlightInstance.objects.get_or_create(
                    flight=other_routes_dict[fno],
                    date=dep_dt.date(),
                    scheduled_departure=dep_dt,
                    defaults={
                        "aircraft": aircraft_dict[ac_reg],
                        "status": InstanceStatus.DEPARTED if dep_dt < now_dt else InstanceStatus.SCHEDULED,
                        "scheduled_arrival": arr_dt,
                        "checkin_open": dep_dt - timedelta(hours=24),
                        "boarding_time": dep_dt - timedelta(minutes=45),
                        "boarding_gate": f"A{random.randint(1, 15)}",
                        "departure_terminal": "T1",
                        "arrival_terminal": "T2",
                    }
                )
                flight_instances_created.append(inst)
                generate_seats_for_instance(inst)

                # Generate random base fare depending on route length
                base_fare = Decimal(str(hrs * 3500 + 4000))

                Fare.objects.get_or_create(
                    flight_instance=inst,
                    cabin_class=CabinClass.ECONOMY,
                    defaults={
                        "fare_code": f"ECO-O-{inst.id}",
                        "price": base_fare,
                        "currency": "INR",
                        "available_seats": 0,
                        "refund_type": RefundType.PARTIAL,
                        "change_fee": Decimal("2500.00"),
                        "meal_included": True,
                        "baggage_allowance": Decimal("25.0"),
                    }
                )
                ac = aircraft_dict[ac_reg]
                if ac.business_capacity > 0:
                    Fare.objects.get_or_create(
                        flight_instance=inst,
                        cabin_class=CabinClass.BUSINESS,
                        defaults={
                            "fare_code": f"BIZ-O-{inst.id}",
                            "price": base_fare * Decimal("2.5"),
                            "currency": "INR",
                            "available_seats": 0,
                            "refund_type": RefundType.REFUNDABLE,
                            "change_fee": Decimal("0.00"),
                            "meal_included": True,
                            "baggage_allowance": Decimal("40.0"),
                        }
                    )
                if ac.first_class_capacity > 0:
                    Fare.objects.get_or_create(
                        flight_instance=inst,
                        cabin_class=CabinClass.FIRST,
                        defaults={
                            "fare_code": f"FST-O-{inst.id}",
                            "price": base_fare * Decimal("4.5"),
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

                    generate_seats_for_instance(inst)
                    
                    is_fully_booked = (inst.id % 7 == 0)
                    if is_fully_booked:
                        inst.seats.update(status=SeatStatus.BOOKED)
                    else:
                        seats_list = list(inst.seats.all())
                        if seats_list:
                            booked_count = int(len(seats_list) * random.uniform(0.1, 0.7))
                            booked_seats = random.sample(seats_list, booked_count)
                            seat_ids = [s.id for s in booked_seats]
                            Seat.objects.filter(id__in=seat_ids).update(status=SeatStatus.BOOKED)

        # 12. Bookings & Passengers
        self.stdout.write("Seeding Bookings & Passengers...")
        for i in range(20):
            flight_inst = random.choice(flight_instances_created)
            user_obj = customer_user if i % 2 == 0 else admin_user
            
            fare = Fare.objects.filter(flight_instance=flight_inst, cabin_class=CabinClass.ECONOMY).first()
            mock_price = fare.price if fare else Decimal("35000.00")
            
            b, _ = Booking.objects.get_or_create(
                id=f"10000000-0000-0000-0000-0000000000{i:02d}",
                defaults={
                    "user": user_obj,
                    "flight": flight_inst,
                    "status": BookingStatus.CONFIRMED,
                    "seat_count": 1,
                    "total_price": mock_price,
                }
            )
            Passenger.objects.get_or_create(
                booking=b,
                name=f"Passenger {i+1}",
                defaults={
                    "age": 25 + (i % 25),
                    "gender": "M" if i % 2 == 0 else "F",
                    "phone_number": f"+91 98765432{i%10}{i%10}",
                }
            )

        self.stdout.write(self.style.SUCCESS(
            "Successfully seeded database with comprehensive data! "
            "Created DEL to HAM flights for the next 7 days."
        ))
