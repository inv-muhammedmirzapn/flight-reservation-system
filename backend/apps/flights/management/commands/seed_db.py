import random
from decimal import Decimal
from datetime import datetime, date, time, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.users.models import Profile
from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, InstanceStatus,
    Seat, CabinClass, SeatStatus, RefundType, RouteFareClass,
    FoodItem, FlightMeal, FlightMealItem, Fare
)
from apps.bookings.models import Booking, BookingStatus, Passenger, PassengerMeal, Ticket, SeatHold
from apps.waitlist.models import WaitlistEntry, WaitlistStatus, WaitlistPassenger
from apps.notifications.models import Notification
from apps.flights.services_generation import generate_upcoming_instances

try:
    from populate_airline_logos import populate_logos
except ImportError:
    populate_logos = None

User = get_user_model()


class Command(BaseCommand):
    help = "Comprehensively seeds the database with static data, flight routes, meals, generated instances, sold-out flights for waitlist demo, and user bookings."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Number of days for rolling flight instance generation (default: 30).",
        )

    def handle(self, *args, **options):
        horizon_days = options["days"]
        self.stdout.write(self.style.WARNING("Wiping existing database records..."))

        # Wiping in order of foreign key dependency
        Notification.objects.all().delete()
        WaitlistPassenger.objects.all().delete()
        WaitlistEntry.objects.all().delete()
        Ticket.objects.all().delete()
        PassengerMeal.objects.all().delete()
        Passenger.objects.all().delete()
        Booking.objects.all().delete()
        SeatHold.objects.all().delete()
        Seat.objects.all().delete()
        Fare.objects.all().delete()
        FlightInstance.objects.all().delete()
        RouteFareClass.objects.all().delete()
        FlightLeg.objects.all().delete()
        FlightRoute.objects.all().delete()
        FlightMealItem.objects.all().delete()
        FlightMeal.objects.all().delete()
        FoodItem.objects.all().delete()
        Aircraft.objects.all().delete()
        AircraftModel.objects.all().delete()
        Airline.objects.all().delete()
        Airport.objects.all().delete()
        Country.objects.all().delete()
        Profile.objects.all().delete()
        User.objects.exclude(is_superuser=True).delete()

        self.stdout.write(self.style.SUCCESS("Database wiped successfully. Starting seeding process..."))

        # -------------------------------------------------------------
        # 1. Users & Profiles (1 Admin, 1 Customer)
        # -------------------------------------------------------------
        self.stdout.write("1. Seeding Users & Profiles...")
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

        # -------------------------------------------------------------
        # 2. Countries
        # -------------------------------------------------------------
        self.stdout.write("2. Seeding Countries...")
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

        # -------------------------------------------------------------
        # 3. Airports
        # -------------------------------------------------------------
        self.stdout.write("3. Seeding Airports...")
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

        # -------------------------------------------------------------
        # 4. Airlines
        # -------------------------------------------------------------
        self.stdout.write("4. Seeding Airlines...")
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

        # -------------------------------------------------------------
        # 5. Aircraft Models & Fleet
        # -------------------------------------------------------------
        self.stdout.write("5. Seeding Aircraft Models & Aircraft...")
        models_data = [
            ("Boeing", "777-300ER"), ("Boeing", "787-9 Dreamliner"),
            ("Airbus", "A380-800"), ("Airbus", "A350-900"),
            ("Airbus", "A320neo"), ("Boeing", "737 MAX 8")
        ]
        models_dict = {}
        for mfg, mname in models_data:
            am, _ = AircraftModel.objects.get_or_create(manufacturer=mfg, model_name=mname)
            models_dict[f"{mfg} {mname}"] = am

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

        # -------------------------------------------------------------
        # 6. Food Items & In-Flight Meals (Airline & Cabin Class Scoped)
        # -------------------------------------------------------------
        self.stdout.write("6. Seeding Food Items & In-Flight Meals...")
        food_items_data = [
            ("EK", "Mediterranean Hummus & Pita Wrap", Decimal("450.00"), True, True, True),
            ("EK", "Arabic Spiced Grill Chicken", Decimal("850.00"), False, True, False),
            ("BA", "Grilled Atlantic Salmon with Asparagus", Decimal("1200.00"), False, False, False),
            ("BA", "Traditional English Afternoon Tea Set", Decimal("600.00"), True, False, False),
            ("AA", "Gourmet Beef Tenderloin with Red Wine Reduction", Decimal("1400.00"), False, False, False),
            ("AI", "Butter Chicken with Jeera Rice & Naan", Decimal("650.00"), False, True, False),
            ("AI", "Paneer Tikka Masala Thali", Decimal("500.00"), True, True, False),
            ("SQ", "Vegan Thai Green Curry with Jasmine Rice", Decimal("750.00"), True, True, True),
            ("JL", "Traditional Japanese Bento Box", Decimal("1100.00"), False, False, False),
            ("LH", "Artisanal Cheese & Fresh Fruit Platter", Decimal("800.00"), True, False, False),
            ("6E", "Hyderabadi Chicken Biryani", Decimal("400.00"), False, True, False),
            ("6E", "Paneer Kathi Roll Combo", Decimal("300.00"), True, True, False),
        ]
        food_items_dict = {}
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
            food_items_dict[f"{al_code}_{name}"] = fi

        # Create Scoped FlightMeals
        flight_meals_data = [
            ("AI", CabinClass.ECONOMY, "Indian Veg Thali Set", Decimal("450.00"), [("AI_Paneer Tikka Masala Thali", 1)]),
            ("AI", CabinClass.ECONOMY, "Butter Chicken Special", Decimal("550.00"), [("AI_Butter Chicken with Jeera Rice & Naan", 1)]),
            ("AI", CabinClass.BUSINESS, "Royal Maharaja Dining Platter", Decimal("1100.00"), [("AI_Paneer Tikka Masala Thali", 1), ("AI_Butter Chicken with Jeera Rice & Naan", 1)]),
            ("EK", CabinClass.ECONOMY, "Arabic Mezze Wrap Set", Decimal("500.00"), [("EK_Mediterranean Hummus & Pita Wrap", 1)]),
            ("EK", CabinClass.BUSINESS, "Emirates Gourmet Grill Feast", Decimal("1300.00"), [("EK_Arabic Spiced Grill Chicken", 1), ("EK_Mediterranean Hummus & Pita Wrap", 1)]),
            ("6E", CabinClass.ECONOMY, "Biryani Express Combo", Decimal("400.00"), [("6E_Hyderabadi Chicken Biryani", 1)]),
        ]
        for al_code, cabin, meal_name, price, items in flight_meals_data:
            fm, _ = FlightMeal.objects.get_or_create(
                airline=airlines_dict[al_code],
                cabin_class=cabin,
                name=meal_name,
                defaults={"price": price}
            )
            for fi_key, qty in items:
                if fi_key in food_items_dict:
                    FlightMealItem.objects.get_or_create(
                        flight_meal=fm,
                        food_item=food_items_dict[fi_key],
                        defaults={"quantity": qty}
                    )

        # -------------------------------------------------------------
        # 7. Flight Routes, Flight Legs & RouteFareClasses
        # -------------------------------------------------------------
        self.stdout.write("7. Seeding Flight Routes, Legs & RouteFareClasses...")
        today = date.today()
        valid_from_date = today - timedelta(days=30)

        # Direct Routes: DEL -> HAM
        direct_del_ham_routes = [
            ("AI121", "AI", "VT-ALN", 7, 45, Decimal("38000.00"), time(6, 15)),
            ("LH761", "LH", "D-ABPA", 8, 30, Decimal("42000.00"), time(2, 30)),
            ("EK061", "EK", "A6-EEO", 8, 0, Decimal("46000.00"), time(14, 0)),
            ("6E191", "6E", "VT-IZI", 13, 30, Decimal("24000.00"), time(23, 45)),
        ]

        for fno, al_code, ac_reg, dur_hrs, dur_mins, base_fare, dep_t in direct_del_ham_routes:
            scheduled_dep = datetime.combine(today, dep_t)
            scheduled_arr = scheduled_dep + timedelta(hours=dur_hrs, minutes=dur_mins)
            fr, _ = FlightRoute.objects.get_or_create(
                flight_no=fno,
                defaults={
                    "airline": airlines_dict[al_code],
                    "operates_on_days": "1,2,4,5,6,7",
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

        # Other Global Routes
        other_route_templates = [
            ("EK201", "EK", "DXB", "JFK", 14, 0, "A6-EEO", Decimal("75000.00"), time(8, 30)),
            ("BA177", "BA", "LHR", "JFK", 8, 0, "G-ZBLB", Decimal("62000.00"), time(13, 0)),
            ("AI101", "AI", "DEL", "JFK", 15, 30, "VT-ALN", Decimal("82000.00"), time(1, 45)),
            ("SQ026", "SQ", "SIN", "JFK", 18, 0, "9V-SNA", Decimal("95000.00"), time(23, 50)),
            ("JL006", "JL", "HND", "JFK", 13, 0, "JA873A", Decimal("88000.00"), time(11, 0)),
            ("LH400", "LH", "FRA", "JFK", 8, 30, "D-AIXA", Decimal("58000.00"), time(10, 45)),
            ("AF006", "AF", "CDG", "JFK", 8, 15, "F-HTYA", Decimal("60000.00"), time(14, 10)),
            ("AA100", "AA", "JFK", "LHR", 7, 0, "N777AA", Decimal("54000.00"), time(19, 30)),
            ("QF001", "QF", "SYD", "LHR", 22, 0, "VH-ZNA", Decimal("110000.00"), time(16, 0)),
            ("6E055", "6E", "BOM", "DXB", 3, 30, "VT-IZI", Decimal("18000.00"), time(21, 15)),
        ]

        for fno, al_code, dep_code, arr_code, hrs, mins, ac_reg, base_fare, dep_t in other_route_templates:
            sch_dep = datetime.combine(today, dep_t)
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

        # -------------------------------------------------------------
        # 8. Generate Flight Instances over Rolling Horizon
        # -------------------------------------------------------------
        self.stdout.write(f"8. Generating Flight Instances for a {horizon_days}-day horizon...")
        gen_result = generate_upcoming_instances(horizon_days=horizon_days)
        self.stdout.write(
            f"   Created {gen_result['created_instances_count']} instances, "
            f"{gen_result['created_seats_count']} seats, {gen_result['created_fares_count']} fares."
        )

        # -------------------------------------------------------------
        # 9. Configure Sold-Out Flight Instances for Waitlist Demo
        # -------------------------------------------------------------
        self.stdout.write("9. Setting up Sold-Out flights to demonstrate Waitlist feature...")
        waitlist_instance = FlightInstance.objects.filter(
            flight__flight_no="AI121",
            date__gte=today
        ).order_by("date").first()

        if waitlist_instance:
            # Set Economy fare available seats to 0
            eco_fare = waitlist_instance.fares.filter(cabin_class=CabinClass.ECONOMY).first()
            if eco_fare:
                eco_fare.available_seats = 0
                eco_fare.save()

            # Mark Economy seats on this flight as BOOKED
            waitlist_instance.seats.filter(seat_class=CabinClass.ECONOMY).update(status=SeatStatus.BOOKED)

            self.stdout.write(
                self.style.SUCCESS(
                    f"   Configured flight {waitlist_instance.flight.flight_no} on {waitlist_instance.date} "
                    f"as SOLD OUT for ECONOMY class (Waitlist ready)."
                )
            )

            # Create a sample WaitlistEntry for Customer
            waitlist_entry, _ = WaitlistEntry.objects.get_or_create(
                user=customer_user,
                flight=waitlist_instance,
                cabin_class=CabinClass.ECONOMY,
                defaults={
                    "seat_count": 1,
                    "price": eco_fare.price if eco_fare else Decimal("38000.00"),
                    "status": WaitlistStatus.PENDING,
                }
            )
            WaitlistPassenger.objects.get_or_create(
                waitlist_entry=waitlist_entry,
                name="John Doe",
                defaults={"age": 30, "gender": "M", "phone_number": "+1 555-0123"}
            )
            self.stdout.write(f"   Created sample PENDING waitlist entry for customer on {waitlist_instance.flight.flight_no}.")

        # -------------------------------------------------------------
        # 10. Create Sample Confirmed User Bookings & Tickets
        # -------------------------------------------------------------
        self.stdout.write("10. Seeding Sample User Bookings & Tickets...")
        sample_booking_instance = FlightInstance.objects.filter(
            flight__flight_no="EK061",
            date__gt=today
        ).order_by("date").first()

        if sample_booking_instance:
            fare = sample_booking_instance.fares.filter(cabin_class=CabinClass.ECONOMY).first()
            price = fare.price if fare else Decimal("46000.00")

            booking, _ = Booking.objects.get_or_create(
                user=customer_user,
                flight=sample_booking_instance,
                defaults={
                    "status": BookingStatus.CONFIRMED,
                    "cabin_class": CabinClass.ECONOMY,
                    "seat_count": 1,
                    "total_price": price,
                }
            )

            passenger, _ = Passenger.objects.get_or_create(
                booking=booking,
                name="John Doe",
                defaults={
                    "age": 30,
                    "gender": "M",
                    "phone_number": "+1 555-0123",
                    "meal_preference": "VEG",
                    "seat_number": "12A",
                    "free_baggage_allowance_kg": Decimal("30.00"),
                }
            )

            seat = sample_booking_instance.seats.filter(seat_class=CabinClass.ECONOMY, seat_number="12A").first()
            if seat:
                seat.status = SeatStatus.BOOKED
                seat.save()

            if fare and seat:
                Ticket.objects.get_or_create(
                    booking=booking,
                    flight_instance=sample_booking_instance,
                    fare=fare,
                    passenger=passenger,
                    seat=seat,
                    defaults={
                        "price_paid": price,
                        "currency": "INR",
                        "fare_code": fare.fare_code,
                        "cabin_class": CabinClass.ECONOMY,
                        "refund_type": fare.refund_type or RefundType.PARTIAL,
                    }
                )
            self.stdout.write(f"   Created sample CONFIRMED booking for customer on {sample_booking_instance.flight.flight_no}.")

        # -------------------------------------------------------------
        # 11. Populate Airline Logos (if script available)
        # -------------------------------------------------------------
        if populate_logos:
            self.stdout.write("11. Populating Airline Logos...")
            try:
                populate_logos()
            except Exception as ex:
                self.stdout.write(self.style.WARNING(f"   Note: Logo populator warning: {ex}"))

        self.stdout.write(self.style.SUCCESS(
            "\n========================================================================\n"
            "DATABASE SEEDING COMPLETE!\n"
            "========================================================================\n"
            "Credentials Created:\n"
            "  Admin:    username: admin    / password: admin123\n"
            "  Customer: username: customer / password: customer123\n"
            "Included:\n"
            "  - Airports, Airlines, Aircraft Models, Aircraft, Countries\n"
            "  - Food Items & Flight Meals (Scoped by Airline & Cabin Class)\n"
            "  - Flight Routes, Legs, RouteFareClasses\n"
            f"  - Flight Instances ({horizon_days}-day rolling window) with Seats & Fares\n"
            "  - Sold-out flight instance (available_seats=0) for Waitlist testing\n"
            "  - Sample Customer Bookings & Waitlist Entries\n"
            "========================================================================"
        ))
