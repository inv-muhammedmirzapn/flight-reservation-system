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
    help = "Seeds database with real-world mock data for flight management system"

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting database seeding process..."))

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
        
        # Ensure admin profile details
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

        # 2. Countries (10 records)
        self.stdout.write("Seeding Countries...")
        countries_data = [
            ("United States", "US"),
            ("India", "IN"),
            ("United Kingdom", "GB"),
            ("United Arab Emirates", "AE"),
            ("Japan", "JP"),
            ("Singapore", "SG"),
            ("Germany", "DE"),
            ("France", "FR"),
            ("Canada", "CA"),
            ("Australia", "AU"),
        ]
        countries_dict = {}
        for name, iso in countries_data:
            c, _ = Country.objects.get_or_create(iso_code=iso, defaults={"name": name})
            countries_dict[iso] = c

        # 3. Airports (10 records)
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
                    "country": countries_dict[country_iso],
                    "terminals": term,
                }
            )
            airports_dict[iata] = ap

        # 4. Airlines (10 records)
        self.stdout.write("Seeding Airlines...")
        airlines_data = [
            ("EK", "Emirates"),
            ("BA", "British Airways"),
            ("AA", "American Airlines"),
            ("AI", "Air India"),
            ("SQ", "Singapore Airlines"),
            ("JL", "Japan Airlines"),
            ("LH", "Lufthansa"),
            ("AF", "Air France"),
            ("QF", "Qantas Airways"),
            ("6E", "IndiGo Airlines"),
        ]
        airlines_dict = {}
        for code, name in airlines_data:
            al, _ = Airline.objects.get_or_create(iata_airline_code=code, defaults={"airline_name": name})
            airlines_dict[code] = al

        # 5. Aircraft Models (10 records)
        self.stdout.write("Seeding Aircraft Models...")
        models_data = [
            ("Boeing", "777-300ER"),
            ("Boeing", "787-9 Dreamliner"),
            ("Boeing", "737 MAX 8"),
            ("Airbus", "A380-800"),
            ("Airbus", "A350-900"),
            ("Airbus", "A320neo"),
            ("Airbus", "A330-900"),
            ("Embraer", "E195-E2"),
            ("Bombardier", "CRJ-900"),
            ("Boeing", "747-8 Intercontinental"),
        ]
        models_dict = {}
        for mfg, mname in models_data:
            am, _ = AircraftModel.objects.get_or_create(manufacturer=mfg, model_name=mname)
            models_dict[f"{mfg} {mname}"] = am

        # 6. Aircraft (10 records)
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

        # 7. FlightRoutes (10 records)
        self.stdout.write("Seeding Flight Routes...")
        routes_data = [
            ("EK201", "EK", 30, 2, 7),
            ("BA177", "BA", 23, 1, 7),
            ("AI101", "AI", 25, 2, 8),
            ("SQ026", "SQ", 30, 2, 7),
            ("JL006", "JL", 23, 2, 10),
            ("LH400", "LH", 23, 1, 8),
            ("AF006", "AF", 23, 1, 8),
            ("AA100", "AA", 23, 2, 7),
            ("QF001", "QF", 30, 2, 7),
            ("6E055", "6E", 15, 1, 7),
        ]
        routes_dict = {}
        for fno, al_code, bag_wt, bag_num, hand_wt in routes_data:
            fr, _ = FlightRoute.objects.get_or_create(
                flight_no=fno,
                defaults={
                    "airline": airlines_dict[al_code],
                    "baggage_weight_allowed_per_person": bag_wt,
                    "baggage_number_allowed_per_person": bag_num,
                    "handbag_weight_allowed_per_person": hand_wt,
                }
            )
            routes_dict[fno] = fr

        # 8. FlightLegs (10 records)
        self.stdout.write("Seeding Flight Legs...")
        now = timezone.now()
        legs_info = [
            ("EK201", "DXB", "JFK", 1, 14, 0),   # 14 hours flight
            ("BA177", "LHR", "JFK", 1, 8, 0),    # 8 hours
            ("AI101", "DEL", "JFK", 1, 15, 30),  # 15.5 hours
            ("SQ026", "SIN", "JFK", 1, 18, 0),   # 18 hours
            ("JL006", "HND", "JFK", 1, 13, 0),   # 13 hours
            ("LH400", "FRA", "JFK", 1, 8, 30),   # 8.5 hours
            ("AF006", "CDG", "JFK", 1, 8, 15),   # 8.25 hours
            ("AA100", "JFK", "LHR", 1, 7, 0),    # 7 hours
            ("QF001", "SYD", "LHR", 1, 22, 0),   # 22 hours
            ("6E055", "BOM", "DXB", 1, 3, 30),   # 3.5 hours
        ]
        for idx, (fno, dep_code, arr_code, leg_order, hrs, mins) in enumerate(legs_info):
            dep_time = now + timedelta(days=idx + 1, hours=8)
            arr_time = dep_time + timedelta(hours=hrs, minutes=mins)
            FlightLeg.objects.get_or_create(
                flight=routes_dict[fno],
                leg_order=leg_order,
                defaults={
                    "departure_airport": airports_dict[dep_code],
                    "arrival_airport": airports_dict[arr_code],
                    "scheduled_departure": dep_time,
                    "scheduled_arrival": arr_time,
                }
            )

        # 9. Legacy Flight Model (10 records - heavily relied on by legacy endpoints & UI)
        self.stdout.write("Seeding Legacy Flights...")
        legacy_flights_data = [
            ("EK201", "Emirates", "Airbus A380-800", "DXB", "JFK", 45000.00, 300, 285, 1, 14),
            ("BA177", "British Airways", "Boeing 787-9 Dreamliner", "LHR", "JFK", 38000.00, 250, 230, 2, 8),
            ("AI101", "Air India", "Boeing 777-300ER", "DEL", "JFK", 52000.00, 340, 310, 2, 15),
            ("SQ026", "Singapore Airlines", "Airbus A350-900", "SIN", "JFK", 68000.00, 280, 260, 3, 18),
            ("JL006", "Japan Airlines", "Boeing 787-9 Dreamliner", "HND", "JFK", 62000.00, 230, 215, 3, 13),
            ("LH400", "Lufthansa", "Airbus A350-900", "FRA", "JFK", 41000.00, 290, 275, 4, 8),
            ("AF006", "Air France", "Airbus A350-900", "CDG", "JFK", 43000.00, 310, 290, 4, 8),
            ("AA100", "American Airlines", "Boeing 777-300ER", "JFK", "LHR", 39000.00, 270, 245, 5, 7),
            ("QF001", "Qantas Airways", "Boeing 787-9 Dreamliner", "SYD", "LHR", 89000.00, 300, 280, 5, 22),
            ("6E055", "IndiGo Airlines", "Airbus A320neo", "BOM", "DXB", 15000.00, 180, 165, 6, 3),
        ]
        legacy_flights_list = []
        for fno, airline, ac, src, dst, fare, tot, avail, day_offset, duration_h in legacy_flights_data:
            dep_t = now + timedelta(days=day_offset, hours=9)
            arr_t = dep_t + timedelta(hours=duration_h)
            fl, _ = Flight.objects.get_or_create(
                flight_number=fno,
                defaults={
                    "airline": airline,
                    "aircraft": ac,
                    "source_airport": src,
                    "destination_airport": dst,
                    "departure_time": dep_t,
                    "arrival_time": arr_t,
                    "base_fare": fare,
                    "total_seats": tot,
                    "available_seats": avail,
                    "status": FlightStatus.SCHEDULED,
                    "stops": [],
                }
            )
            legacy_flights_list.append(fl)

        # 10. FlightInstance (10 records)
        self.stdout.write("Seeding Flight Instances...")
        instances_data = [
            ("EK201", "A6-EEO", 1, 14),
            ("BA177", "G-ZBLB", 2, 8),
            ("AI101", "VT-ALN", 2, 15),
            ("SQ026", "9V-SNA", 3, 18),
            ("JL006", "JA873A", 3, 13),
            ("LH400", "D-AIXA", 4, 8),
            ("AF006", "F-HTYA", 4, 8),
            ("AA100", "N777AA", 5, 7),
            ("QF001", "VH-ZNA", 5, 22),
            ("6E055", "VT-IZI", 6, 3),
        ]
        flight_instances_list = []
        for fno, reg, day_offset, dur in instances_data:
            dep_t = now + timedelta(days=day_offset, hours=9)
            arr_t = dep_t + timedelta(hours=dur)
            inst, _ = FlightInstance.objects.get_or_create(
                flight=routes_dict[fno],
                date=dep_t.date(),
                defaults={
                    "aircraft": aircraft_dict[reg],
                    "status": InstanceStatus.SCHEDULED,
                    "scheduled_departure": dep_t,
                    "scheduled_arrival": arr_t,
                    "checkin_open": dep_t - timedelta(hours=24),
                    "boarding_time": dep_t - timedelta(minutes=45),
                    "boarding_gate": f"B{random.randint(1, 30)}",
                    "departure_terminal": "T1",
                    "arrival_terminal": "T3",
                }
            )
            flight_instances_list.append(inst)

        # 11. Seats (10+ realistic seats per instance)
        self.stdout.write("Seeding Seats...")
        seat_templates = [
            ("1A", CabinClass.FIRST, SeatPosition.WINDOW, SeatStatus.AVAILABLE, False, 5000),
            ("1B", CabinClass.FIRST, SeatPosition.AISLE, SeatStatus.BOOKED, False, 5000),
            ("4A", CabinClass.BUSINESS, SeatPosition.WINDOW, SeatStatus.AVAILABLE, False, 2500),
            ("4B", CabinClass.BUSINESS, SeatPosition.AISLE, SeatStatus.AVAILABLE, False, 2500),
            ("12A", CabinClass.ECONOMY, SeatPosition.WINDOW, SeatStatus.AVAILABLE, False, 0),
            ("12B", CabinClass.ECONOMY, SeatPosition.MIDDLE, SeatStatus.AVAILABLE, False, 0),
            ("12C", CabinClass.ECONOMY, SeatPosition.AISLE, SeatStatus.BOOKED, False, 0),
            ("14A", CabinClass.ECONOMY, SeatPosition.WINDOW, SeatStatus.AVAILABLE, True, 800),
            ("14B", CabinClass.ECONOMY, SeatPosition.MIDDLE, SeatStatus.AVAILABLE, True, 800),
            ("25F", CabinClass.ECONOMY, SeatPosition.WINDOW, SeatStatus.AVAILABLE, False, 0),
        ]
        for inst in flight_instances_list:
            for s_num, s_cls, pos, st, exit_r, fee in seat_templates:
                Seat.objects.get_or_create(
                    flight_instance=inst,
                    seat_number=s_num,
                    defaults={
                        "seat_class": s_cls,
                        "position": pos,
                        "status": st,
                        "exit_row": exit_r,
                        "seat_fee": fee,
                        "currency": "INR",
                    }
                )

        # 12. Fares (10+ fare options across instances)
        self.stdout.write("Seeding Fares...")
        for inst in flight_instances_list:
            Fare.objects.get_or_create(
                flight_instance=inst,
                cabin_class=CabinClass.ECONOMY,
                defaults={
                    "fare_code": "ECO-SAVER",
                    "price": 12500.00,
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
                    "fare_code": "BIZ-FLEX",
                    "price": 45000.00,
                    "currency": "INR",
                    "available_seats": 30,
                    "refund_type": RefundType.REFUNDABLE,
                    "change_fee": 0.00,
                    "meal_included": True,
                    "baggage_allowance": 40.0,
                }
            )

        # 13. Food Items (10 records)
        self.stdout.write("Seeding Food Items...")
        food_items_data = [
            ("EK", "Mediterranean Hummus & Pita Wrap", 450.00, True, True, True),
            ("BA", "Grilled Atlantic Salmon with Asparagus", 1200.00, False, False, False),
            ("AA", "Gourmet Beef Tenderloin with Red Wine Reduction", 1400.00, False, False, False),
            ("AI", "Butter Chicken with Jeera Rice & Naan", 650.00, False, True, False),
            ("AI", "Paneer Tikka Masala Deluxe Thali", 550.00, True, True, False),
            ("SQ", "Vegan Thai Green Curry with Jasmine Rice", 750.00, True, True, True),
            ("JL", "Traditional Japanese Bento Box - Teriyaki Salmon", 1100.00, False, False, False),
            ("LH", "Artisanal Cheese & Fresh Fruit Platter", 800.00, True, False, False),
            ("AF", "French Croissant & Berry Preserve Breakfast", 500.00, True, False, False),
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

        # 14. Flight Meals & 15. Flight Meal Items (10+ records)
        self.stdout.write("Seeding Flight Meals & Meal Items...")
        for idx, inst in enumerate(flight_instances_list):
            fm, _ = FlightMeal.objects.get_or_create(
                flight_instance=inst,
                name=f"Standard Service Menu - {inst.flight.flight_no}",
            )
            food_sample = food_items_list[idx % len(food_items_list)]
            FlightMealItem.objects.get_or_create(
                flight_meal=fm,
                food_item=food_sample,
                defaults={"quantity": 2}
            )

        # 16. Bookings (10 records)
        self.stdout.write("Seeding Bookings & Passengers...")
        passenger_names = [
            ("John Doe", 32, "M", "+1 555-0123"),
            ("Jane Doe", 29, "F", "+1 555-0124"),
            ("Alexander Wright", 45, "M", "+44 20 7946 0912"),
            ("Priya Sharma", 27, "F", "+91 98765 43210"),
            ("Rahul Verma", 34, "M", "+91 98765 12345"),
            ("Sophia Martinez", 24, "F", "+1 555-0188"),
            ("Liam O'Connor", 38, "M", "+353 1 496 0123"),
            ("Yuki Tanaka", 31, "F", "+81 3 1234 5678"),
            ("Fatima Al-Mansoor", 29, "F", "+971 4 123 4567"),
            ("David Smith", 50, "M", "+1 555-0195"),
        ]

        bookings_list = []
        for i in range(10):
            flight_obj = legacy_flights_list[i % len(legacy_flights_list)]
            user_obj = customer_user if i % 2 == 0 else admin_user
            b_status = BookingStatus.CONFIRMED if i != 3 else BookingStatus.CANCELLED
            
            b, _ = Booking.objects.get_or_create(
                id=f"10000000-0000-0000-0000-00000000000{i}",
                defaults={
                    "user": user_obj,
                    "flight": flight_obj,
                    "status": b_status,
                    "seat_count": 1,
                    "total_price": flight_obj.base_fare,
                }
            )
            bookings_list.append(b)

            # 17. Passengers (10 records connected to bookings)
            p_name, p_age, p_gender, p_phone = passenger_names[i]
            Passenger.objects.get_or_create(
                booking=b,
                name=p_name,
                defaults={
                    "age": p_age,
                    "gender": p_gender,
                    "phone_number": p_phone,
                }
            )

        # 18. Waitlist Entries & 19. Waitlist Passengers (10 records)
        self.stdout.write("Seeding Waitlist Entries & Passengers...")
        waitlist_passengers_data = [
            ("Carlos Ray", 40, "M", "+1 555-0177"),
            ("Elena Rostova", 28, "F", "+7 495 123 4567"),
            ("Tariq Mansour", 33, "M", "+971 50 987 6543"),
            ("Aisha Patel", 26, "F", "+91 91234 56789"),
            ("Michael Brown", 48, "M", "+1 555-0144"),
            ("Emma Watson", 30, "F", "+44 20 7123 4567"),
            ("Kenji Sato", 36, "M", "+81 90 1234 5678"),
            ("Chloe Dubois", 25, "F", "+33 1 42 68 55 55"),
            ("Hans Mueller", 52, "M", "+49 30 123456"),
            ("Amara Okafor", 29, "F", "+234 1 234 5678"),
        ]

        wl_statuses = [
            WaitlistStatus.PENDING, WaitlistStatus.PENDING,
            WaitlistStatus.CONFIRMED, WaitlistStatus.PENDING,
            WaitlistStatus.EXPIRED, WaitlistStatus.PENDING,
            WaitlistStatus.CANCELLED, WaitlistStatus.PENDING,
            WaitlistStatus.PENDING, WaitlistStatus.CONFIRMED,
        ]

        for i in range(10):
            flight_obj = legacy_flights_list[(i + 2) % len(legacy_flights_list)]
            user_obj = customer_user if i % 2 == 0 else admin_user
            
            wl_entry, _ = WaitlistEntry.objects.get_or_create(
                id=f"20000000-0000-0000-0000-00000000000{i}",
                defaults={
                    "user": user_obj,
                    "flight": flight_obj,
                    "seat_count": 1,
                    "price": flight_obj.base_fare,
                    "status": wl_statuses[i],
                    "booking": bookings_list[i] if wl_statuses[i] == WaitlistStatus.CONFIRMED else None,
                }
            )

            p_name, p_age, p_gender, p_phone = waitlist_passengers_data[i]
            WaitlistPassenger.objects.get_or_create(
                waitlist_entry=wl_entry,
                name=p_name,
                defaults={
                    "age": p_age,
                    "gender": p_gender,
                    "phone_number": p_phone,
                }
            )

        # 20. Notifications (10 records)
        self.stdout.write("Seeding Notifications...")
        notifications_data = [
            ("Booking Confirmed", "Your reservation for flight EK201 from Dubai (DXB) to New York (JFK) is confirmed.", NotificationType.BOOKING_CONFIRMED, True),
            ("Flight Boarding Alert", "Boarding has commenced for flight BA177 at Gate B12 in Terminal 5.", NotificationType.FLIGHT_BOARDING, False),
            ("Flight Delay Update", "Flight AI101 to New York (JFK) is delayed by 35 minutes due to air traffic control.", NotificationType.FLIGHT_DELAYED, False),
            ("Waitlist Promotion Available", "Great news! A seat has opened up for your waitlisted flight SQ026.", NotificationType.WAITLIST_ALLOCATED, False),
            ("Flight Departed", "Flight JL006 has departed Tokyo Haneda (HND) on schedule.", NotificationType.FLIGHT_DEPARTED, True),
            ("Flight Arrived", "Flight LH400 has safely landed at New York JFK Airport.", NotificationType.FLIGHT_ARRIVED, True),
            ("Booking Cancellation", "Your booking for flight AF006 has been successfully cancelled as requested.", NotificationType.BOOKING_CANCELLED, True),
            ("Baggage & Seat Reminder", "Check-in is now open for flight AA100. Select your preferred seat and meals.", NotificationType.BOOKING_CONFIRMED, False),
            ("Flight Status Notification", "Flight QF001 from Sydney to London is operating on time today.", NotificationType.FLIGHT_BOARDING, False),
            ("Schedule Change Notice", "Flight 6E055 departure gate assigned to Gate T1-14 at Mumbai BOM Airport.", NotificationType.FLIGHT_DELAYED, True),
        ]

        for i, (title, msg, n_type, is_r) in enumerate(notifications_data):
            user_obj = customer_user if i % 2 == 0 else admin_user
            Notification.objects.get_or_create(
                user=user_obj,
                title=title,
                message=msg,
                notification_type=n_type,
                defaults={"is_read": is_r}
            )

        self.stdout.write(self.style.SUCCESS("Successfully seeded database with real-world mock data for all tables!"))
