from decimal import Decimal
import random
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
    Flight, FlightStatus
)
from apps.bookings.models import Booking, BookingStatus, Passenger
from apps.waitlist.models import WaitlistEntry, WaitlistStatus, WaitlistPassenger
from apps.notifications.models import Notification, NotificationType

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds database with huge real-world mock data for flight management system"

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
        Flight.objects.all().delete()
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

        # 8. Flight Generation Plan
        # We need "few datas from previous 3 months" and "10 flights on today, tomorrow till 2 weeks 10 flights"
        now = timezone.now()
        
        # Define some route templates
        route_templates = [
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
            ("BA015", "BA", "LHR", "SYD", 22, 30, "G-ZBLB"),
        ]

        # First, ensure FlightRoutes and Legs are created
        routes_dict = {}
        for fno, al_code, dep_code, arr_code, hrs, mins, _ in route_templates:
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
            FlightLeg.objects.get_or_create(
                flight=fr,
                leg_order=1,
                defaults={
                    "departure_airport": airports_dict[dep_code],
                    "arrival_airport": airports_dict[arr_code],
                    "scheduled_departure": now, # Dummy, not strictly used
                    "scheduled_arrival": now + timedelta(hours=hrs, minutes=mins), # Dummy
                }
            )

        # Let's generate dates.
        dates_to_generate = []
        
        # 1. Past 3 months (90 days): maybe 1 flight per 3 days to keep it light but existent.
        for i in range(90, 0, -3):
            dates_to_generate.append((now - timedelta(days=i), 2)) # 2 flights on this day
        
        # 2. Today + next 14 days (15 days total): 10 flights per day
        for i in range(15):
            dates_to_generate.append((now + timedelta(days=i), 10))

        self.stdout.write(f"Seeding Flights & Instances for {len(dates_to_generate)} specific dates...")

        legacy_flights_created = []
        flight_instances_created = []

        flight_counter = 1000

        for target_date, num_flights in dates_to_generate:
            selected_routes = random.sample(route_templates, num_flights)
            
            for fno, al_code, dep_code, arr_code, hrs, mins, ac_reg in selected_routes:
                flight_counter += 1
                
                # Randomize hour of departure between 0 and 23
                dep_hour = random.randint(0, 23)
                dep_minute = random.choice([0, 15, 30, 45])
                
                dep_t = target_date.replace(hour=dep_hour, minute=dep_minute, second=0, microsecond=0)
                arr_t = dep_t + timedelta(hours=hrs, minutes=mins)
                
                # Prices must be different and in INR
                base_price = random.randint(15000, 150000)
                
                if dep_t < now:
                    status = FlightStatus.DEPARTED
                    inst_status = InstanceStatus.DEPARTED
                else:
                    status = FlightStatus.SCHEDULED
                    inst_status = InstanceStatus.SCHEDULED

                unique_fno = f"{fno}-{flight_counter}"
                
                # Legacy Flight
                fl, _ = Flight.objects.get_or_create(
                    flight_number=unique_fno,
                    defaults={
                        "airline": airlines_dict[al_code].airline_name,
                        "aircraft": aircraft_dict[ac_reg].aircraft_model.model_name,
                        "source_airport": dep_code,
                        "destination_airport": arr_code,
                        "departure_time": dep_t,
                        "arrival_time": arr_t,
                        "base_fare": base_price,
                        "total_seats": 200,
                        "available_seats": random.randint(50, 150),
                        "status": status,
                        "stops": [],
                    }
                )
                legacy_flights_created.append(fl)

                # Flight Instance
                inst, _ = FlightInstance.objects.get_or_create(
                    flight=routes_dict[fno],
                    date=dep_t.date(),
                    scheduled_departure=dep_t, # Make it unique per day by precise time
                    defaults={
                        "aircraft": aircraft_dict[ac_reg],
                        "status": inst_status,
                        "scheduled_arrival": arr_t,
                        "checkin_open": dep_t - timedelta(hours=24),
                        "boarding_time": dep_t - timedelta(minutes=45),
                        "boarding_gate": f"B{random.randint(1, 30)}",
                        "departure_terminal": "T1",
                        "arrival_terminal": "T3",
                    }
                )
                flight_instances_created.append(inst)

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
                        "change_fee": 3000.00,
                        "meal_included": True,
                        "baggage_allowance": 25.0,
                    }
                )
                Fare.objects.get_or_create(
                    flight_instance=inst,
                    cabin_class=CabinClass.BUSINESS,
                    defaults={
                        "fare_code": f"BIZ-{flight_counter}",
                        "price": base_price * 3, # Huge difference
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

                # Full Seat Generation Logic
                ac = aircraft_dict[ac_reg]
                
                def _pos_left(col_index, block_width):
                    if block_width == 1: return SeatPosition.WINDOW
                    if col_index == 0: return SeatPosition.WINDOW
                    if col_index == block_width - 1: return SeatPosition.AISLE
                    return SeatPosition.MIDDLE

                def _pos_right(col_index, block_width):
                    if block_width == 1: return SeatPosition.WINDOW
                    if col_index == 0: return SeatPosition.AISLE
                    if col_index == block_width - 1: return SeatPosition.WINDOW
                    return SeatPosition.MIDDLE

                def _make_seats(capacity, cabin_class, prefix, cols_per_row):
                    if capacity <= 0:
                        return []
                    rows_needed = -(-capacity // cols_per_row)
                    col_letters = [chr(ord('A') + i) for i in range(cols_per_row)]
                    left_block = cols_per_row // 2
                    right_block = cols_per_row - left_block
                    created, remaining = [], capacity
                    
                    for row_num in range(1, rows_needed + 1):
                        for col_idx, letter in enumerate(col_letters):
                            if remaining <= 0:
                                break
                            pos = _pos_left(col_idx, left_block) if col_idx < left_block else _pos_right(col_idx - left_block, right_block)
                            
                            # Randomly book a few seats (10% chance)
                            st = SeatStatus.BOOKED if random.random() < 0.1 else SeatStatus.AVAILABLE
                            
                            # Default fees for premiums
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
                                exit_row=False,
                                seat_fee=fee,
                                currency="INR",
                            ))
                            remaining -= 1
                    return created

                seats = []
                fc = ac.first_class_capacity
                seats += _make_seats(fc, CabinClass.FIRST, "F", 4 if fc > 2 else max(fc, 2))
                bc = ac.business_capacity
                seats += _make_seats(bc, CabinClass.BUSINESS, "B", 4 if bc > 2 else max(bc, 2))
                ec = ac.economy_capacity
                seats += _make_seats(ec, CabinClass.ECONOMY, "E", 6 if ec > 3 else max(ec, 3))
                
                Seat.objects.bulk_create(seats)

                # Flight Meals
                fm, _ = FlightMeal.objects.get_or_create(
                    flight_instance=inst,
                    name=f"Standard Service Menu - {fno}",
                )
                food_sample = random.choice(food_items_list)
                FlightMealItem.objects.get_or_create(
                    flight_meal=fm,
                    food_item=food_sample,
                    defaults={"quantity": 2}
                )

        self.stdout.write("Seeding Bookings, Passengers, Notifications...")
        
        # We will create a few bookings for some flights
        for i in range(30):
            flight_obj = random.choice(legacy_flights_created)
            user_obj = customer_user if i % 2 == 0 else admin_user
            b, _ = Booking.objects.get_or_create(
                id=f"10000000-0000-0000-0000-0000000000{i:02d}",
                defaults={
                    "user": user_obj,
                    "flight": flight_obj,
                    "status": BookingStatus.CONFIRMED,
                    "seat_count": 1,
                    "total_price": flight_obj.base_fare,
                }
            )
            Passenger.objects.get_or_create(
                booking=b,
                name=f"Passenger {i}",
                defaults={
                    "age": 30 + (i % 20),
                    "gender": "M" if i % 2 == 0 else "F",
                    "phone_number": f"+1 555-012{i%10}",
                }
            )

        self.stdout.write(self.style.SUCCESS("Successfully seeded database with HUGE real-world mock data in INR for all tables!"))
