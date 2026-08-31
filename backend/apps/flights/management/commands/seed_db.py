from decimal import Decimal
from datetime import datetime, date, time, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.users.models import Profile
from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, InstanceStatus,
    Seat, CabinClass, RefundType, RouteFareClass, FoodItem,
)
from apps.bookings.models import Booking, Passenger, Ticket
from apps.waitlist.models import WaitlistEntry, WaitlistPassenger
from apps.notifications.models import Notification

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds database with static data (Airports, Airlines, Aircraft, Routes, RouteFareClasses, Users), leaving FlightInstances to be created via generate_instances."

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Wiping existing data..."))

        Notification.objects.all().delete()
        WaitlistPassenger.objects.all().delete()
        WaitlistEntry.objects.all().delete()
        Ticket.objects.all().delete()
        Passenger.objects.all().delete()
        Booking.objects.all().delete()
        Seat.objects.all().delete()
        FlightInstance.objects.all().delete()
        RouteFareClass.objects.all().delete()
        FlightLeg.objects.all().delete()
        FlightRoute.objects.all().delete()
        FoodItem.objects.all().delete()
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

        # 4. Airlines with logos
        self.stdout.write("Seeding Airlines...")
        airlines_data = [
            ("EK", "Emirates", "airlines/ek_logo.png"),
            ("BA", "British Airways", "airlines/ba_logo.png"),
            ("AA", "American Airlines", "airlines/aa_logo.png"),
            ("AI", "Air India", "airlines/ai_logo.jpg"),
            ("SQ", "Singapore Airlines", "airlines/sq_logo.png"),
            ("JL", "Japan Airlines", "airlines/jl_logo.png"),
            ("LH", "Lufthansa", "airlines/lh_logo.png"),
            ("AF", "Air France", "airlines/af_logo.png"),
            ("QF", "Qantas Airways", "airlines/qf_logo.png"),
            ("6E", "IndiGo Airlines", "airlines/6e_logo.png"),
            ("QR", "Qatar Airways", "airlines/qr_logo.png"),
            ("TK", "Turkish Airlines", "airlines/tk_logo.png"),
        ]
        airlines_dict = {}
        for code, name, logo_path in airlines_data:
            al, _ = Airline.objects.get_or_create(
                iata_airline_code=code,
                defaults={
                    "airline_name": name,
                    "logo": logo_path,
                }
            )
            al.logo = logo_path
            al.save()
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

        # 7. Food Items
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
        for al_code, name, price, is_v, is_h, is_vg in food_items_data:
            FoodItem.objects.get_or_create(
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

        # 8. Flight Routes, Flight Legs & RouteFareClasses
        self.stdout.write("Seeding Flight Routes, Legs & RouteFareClasses...")

        today = date.today()
        valid_from_date = today - timedelta(days=30)

        # DEL -> HAM Direct & Connecting Routes for Optimization Demonstration
        direct_del_ham_routes = [
            ("AI121", "AI", "VT-ALN", 7, 45, Decimal("38000.00"), time(6, 15)),  # Fastest (7h 45m)
            ("LH761", "LH", "D-ABPA", 8, 30, Decimal("42000.00"), time(2, 30)),  # Fewest Stops (Direct)
            ("EK061", "EK", "A6-EEO", 8, 0, Decimal("46000.00"), time(14, 0)),   # Shortest Distance (8h 00m)
            ("6E191", "6E", "VT-IZI", 13, 30, Decimal("24000.00"), time(23, 45)), # Cheapest (₹24,000)
        ]

        for fno, al_code, ac_reg, dur_hrs, dur_mins, base_fare, dep_t in direct_del_ham_routes:
            scheduled_dep = datetime.combine(today, dep_t)
            scheduled_arr = scheduled_dep + timedelta(hours=dur_hrs, minutes=dur_mins)
            fr, _ = FlightRoute.objects.get_or_create(
                flight_no=fno,
                defaults={
                    "airline": airlines_dict[al_code],
                    "operates_on_days": "1,2,3,4,5,6,7",
                    "scheduled_departure_time": dep_t,
                    "scheduled_arrival_time": scheduled_arr.time(),
                    "valid_from": valid_from_date,
                    "is_active": True,
                    "baggage_weight_allowed_per_person": 30,
                    "baggage_number_allowed_per_person": 2,
                    "handbag_weight_allowed_per_person": 8,
                }
            )

            FlightLeg.objects.get_or_create(
                flight=fr,
                leg_order=1,
                defaults={
                    "departure_airport": airports_dict["DEL"],
                    "arrival_airport": airports_dict["HAM"],
                    "flight_duration_minutes": dur_hrs * 60 + dur_mins,
                    "layover_duration_minutes": 0,
                    "scheduled_departure_time": dep_t,
                    "scheduled_arrival_time": scheduled_arr.time(),
                    "scheduled_departure": timezone.make_aware(scheduled_dep),
                    "scheduled_arrival": timezone.make_aware(scheduled_arr),
                }
            )

            # RouteFareClasses
            RouteFareClass.objects.get_or_create(
                route=fr,
                cabin_class=CabinClass.ECONOMY,
                fare_code="ECO_STD",
                defaults={
                    "base_price": base_fare,
                    "currency": "INR",
                    "refund_type": RefundType.PARTIAL,
                    "change_fee": Decimal("3500.00"),
                    "meal_included": True,
                    "baggage_weight_allowed_kg": 30,
                }
            )
            ac = aircraft_dict[ac_reg]
            if ac.business_capacity > 0:
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
            if ac.first_class_capacity > 0:
                RouteFareClass.objects.get_or_create(
                    route=fr,
                    cabin_class=CabinClass.FIRST,
                    fare_code="FST_STD",
                    defaults={
                        "base_price": (base_fare * Decimal("4.5")).quantize(Decimal("0.01")),
                        "currency": "INR",
                        "refund_type": RefundType.REFUNDABLE,
                        "change_fee": Decimal("0.00"),
                        "meal_included": True,
                        "baggage_weight_allowed_kg": 50,
                    }
                )

        # 1-Stop Connecting Routes (DEL -> Layover -> HAM)
        connecting_del_ham_routes = [
            ("LH763-C", "LH", "D-AIXA", Decimal("42000.00"), time(3, 15), [
                ("DEL", "FRA", 510, 0, time(3, 15)),
                ("FRA", "HAM", 70, 105, time(13, 30)),
            ]),
            ("EK505-C", "EK", "A6-EEO", Decimal("48000.00"), time(10, 30), [
                ("DEL", "DXB", 225, 0, time(10, 30)),
                ("DXB", "HAM", 390, 135, time(16, 30)),
            ]),
            ("BA143-C", "BA", "G-ZBLB", Decimal("46000.00"), time(11, 45), [
                ("DEL", "LHR", 555, 0, time(11, 45)),
                ("LHR", "HAM", 100, 120, time(23, 0)),
            ]),
            ("TK717-C", "TK", "TC-JNA", Decimal("41000.00"), time(18, 20), [
                ("DEL", "IST", 420, 0, time(18, 20)),
                ("IST", "HAM", 195, 90, time(3, 30)),
            ]),
        ]

        for fno, al_code, ac_reg, base_fare, dep_t, legs_info in connecting_del_ham_routes:
            last_leg_info = legs_info[-1]
            last_sch_dep = datetime.combine(today, last_leg_info[4])
            last_sch_arr = last_sch_dep + timedelta(minutes=last_leg_info[2])
            fr, _ = FlightRoute.objects.get_or_create(
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
            ac = aircraft_dict[ac_reg]
            if ac.business_capacity > 0:
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

        # Other Global Routes
        other_route_templates = [
            # fno, al, dep, arr, hrs, mins, ac_reg, base_fare, dep_t, day_offset
            ("EK201", "EK", "DXB", "JFK", 14, 0, "A6-EEO", Decimal("75000.00"), time(8, 30), 2),
            ("BA177", "BA", "LHR", "JFK", 8, 0, "G-ZBLB", Decimal("62000.00"), time(13, 0), 2),
            ("AI101", "AI", "DEL", "JFK", 15, 30, "VT-ALN", Decimal("82000.00"), time(1, 45), 0),
            ("SQ026", "SQ", "SIN", "JFK", 18, 0, "9V-SNA", Decimal("95000.00"), time(23, 50), 1),
            ("JL006", "JL", "HND", "JFK", 13, 0, "JA873A", Decimal("88000.00"), time(11, 0), 0),
            ("LH400", "LH", "FRA", "JFK", 8, 30, "D-AIXA", Decimal("58000.00"), time(10, 45), 0),
            ("AF006", "AF", "CDG", "JFK", 8, 15, "F-HTYA", Decimal("60000.00"), time(14, 10), 0),
            ("AA100", "AA", "JFK", "LHR", 7, 0, "N777AA", Decimal("54000.00"), time(19, 30), 0),
            ("QF001", "QF", "SYD", "LHR", 22, 0, "VH-ZNA", Decimal("110000.00"), time(16, 0), 0),
            ("6E055", "6E", "BOM", "DXB", 3, 30, "VT-IZI", Decimal("18000.00"), time(21, 15), 0),
            ("QR001", "QR", "DOH", "LHR", 7, 15, "A7-BBA", Decimal("65000.00"), time(6, 45), 0),
            ("TK001", "TK", "IST", "JFK", 10, 45, "TC-JNA", Decimal("59000.00"), time(13, 30), 0),
            ("AI202", "AI", "DEL", "LHR", 9, 30, "VT-ALN", Decimal("48000.00"), time(7, 0), 0),
            ("EK501", "EK", "DXB", "BOM", 3, 15, "A6-EEO", Decimal("22000.00"), time(22, 30), 0),
            ("SQ318", "SQ", "SIN", "LHR", 13, 15, "9V-SNA", Decimal("78000.00"), time(12, 55), 0),
            # NEW: Added for testing route recommendations (SYD -> JFK has no direct flight, but 3 connecting paths)
            ("EK413", "EK", "SYD", "DXB", 14, 30, "A6-EEO", Decimal("80000.00"), time(21, 45), 0),
            ("EK505", "EK", "DXB", "HAM", 6, 30, "A6-EEO", Decimal("48000.00"), time(14, 15), 0), # Added to complete SYD -> DXB -> HAM direct flight connections
            ("SQ222", "SQ", "SYD", "SIN", 8, 5, "9V-SNA", Decimal("60000.00"), time(16, 10), 0),
            ("SQ333", "SQ", "SIN", "HAM", 13, 15, "9V-SNA", Decimal("65000.00"), time(3, 0), 0), # Added to complete SYD -> SIN -> HAM
            ("BA888", "BA", "LHR", "HAM", 1, 45, "G-ZBLB", Decimal("15000.00"), time(17, 0), 0), # Added to complete SYD -> LHR -> HAM
            
            # NEW: 2-stop route testing (SYD -> BKK -> IST -> HAM) with increased rates
            ("QF111", "QF", "SYD", "BKK", 9, 0, "VH-ZNA", Decimal("58000.00"), time(8, 0), 0),
            ("TK222", "TK", "BKK", "IST", 10, 0, "TC-JNA", Decimal("62000.00"), time(20, 0), 0),
            ("TK333", "TK", "IST", "HAM", 3, 30, "TC-JNA", Decimal("38000.00"), time(9, 0), 0),
        ]

        for fno, al_code, dep_code, arr_code, hrs, mins, ac_reg, base_fare, dep_t, day_offset in other_route_templates:
            adjusted_date = today + timedelta(days=day_offset)
            sch_dep = datetime.combine(adjusted_date, dep_t)
            sch_arr = sch_dep + timedelta(hours=hrs, minutes=mins)
            fr, _ = FlightRoute.objects.get_or_create(
                flight_no=fno,
                defaults={
                    "airline": airlines_dict[al_code],
                    "operates_on_days": "1,2,3,4,5,6,7",
                    "scheduled_departure_time": dep_t,
                    "scheduled_arrival_time": sch_arr.time(),
                    "valid_from": valid_from_date,
                    "is_active": True,
                    "baggage_weight_allowed_per_person": 30,
                    "baggage_number_allowed_per_person": 2,
                    "handbag_weight_allowed_per_person": 7,
                }
            )
            FlightLeg.objects.get_or_create(
                flight=fr,
                leg_order=1,
                defaults={
                    "departure_airport": airports_dict[dep_code],
                    "arrival_airport": airports_dict[arr_code],
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
            ac = aircraft_dict[ac_reg]
            if ac.business_capacity > 0:
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

        self.stdout.write(self.style.SUCCESS(
            "Successfully seeded template database! "
            "Created Users, Countries, Airports, Airlines (with logos), Aircraft, FoodItems, "
            "FlightRoutes, FlightLegs, and RouteFareClasses. FlightInstance table was intentionally left empty."
        ))
