from decimal import Decimal
import random
import uuid
from datetime import timedelta
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
from apps.bookings.models import Booking, BookingStatus, Passenger
from apps.waitlist.models import WaitlistEntry, WaitlistStatus, WaitlistPassenger
from apps.notifications.models import Notification, NotificationType

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds database with comprehensive real-world mock data for flight management system"

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
        Profile.objects.exclude(user__is_superuser=True).delete()
        User.objects.exclude(is_superuser=True).delete()
        
        self.stdout.write(self.style.SUCCESS("Database wiped successfully. Starting seed..."))

        # 1. Customer Users & Profiles
        self.stdout.write("Seeding Customer Users & Profiles...")


        customer_configs = [
            ("customer", "customer@gmail.com", "customer123", "John", "Doe", "+1 555-0123", "1994-09-22", Profile.Gender.MALE, "United Kingdom", "England", "London"),
            ("sarah_c", "sarah.connor@skyflow.com", "sarah123", "Sarah", "Connor", "+1 555-0144", "1991-03-12", Profile.Gender.FEMALE, "United States", "California", "Los Angeles"),
            ("alex_s", "alex.smith@skyflow.com", "alex123", "Alex", "Smith", "+44 7911 123456", "1985-11-05", Profile.Gender.MALE, "United Kingdom", "London", "London"),
            ("priya_s", "priya.sharma@skyflow.com", "priya123", "Priya", "Sharma", "+91 98765 43210", "1996-07-18", Profile.Gender.FEMALE, "India", "Maharashtra", "Mumbai"),
            ("kenji_s", "kenji.sato@skyflow.com", "kenji123", "Kenji", "Sato", "+81 90 1234 5678", "1990-01-30", Profile.Gender.MALE, "Japan", "Tokyo", "Tokyo"),
        ]

        customer_users = []
        for uname, email, pwd, fname, lname, phone, dob, gen, ctry, st, cty in customer_configs:
            u, _ = User.objects.get_or_create(
                username=uname,
                defaults={
                    "email": email,
                    "first_name": fname,
                    "last_name": lname,
                    "is_staff": False,
                    "is_superuser": False,
                }
            )
            u.set_password(pwd)
            u.save()

            p, _ = Profile.objects.get_or_create(user=u)
            p.role = Profile.Role.CUSTOMER
            p.phone_number = phone
            p.date_of_birth = dob
            p.gender = gen
            p.country = ctry
            p.state = st
            p.city = cty
            p.save()
            customer_users.append(u)

        # 2. Countries
        self.stdout.write("Seeding Countries...")
        countries_data = [
            ("United States", "US"), ("India", "IN"), ("United Kingdom", "GB"),
            ("United Arab Emirates", "AE"), ("Japan", "JP"), ("Singapore", "SG"),
            ("Germany", "DE"), ("France", "FR"), ("Canada", "CA"), ("Australia", "AU"),
            ("Qatar", "QA"), ("Turkey", "TR"), ("Thailand", "TH"), ("Malaysia", "MY"),
            ("South Korea", "KR"), ("Netherlands", "NL"), ("Switzerland", "CH"),
            ("Italy", "IT"), ("Spain", "ES"), ("Brazil", "BR"),
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
            ("BOM", "Chhatrapati Shivaji Maharaj International Airport", "Mumbai", "Asia/Kolkata", Decimal("19.089559"), Decimal("72.865614"), "IN", ["T1", "T2"]),
            ("HND", "Tokyo Haneda Airport", "Tokyo", "Asia/Tokyo", Decimal("35.549393"), Decimal("139.779839"), "JP", ["1", "2", "3"]),
            ("SIN", "Singapore Changi Airport", "Singapore", "Asia/Singapore", Decimal("1.364420"), Decimal("103.991531"), "SG", ["T1", "T2", "T3", "T4"]),
            ("CDG", "Charles de Gaulle Airport", "Paris", "Europe/Paris", Decimal("49.009690"), Decimal("2.547925"), "FR", ["2A", "2E", "2F"]),
            ("FRA", "Frankfurt Airport", "Frankfurt", "Europe/Berlin", Decimal("50.037933"), Decimal("8.562152"), "DE", ["1", "2"]),
            ("SYD", "Sydney Kingsford Smith Airport", "Sydney", "Australia/Sydney", Decimal("-33.939923"), Decimal("151.175276"), "AU", ["T1", "T2", "T3"]),
            ("DOH", "Hamad International Airport", "Doha", "Asia/Qatar", Decimal("25.273056"), Decimal("51.608056"), "QA", ["1"]),
            ("IST", "Istanbul Airport", "Istanbul", "Europe/Istanbul", Decimal("41.259722"), Decimal("28.745556"), "TR", ["1"]),
            ("BKK", "Suvarnabhumi Airport", "Bangkok", "Asia/Bangkok", Decimal("13.681108"), Decimal("100.747283"), "TH", ["1"]),
            ("LAX", "Los Angeles International Airport", "Los Angeles", "America/Los_Angeles", Decimal("33.941589"), Decimal("-118.408530"), "US", ["1", "2", "B"]),
            ("ORD", "O'Hare International Airport", "Chicago", "America/Chicago", Decimal("41.974162"), Decimal("-87.907321"), "US", ["1", "2", "3", "5"]),
            ("SFO", "San Francisco International Airport", "San Francisco", "America/Los_Angeles", Decimal("37.621313"), Decimal("-122.378955"), "US", ["1", "2", "3", "I"]),
            ("AMS", "Amsterdam Airport Schiphol", "Amsterdam", "Europe/Amsterdam", Decimal("52.310539"), Decimal("4.768274"), "NL", ["1", "2", "3"]),
            ("ZRH", "Zurich Airport", "Zurich", "Europe/Zurich", Decimal("47.458216"), Decimal("8.555475"), "CH", ["A", "B", "E"]),
            ("KUL", "Kuala Lumpur International Airport", "Kuala Lumpur", "Asia/Kuala_Lumpur", Decimal("2.745578"), Decimal("101.709917"), "MY", ["KLIA1", "KLIA2"]),
            ("ICN", "Incheon International Airport", "Seoul", "Asia/Seoul", Decimal("37.460190"), Decimal("126.440695"), "KR", ["T1", "T2"]),
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

        # 6. Aircraft (with accurate layouts)
        self.stdout.write("Seeding Aircraft...")
        aircraft_data = [
            ("N777AA", "AA", "Boeing 777-300ER", 216, 52, 8, "3-4-3", "2-2-2", "1-2-1"),
            ("A6-EEO", "EK", "Airbus A380-800", 399, 76, 14, "3-4-3", "2-2-2", "1-1-1"),
            ("G-ZBLB", "BA", "Boeing 787-9 Dreamliner", 154, 42, 8, "3-3-3", "2-2-2", "1-2-1"),
            ("VT-ALN", "AI", "Boeing 777-300ER", 256, 35, 4, "3-4-3", "2-3-2", "1-2-1"),
            ("9V-SNA", "SQ", "Airbus A350-900", 187, 42, 0, "3-3-3", "1-2-1", "1-1-1"),
            ("JA873A", "JL", "Boeing 787-9 Dreamliner", 156, 52, 0, "2-4-2", "2-2-2", "1-2-1"),
            ("D-AIXA", "LH", "Airbus A350-900", 224, 48, 0, "3-3-3", "2-2-2", "1-2-1"),
            ("F-HTYA", "AF", "Airbus A350-900", 224, 34, 0, "3-3-3", "1-2-1", "1-1-1"),
            ("VH-ZNA", "QF", "Boeing 787-9 Dreamliner", 166, 42, 0, "3-3-3", "1-2-1", "1-1-1"),
            ("VT-IZI", "6E", "Airbus A320neo", 186, 0, 0, "3-3", "2-2", "2-2"),
            ("A7-BBA", "QR", "Boeing 777-300ER", 216, 42, 0, "3-4-3", "1-2-1", "1-1-1"),
            ("TC-JNA", "TK", "Airbus A350-900", 224, 34, 0, "3-3-3", "1-2-1", "1-1-1"),
            ("N123AA", "AA", "Boeing 737 MAX 8", 162, 16, 0, "3-3", "2-2", "2-2"),
        ]
        aircraft_dict = {}
        for reg, al_code, mkey, econ, bus, fst, e_lay, b_lay, f_lay in aircraft_data:
            ac, _ = Aircraft.objects.get_or_create(
                registration=reg,
                defaults={
                    "airline": airlines_dict[al_code],
                    "aircraft_model": models_dict[mkey],
                    "economy_capacity": econ,
                    "business_capacity": bus,
                    "first_class_capacity": fst,
                    "economy_layout": e_lay,
                    "business_layout": b_lay,
                    "first_class_layout": f_lay,
                }
            )
            aircraft_dict[reg] = ac

        # 7. Food Items (In INR, Rich Variety per Airline)
        self.stdout.write("Seeding Food Items...")
        food_items_data = [
            ("EK", "Mediterranean Hummus & Pita Wrap", 450.00, True, True, True),
            ("EK", "Arabic Cold Mezze Platter", 650.00, True, True, False),
            ("EK", "Grilled Lamb Kabab with Saffron Rice", 1250.00, False, True, False),
            ("EK", "Date & Honey Halwa Cake", 350.00, True, True, False),
            ("BA", "Grilled Atlantic Salmon with Asparagus", 1200.00, False, False, False),
            ("BA", "Traditional English Breakfast & Sausage", 850.00, False, False, False),
            ("BA", "Artisanal British Cheese Board", 900.00, True, False, False),
            ("AA", "Gourmet Beef Tenderloin with Red Wine Reduction", 1400.00, False, False, False),
            ("AA", "Classic American Cheeseburger & Potato Wedges", 550.00, False, False, False),
            ("AA", "Vegan Quinoa Bowl with Roasted Veggies", 600.00, True, True, True),
            ("AI", "Butter Chicken with Jeera Rice & Naan", 650.00, False, True, False),
            ("AI", "Paneer Butter Masala with Basmati Rice", 550.00, True, True, False),
            ("AI", "Hyderabadi Dum Biryani (Chicken)", 700.00, False, True, False),
            ("AI", "South Indian Masala Dosa with Sambar", 450.00, True, True, True),
            ("SQ", "Vegan Thai Green Curry with Jasmine Rice", 750.00, True, True, True),
            ("SQ", "Singapore Hainanese Chicken Rice", 850.00, False, True, False),
            ("SQ", "Seafood Laksa Noodle Soup", 950.00, False, True, False),
            ("JL", "Traditional Japanese Bento Box (Unagi & Salmon)", 1300.00, False, False, False),
            ("JL", "Vegetable Tempura with Udon Noodles", 750.00, True, True, True),
            ("JL", "Matcha Green Tea Cheesecake", 400.00, True, False, False),
            ("LH", "Artisanal Cheese & Fresh Fruit Platter", 800.00, True, False, False),
            ("LH", "Bavarian Chicken Schnitzel with Potato Salad", 950.00, False, False, False),
            ("6E", "Hyderabadi Chicken Biryani", 400.00, False, True, False),
            ("6E", "Mumbai Masala Sandwich & Chips", 300.00, True, True, False),
            ("QR", "Qatari Style Spiced Chicken Majboos", 1100.00, False, True, False),
            ("QR", "Royal Baklava & Dates Selection", 500.00, True, True, False),
            ("TK", "Turkish Mixed Grill & Bulgur Pilaf", 1150.00, False, True, False),
            ("TK", "Spinach & Feta Cheese Borek", 550.00, True, True, False),
            ("AF", "Classic French Duck Confit with Dauphinoise", 1450.00, False, False, False),
            ("AF", "Truffle Mushroom Risotto", 980.00, True, True, False),
            ("QF", "Australian Grass-fed Ribeye Steak", 1600.00, False, False, False),
        ]
        food_items_by_airline = {}
        food_items_all = []
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
            food_items_all.append(fi)
            if al_code not in food_items_by_airline:
                food_items_by_airline[al_code] = []
            food_items_by_airline[al_code].append(fi)

        # 8. Flight Generation Plan (Direct & Multi-leg Layovers)
        # Format: (flight_no, airline_code, aircraft_reg, [ (dep_code, arr_code, duration_mins, layover_mins), ... ])
        route_templates = [
            ("QF001", "QF", "VH-ZNA", [("SYD", "SIN", 480, 0), ("SIN", "LHR", 840, 120)]), # Sydney to London via Singapore (2 legs, 2hr layover)
            ("BA015", "BA", "G-ZBLB", [("LHR", "SIN", 780, 0), ("SIN", "SYD", 450, 90)]),  # London to Sydney via Singapore (2 legs, 1.5hr layover)
            ("AI101", "AI", "VT-ALN", [("DEL", "FRA", 510, 0), ("FRA", "JFK", 540, 150)]), # Delhi to New York via Frankfurt (2 legs, 2.5hr layover)
            ("SQ026", "SQ", "9V-SNA", [("SIN", "FRA", 780, 0), ("FRA", "JFK", 530, 120)]), # Singapore to New York via Frankfurt (2 legs, 2hr layover)
            ("LH778", "LH", "D-AIXA", [("FRA", "DXB", 390, 0), ("DXB", "SIN", 450, 105)]), # Frankfurt to Singapore via Dubai (2 legs, 1.75hr layover)
            ("TK001", "TK", "TC-JNA", [("IST", "FRA", 210, 0), ("FRA", "JFK", 540, 90)]),  # Istanbul to New York via Frankfurt (2 legs, 1.5hr layover)
            ("EK201", "EK", "A6-EEO", [("DXB", "JFK", 840, 0)]),                          # Dubai to New York (Direct)
            ("EK202", "EK", "A6-EEO", [("JFK", "DXB", 810, 0)]),                          # New York to Dubai (Direct)
            ("BA177", "BA", "G-ZBLB", [("LHR", "JFK", 480, 0)]),                          # London to New York (Direct)
            ("BA178", "BA", "G-ZBLB", [("JFK", "LHR", 435, 0)]),                          # New York to London (Direct)
            ("JL006", "JL", "JA873A", [("HND", "JFK", 780, 0)]),                          # Tokyo to New York (Direct)
            ("LH400", "LH", "D-AIXA", [("FRA", "JFK", 510, 0)]),                          # Frankfurt to New York (Direct)
            ("AF006", "AF", "F-HTYA", [("CDG", "JFK", 495, 0)]),                          # Paris to New York (Direct)
            ("AA100", "AA", "N777AA", [("JFK", "LHR", 420, 0)]),                          # New York to London (Direct)
            ("AA200", "AA", "N123AA", [("JFK", "LAX", 345, 0)]),                          # New York to Los Angeles (Direct)
            ("6E055", "6E", "VT-IZI", [("BOM", "DXB", 210, 0)]),                          # Mumbai to Dubai (Direct)
            ("6E101", "6E", "VT-IZI", [("DEL", "BOM", 130, 0)]),                          # Delhi to Mumbai (Direct)
            ("QR001", "QR", "A7-BBA", [("DOH", "LHR", 435, 0)]),                          # Doha to London (Direct)
            ("QR701", "QR", "A7-BBA", [("DOH", "JFK", 825, 0)]),                          # Doha to New York (Direct)
            ("AI202", "AI", "VT-ALN", [("DEL", "LHR", 570, 0)]),                          # Delhi to London (Direct)
            ("EK501", "EK", "A6-EEO", [("DXB", "BOM", 195, 0)]),                          # Dubai to Mumbai (Direct)
            ("SQ638", "SQ", "9V-SNA", [("SIN", "HND", 420, 0)]),                          # Singapore to Tokyo (Direct)
            ("AF256", "AF", "F-HTYA", [("CDG", "SIN", 770, 0)]),                          # Paris to Singapore (Direct)
        ]

        now = timezone.now()

        # Create FlightRoutes & FlightLegs
        routes_dict = {}
        route_legs_info = {}
        for fno, al_code, ac_reg, legs_list in route_templates:
            fr, _ = FlightRoute.objects.get_or_create(
                flight_no=fno,
                defaults={
                    "airline": airlines_dict[al_code],
                    "baggage_weight_allowed_per_person": 30,
                    "baggage_number_allowed_per_person": 2,
                    "handbag_weight_allowed_per_person": 7,
                }
            )
            routes_dict[fno] = fr
            route_legs_info[fno] = (ac_reg, legs_list)

            # Re-create legs for this flight route
            FlightLeg.objects.filter(flight=fr).delete()
            for leg_idx, (dep_code, arr_code, dur_mins, layover_mins) in enumerate(legs_list, start=1):
                FlightLeg.objects.create(
                    flight=fr,
                    leg_order=leg_idx,
                    departure_airport=airports_dict[dep_code],
                    arrival_airport=airports_dict[arr_code],
                    flight_duration_minutes=dur_mins,
                    layover_duration_minutes=layover_mins,
                    scheduled_departure=now,
                    scheduled_arrival=now + timedelta(minutes=dur_mins),
                )

        # Dates setup:
        # - Historical dates across past 12 months (365 days): 2 flights per day every 3 days (~240 past flight instances)
        # - Current & Future (Today + 30 days): 8-12 flights per day (~300 future flight instances)
        dates_to_generate = []
        
        # Past 365 days
        for i in range(365, 0, -2):
            dates_to_generate.append((now - timedelta(days=i), 2, True))
        
        # Today + 30 days ahead
        for i in range(31):
            dates_to_generate.append((now + timedelta(days=i), 8, False))

        self.stdout.write(f"Seeding Flights & Instances for {len(dates_to_generate)} date slots...")

        past_flight_instances = []
        future_flight_instances = []

        flight_counter = 1000

        for target_date, num_flights, is_past in dates_to_generate:
            selected_routes = random.sample(route_templates, min(num_flights, len(route_templates)))
            
            for fno, al_code, ac_reg, legs_list in selected_routes:
                flight_counter += 1
                
                dep_hour = random.randint(0, 23)
                dep_minute = random.choice([0, 15, 30, 45])
                
                dep_t = target_date.replace(hour=dep_hour, minute=dep_minute, second=0, microsecond=0)
                total_duration_mins = sum(dur + layover for _, _, dur, layover in legs_list)
                arr_t = dep_t + timedelta(minutes=total_duration_mins)
                
                base_price = random.randint(18000, 160000)
                
                delay_mins = 0
                if is_past:
                    inst_status = InstanceStatus.ARRIVED
                    if random.random() < 0.15:
                        delay_mins = random.choice([15, 30, 45, 60, 90, 120])
                else:
                    if dep_t <= now + timedelta(hours=2):
                        inst_status = InstanceStatus.BOARDING
                    else:
                        inst_status = InstanceStatus.SCHEDULED
                        if random.random() < 0.10:
                            inst_status = InstanceStatus.DELAYED
                            delay_mins = random.choice([20, 45, 60, 120])

                inst, created = FlightInstance.objects.get_or_create(
                    flight=routes_dict[fno],
                    date=dep_t.date(),
                    scheduled_departure=dep_t,
                    defaults={
                        "aircraft": aircraft_dict[ac_reg],
                        "status": inst_status,
                        "scheduled_arrival": arr_t,
                        "actual_departure": dep_t + timedelta(minutes=delay_mins) if is_past else None,
                        "actual_arrival": arr_t + timedelta(minutes=delay_mins) if is_past else None,
                        "delay_minutes": delay_mins,
                        "checkin_open": dep_t - timedelta(hours=24),
                        "boarding_time": dep_t - timedelta(minutes=45),
                        "boarding_gate": f"{random.choice(['A','B','C','D'])}{random.randint(1, 28)}",
                        "departure_terminal": random.choice(["T1", "T2", "T3"]),
                        "arrival_terminal": random.choice(["T1", "T2", "T3"]),
                    }
                )
                
                if is_past:
                    past_flight_instances.append(inst)
                else:
                    future_flight_instances.append(inst)

                if created:
                    # Fares (3 classes)
                    Fare.objects.get_or_create(
                        flight_instance=inst,
                        cabin_class=CabinClass.ECONOMY,
                        defaults={
                            "fare_code": f"ECO-{flight_counter}",
                            "price": base_price,
                            "currency": "INR",
                            "available_seats": 150,
                            "refund_type": RefundType.NON_REFUNDABLE,
                            "change_fee": 3500.00,
                            "meal_included": True,
                            "baggage_allowance": 25.0,
                        }
                    )
                    Fare.objects.get_or_create(
                        flight_instance=inst,
                        cabin_class=CabinClass.BUSINESS,
                        defaults={
                            "fare_code": f"BIZ-{flight_counter}",
                            "price": base_price * 3,
                            "currency": "INR",
                            "available_seats": 30,
                            "refund_type": RefundType.REFUNDABLE,
                            "change_fee": 0.00,
                            "meal_included": True,
                            "baggage_allowance": 40.0,
                        }
                    )
                    Fare.objects.get_or_create(
                        flight_instance=inst,
                        cabin_class=CabinClass.FIRST,
                        defaults={
                            "fare_code": f"FST-{flight_counter}",
                            "price": base_price * 6,
                            "currency": "INR",
                            "available_seats": 10,
                            "refund_type": RefundType.REFUNDABLE,
                            "change_fee": 0.00,
                            "meal_included": True,
                            "baggage_allowance": 50.0,
                        }
                    )

                    # Seat Generation using exact Aircraft Layouts
                    ac = aircraft_dict[ac_reg]
                    
                    def _parse_layout_blocks(layout_str):
                        if not layout_str:
                            return [3, 3]
                        try:
                            blocks = [int(x) for x in layout_str.split('-') if x.isdigit() and int(x) > 0]
                            return blocks if blocks else [3, 3]
                        except Exception:
                            return [3, 3]

                    def _determine_seat_position(col_index, layout_blocks):
                        curr = 0
                        for block_idx, block_width in enumerate(layout_blocks):
                            if col_index < curr + block_width:
                                local_idx = col_index - curr
                                is_first_block = (block_idx == 0)
                                is_last_block = (block_idx == len(layout_blocks) - 1)
                                
                                if block_width == 1:
                                    return SeatPosition.WINDOW if (is_first_block or is_last_block) else SeatPosition.AISLE
                                if local_idx == 0:
                                    return SeatPosition.WINDOW if is_first_block else SeatPosition.AISLE
                                if local_idx == block_width - 1:
                                    return SeatPosition.WINDOW if is_last_block else SeatPosition.AISLE
                                return SeatPosition.MIDDLE
                            curr += block_width
                        return SeatPosition.MIDDLE

                    def _make_seats(capacity, cabin_class, prefix, layout_str):
                        if capacity <= 0:
                            return []
                        layout_blocks = _parse_layout_blocks(layout_str)
                        cols_per_row = sum(layout_blocks)
                        rows_needed = -(-capacity // cols_per_row)
                        col_letters = [chr(ord('A') + i) for i in range(cols_per_row)]
                        created, remaining = [], capacity
                        
                        for row_num in range(1, rows_needed + 1):
                            for col_idx, letter in enumerate(col_letters):
                                if remaining <= 0:
                                    break
                                pos = _determine_seat_position(col_idx, layout_blocks)
                                st = SeatStatus.BOOKED if random.random() < 0.15 else SeatStatus.AVAILABLE
                                fee = 0
                                if cabin_class == CabinClass.FIRST: fee = 5000
                                elif cabin_class == CabinClass.BUSINESS: fee = 2500
                                elif pos == SeatPosition.WINDOW: fee = 800
                                
                                created.append(Seat(
                                    flight_instance=inst,
                                    seat_number=f"{prefix}{row_num}{letter}",
                                    seat_class=cabin_class,
                                    position=pos,
                                    status=st,
                                    exit_row=(row_num in [1, 10, 15]),
                                    extra_legroom=(row_num in [1, 10]),
                                    seat_fee=fee,
                                    currency="INR",
                                ))
                                remaining -= 1
                        return created

                    seats = []
                    seats += _make_seats(ac.first_class_capacity, CabinClass.FIRST, "F", ac.first_class_layout)
                    seats += _make_seats(ac.business_capacity, CabinClass.BUSINESS, "B", ac.business_layout)
                    seats += _make_seats(ac.economy_capacity, CabinClass.ECONOMY, "E", ac.economy_layout)
                    
                    Seat.objects.bulk_create(seats)

                    # Flight Meals (2-3 food items per meal)
                    fm, _ = FlightMeal.objects.get_or_create(
                        flight_instance=inst,
                        name=f"Inflight Dining Service - {fno}",
                    )
                    avail_foods = food_items_by_airline.get(al_code, food_items_all)
                    selected_foods = random.sample(avail_foods, min(3, len(avail_foods)))
                    for food_sample in selected_foods:
                        FlightMealItem.objects.get_or_create(
                            flight_meal=fm,
                            food_item=food_sample,
                            defaults={"quantity": random.randint(1, 3)}
                        )

        all_instances = past_flight_instances + future_flight_instances

        # 9. Seed Bookings across Previous Months & Current/Future
        self.stdout.write("Seeding Bookings across past 12 months & future dates...")
        
        total_bookings_to_create = 300
        booking_counter = 0

        # We generate dates spanning 365 days ago to 10 days in future
        first_names = ["James", "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Lucas", "Isabella", "Mason", "Mia", "Oliver", "Amelia", "Elijah", "Charlotte"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas"]

        notifications_to_create = []

        for i in range(total_bookings_to_create):
            booking_counter += 1
            user_obj = random.choice(customer_users)
            
            # Distribute 70% in the past 12 months, 30% in present/future
            if random.random() < 0.70 and past_flight_instances:
                flight_inst = random.choice(past_flight_instances)
                # Booking created 1 to 30 days before the flight scheduled departure
                booking_dt = flight_inst.scheduled_departure - timedelta(days=random.randint(1, 30), hours=random.randint(0, 23))
            else:
                flight_inst = random.choice(all_instances)
                booking_dt = now - timedelta(days=random.randint(0, 60), hours=random.randint(0, 23))

            # Ensure booking_dt is not in the future beyond now
            if booking_dt > now:
                booking_dt = now - timedelta(hours=random.randint(1, 12))

            status = BookingStatus.CONFIRMED if random.random() < 0.88 else BookingStatus.CANCELLED
            cabin = random.choice([CabinClass.ECONOMY, CabinClass.ECONOMY, CabinClass.BUSINESS, CabinClass.FIRST])
            seat_cnt = random.choice([1, 1, 1, 2, 3])

            fare = Fare.objects.filter(flight_instance=flight_inst, cabin_class=cabin).first()
            price_per_seat = fare.price if fare else Decimal("22000.00")
            total_price = price_per_seat * seat_cnt

            b_id = uuid.uuid4()
            b = Booking.objects.create(
                id=b_id,
                user=user_obj,
                flight=flight_inst,
                status=status,
                cabin_class=cabin,
                seat_count=seat_cnt,
                total_price=total_price,
            )

            # Override created_at with historical timestamp for analytics
            Booking.objects.filter(id=b.id).update(created_at=booking_dt)

            # Create Passengers
            avail_seats = list(Seat.objects.filter(flight_instance=flight_inst, seat_class=cabin, status=SeatStatus.AVAILABLE)[:seat_cnt])
            for p_idx in range(seat_cnt):
                p_name = f"{random.choice(first_names)} {random.choice(last_names)}"
                s_num = avail_seats[p_idx].seat_number if p_idx < len(avail_seats) else f"{cabin[0]}{p_idx+1}A"
                Passenger.objects.create(
                    booking=b,
                    name=p_name,
                    age=random.randint(18, 65),
                    gender=random.choice(['M', 'F']),
                    phone_number=f"+1 555-{random.randint(100, 999):03d}",
                    seat_number=s_num,
                )

            # Create Notification
            if status == BookingStatus.CONFIRMED:
                n_type = NotificationType.BOOKING_CONFIRMED
                title = "Booking Confirmed"
                msg = f"Your booking for flight {flight_inst.flight.flight_no} on {flight_inst.date} has been confirmed."
            else:
                n_type = NotificationType.BOOKING_CANCELLED
                title = "Booking Cancelled"
                msg = f"Your booking for flight {flight_inst.flight.flight_no} on {flight_inst.date} was cancelled."

            notifications_to_create.append(Notification(
                user=user_obj,
                title=title,
                message=msg,
                notification_type=n_type,
                is_read=random.choice([True, False]),
            ))

        # 10. Seed Waitlist Entries & Passengers
        self.stdout.write("Seeding Waitlist Entries...")
        for i in range(35):
            user_obj = random.choice(customer_users)
            flight_inst = random.choice(future_flight_instances)
            w_status = random.choice([WaitlistStatus.PENDING, WaitlistStatus.CONFIRMED, WaitlistStatus.CANCELLED])
            seat_cnt = random.choice([1, 2])
            cabin = random.choice([CabinClass.ECONOMY, CabinClass.BUSINESS])
            
            fare = Fare.objects.filter(flight_instance=flight_inst, cabin_class=cabin).first()
            w_price = (fare.price if fare else Decimal("18000.00")) * seat_cnt

            w = WaitlistEntry.objects.create(
                user=user_obj,
                flight=flight_inst,
                seat_count=seat_cnt,
                cabin_class=cabin,
                price=w_price,
                status=w_status,
            )

            w_dt = now - timedelta(days=random.randint(1, 30), hours=random.randint(0, 23))
            WaitlistEntry.objects.filter(id=w.id).update(created_at=w_dt)

            for p_idx in range(seat_cnt):
                WaitlistPassenger.objects.create(
                    waitlist_entry=w,
                    name=f"{random.choice(first_names)} {random.choice(last_names)}",
                    age=random.randint(20, 55),
                    gender=random.choice(['M', 'F']),
                    phone_number=f"+1 555-{random.randint(100, 999):03d}",
                )

        Notification.objects.bulk_create(notifications_to_create)

        self.stdout.write(self.style.SUCCESS("Successfully seeded database with HUGE, realistic multi-month data, flights, foods, bookings & waitlists in INR!"))
