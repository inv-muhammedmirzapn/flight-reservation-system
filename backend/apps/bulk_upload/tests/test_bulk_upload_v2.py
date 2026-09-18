import io
import zipfile
from decimal import Decimal
from datetime import date, time, datetime

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightInstance, FlightLeg, FoodItem, FlightMeal, FlightMealItem,
    Fare, RouteFareClass, Seat, InstanceStatus, SeatStatus
)
from apps.pricing.models import HolidayEvent
from apps.bookings.models import Booking, Passenger
from apps.bulk_upload.repositories import (
    import_airlines, import_countries, import_airports, import_aircraft_models,
    import_aircraft, import_flight_routes, import_flight_legs, import_flight_instances,
    import_route_fare_classes, import_fares, import_seats, import_food_items,
    import_flight_meals, import_flight_meal_items, import_holiday_events,
    import_bookings
)
from apps.bulk_upload.services import import_from_zip

User = get_user_model()


class BulkUploadV2Tests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="admin_test", email="admin@test.com", password="Password123"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_import_countries_and_airlines(self):
        c_rows = [{"iso_code": "IN", "name": "India"}, {"iso_code": "AE", "name": "United Arab Emirates"}]
        created, updated, errors = import_countries(c_rows)
        self.assertEqual(created, 2)
        self.assertEqual(len(errors), 0)

        a_rows = [{"iata_airline_code": "AI", "airline_name": "Air India"}]
        created, updated, errors = import_airlines(a_rows)
        self.assertEqual(created, 1)
        self.assertEqual(len(errors), 0)
        self.assertTrue(Airline.objects.filter(iata_airline_code="AI").exists())

    def test_import_airports(self):
        Country.objects.create(iso_code="IN", name="India")
        rows = [
            {
                "iata_code": "DEL",
                "airport_name": "Indira Gandhi International",
                "city": "New Delhi",
                "country_iso": "IN",
                "timezone": "Asia/Kolkata",
                "latitude": "28.5665",
                "longitude": "77.1031"
            },
            {
                "iata_code": "BOM",
                "airport_name": "Chhatrapati Shivaji Maharaj International",
                "city": "Mumbai",
                "country_iso": "IN",
                "timezone": "Asia/Kolkata",
                "latitude": "19.0896",
                "longitude": "72.8656"
            }
        ]
        created, updated, errors = import_airports(rows)
        self.assertEqual(created, 2)
        self.assertEqual(len(errors), 0)

    def test_import_aircraft_and_models(self):
        import_aircraft_models([{"manufacturer": "Boeing", "model_name": "787-8"}])
        ai, _ = Airline.objects.get_or_create(iata_airline_code="AI", defaults={"airline_name": "Air India"})

        aircraft_rows = [
            {
                "registration": "VT-ANO",
                "airline_code": "AI",
                "manufacturer": "Boeing",
                "model_name": "787-8",
                "economy_capacity": "238",
                "business_capacity": "18",
                "first_class_capacity": "0",
                "economy_layout": "3-3-3",
                "business_layout": "2-2-2",
                "first_class_layout": "2-2"
            }
        ]
        created, updated, errors = import_aircraft(aircraft_rows)
        self.assertEqual(created, 1)
        self.assertEqual(len(errors), 0)
        ac = Aircraft.objects.get(registration="VT-ANO")
        self.assertEqual(ac.economy_capacity, 238)
        self.assertEqual(ac.economy_layout, "3-3-3")

    def test_import_flight_routes_with_latest_configs(self):
        ai, _ = Airline.objects.get_or_create(iata_airline_code="AI", defaults={"airline_name": "Air India"})
        am, _ = AircraftModel.objects.get_or_create(manufacturer="Boeing", model_name="787-8")
        ac, _ = Aircraft.objects.get_or_create(
            registration="VT-ANO", defaults={"airline": ai, "aircraft_model": am, "economy_capacity": 100}
        )

        rows = [
            {
                "flight_no": "AI101",
                "airline_code": "AI",
                "operates_on_days": "1,2,3,4,5",
                "valid_from": "2026-01-01",
                "valid_until": "2026-12-31",
                "scheduled_departure_time": "06:00",
                "scheduled_arrival_time": "08:30",
                "aircraft_registration": "VT-ANO",
                "baggage_weight_allowed_per_person": "25.0",
                "handbag_weight_allowed_per_person": "8.0",
                "is_active": "true"
            }
        ]
        created, updated, errors = import_flight_routes(rows)
        self.assertEqual(created, 1)
        self.assertEqual(len(errors), 0)

        route = FlightRoute.objects.get(flight_no="AI101")
        self.assertEqual(route.operates_on_days, "1,2,3,4,5")
        self.assertEqual(route.scheduled_departure_time, time(6, 0))
        self.assertEqual(route.scheduled_arrival_time, time(8, 30))
        self.assertEqual(route.aircraft, ac)
        self.assertEqual(route.baggage_weight_allowed_per_person, Decimal("25.0"))
        self.assertTrue(route.is_active)

    def test_import_flight_legs_with_latest_configs(self):
        c, _ = Country.objects.get_or_create(iso_code="IN", defaults={"name": "India"})
        del_ap, _ = Airport.objects.get_or_create(iata_code="DEL", defaults={"airport_name": "Delhi", "city": "Delhi", "country": c})
        bom_ap, _ = Airport.objects.get_or_create(iata_code="BOM", defaults={"airport_name": "Mumbai", "city": "Mumbai", "country": c})
        ai, _ = Airline.objects.get_or_create(iata_airline_code="AI", defaults={"airline_name": "Air India"})
        route, _ = FlightRoute.objects.get_or_create(flight_no="AI101", defaults={"airline": ai})

        leg_rows = [
            {
                "flight_no": "AI101",
                "leg_order": "1",
                "departure_airport": "DEL",
                "arrival_airport": "BOM",
                "scheduled_departure_time": "06:00",
                "scheduled_arrival_time": "08:15",
                "flight_duration_minutes": "135",
                "layover_duration_minutes": "0",
                "departure_terminal": "T3",
                "arrival_terminal": "T2"
            }
        ]
        created, updated, errors = import_flight_legs(leg_rows)
        self.assertEqual(created, 1)
        self.assertEqual(len(errors), 0)

        leg = FlightLeg.objects.get(flight=route, leg_order=1)
        self.assertEqual(leg.departure_terminal, "T3")
        self.assertEqual(leg.arrival_terminal, "T2")
        self.assertEqual(leg.flight_duration_minutes, 135)
        self.assertEqual(leg.scheduled_departure_time, time(6, 0))

    def test_import_route_fare_classes(self):
        ai, _ = Airline.objects.get_or_create(iata_airline_code="AI", defaults={"airline_name": "Air India"})
        route, _ = FlightRoute.objects.get_or_create(flight_no="AI101", defaults={"airline": ai})

        rows = [
            {
                "flight_no": "AI101",
                "cabin_class": "ECONOMY",
                "fare_code": "ECO-SAVER",
                "base_price": "4500.00",
                "currency": "INR",
                "refund_type": "NON_REFUNDABLE",
                "change_fee": "500.00",
                "meal_included": "false",
                "baggage_weight_allowed_kg": "15"
            },
            {
                "flight_no": "AI101",
                "cabin_class": "BUSINESS",
                "fare_code": "BIZ-FLEX",
                "base_price": "12000.00",
                "currency": "INR",
                "refund_type": "REFUNDABLE",
                "change_fee": "0.00",
                "meal_included": "true",
                "baggage_weight_allowed_kg": "30"
            }
        ]
        created, updated, errors = import_route_fare_classes(rows)
        self.assertEqual(created, 2)
        self.assertEqual(len(errors), 0)
        self.assertEqual(RouteFareClass.objects.filter(route=route).count(), 2)

    def test_import_flight_instances_with_auto_generation(self):
        ai, _ = Airline.objects.get_or_create(iata_airline_code="AI", defaults={"airline_name": "Air India"})
        am, _ = AircraftModel.objects.get_or_create(manufacturer="Boeing", model_name="787-8")
        ac, _ = Aircraft.objects.get_or_create(
            registration="VT-ANO", defaults={"airline": ai, "aircraft_model": am, "economy_capacity": 10}
        )
        route, _ = FlightRoute.objects.get_or_create(flight_no="AI101", defaults={"airline": ai, "aircraft": ac})
        # Add base fare class so generate_fares_for_instance can create fares
        RouteFareClass.objects.create(
            route=route, cabin_class="ECONOMY", fare_code="ECO-STD", base_price=Decimal("5000.00")
        )

        rows = [
            {
                "flight_no": "AI101",
                "date": "2026-10-01",
                "aircraft_registration": "VT-ANO",
                "status": "SCHEDULED",
                "scheduled_departure": "2026-10-01 06:00",
                "scheduled_arrival": "2026-10-01 08:30",
                "departure_terminal": "T3",
                "arrival_terminal": "T2",
                "boarding_gate": "42A",
                "delay_minutes": "0"
            }
        ]
        created, updated, errors = import_flight_instances(rows)
        self.assertEqual(created, 1)
        self.assertEqual(len(errors), 0)

        instance = FlightInstance.objects.get(flight=route, date=date(2026, 10, 1))
        self.assertEqual(instance.departure_terminal, "T3")
        self.assertEqual(instance.boarding_gate, "42A")
        # Seats and fares should have been automatically generated!
        self.assertTrue(instance.seats.count() > 0)
        self.assertTrue(instance.fares.count() > 0)

    def test_import_fares_with_baggage_overrides(self):
        ai, _ = Airline.objects.get_or_create(iata_airline_code="AI", defaults={"airline_name": "Air India"})
        am, _ = AircraftModel.objects.get_or_create(manufacturer="Boeing", model_name="787-8")
        ac, _ = Aircraft.objects.get_or_create(
            registration="VT-ANO", defaults={"airline": ai, "aircraft_model": am, "economy_capacity": 10}
        )
        route, _ = FlightRoute.objects.get_or_create(flight_no="AI101", defaults={"airline": ai, "aircraft": ac})
        from django.utils import timezone
        inst, _ = FlightInstance.objects.get_or_create(
            flight=route, date=date(2026, 10, 1),
            defaults={
                "aircraft": ac, "status": "SCHEDULED",
                "scheduled_departure": timezone.make_aware(datetime(2026, 10, 1, 6, 0)),
                "scheduled_arrival": timezone.make_aware(datetime(2026, 10, 1, 8, 30))
            }
        )

        fare_rows = [
            {
                "flight_no": "AI101",
                "date": "2026-10-01",
                "fare_code": "ECO-OVERRIDE",
                "cabin_class": "ECONOMY",
                "price": "6000.00",
                "currency": "INR",
                "available_seats": "40",
                "refund_type": "PARTIAL",
                "change_fee": "250.00",
                "meal_included": "true",
                "baggage_allowance": "35.0",
                "handbag_allowance": "10.0",
                "baggage_pieces_allowance": "2"
            }
        ]
        created, updated, errors = import_fares(fare_rows)
        self.assertEqual(created, 1)
        self.assertEqual(len(errors), 0)

        fare = Fare.objects.get(flight_instance=inst, fare_code="ECO-OVERRIDE")
        self.assertEqual(fare.baggage_allowance, Decimal("35.0"))
        self.assertEqual(fare.handbag_allowance, Decimal("10.0"))
        self.assertEqual(fare.baggage_pieces_allowance, 2)

    def test_import_meals_and_items(self):
        ai, _ = Airline.objects.get_or_create(iata_airline_code="AI", defaults={"airline_name": "Air India"})

        # 1. Food item
        food_rows = [{"airline_code": "AI", "name": "Croissant", "price": "150.00", "is_veg": "true"}]
        created, updated, errors = import_food_items(food_rows)
        self.assertEqual(created, 1)

        # 2. Flight meal (airline + cabin_class + meal_name)
        meal_rows = [{"airline_code": "AI", "cabin_class": "ECONOMY", "meal_name": "Continental Breakfast", "price": "200.00"}]
        created, updated, errors = import_flight_meals(meal_rows)
        self.assertEqual(created, 1)
        self.assertEqual(len(errors), 0)

        # 3. Flight meal item link
        link_rows = [{
            "airline_code": "AI", "cabin_class": "ECONOMY",
            "meal_name": "Continental Breakfast", "food_item_name": "Croissant", "quantity": "2"
        }]
        created, updated, errors = import_flight_meal_items(link_rows)
        self.assertEqual(created, 1)
        self.assertEqual(len(errors), 0)
        self.assertEqual(FlightMealItem.objects.count(), 1)

    def test_import_holiday_events(self):
        rows = [
            {
                "name": "Diwali Festival 2026",
                "start_date": "2026-11-01",
                "end_date": "2026-11-10",
                "surge_multiplier": "1.35",
                "is_global": "false",
                "applicable_countries": "India, Nepal",
                "is_active": "true"
            }
        ]
        created, updated, errors = import_holiday_events(rows)
        self.assertEqual(created, 1)
        self.assertEqual(len(errors), 0)

        h = HolidayEvent.objects.get(name="Diwali Festival 2026")
        self.assertEqual(h.surge_multiplier, Decimal("1.35"))
        self.assertIn("India", h.applicable_countries)

    def test_bulk_import_api_single_entity(self):
        csv_content = "iata_airline_code,airline_name\n6E,IndiGo\nUK,Vistara\n"
        uploaded_file = SimpleUploadedFile("airlines.csv", csv_content.encode("utf-8"), content_type="text/csv")

        response = self.client.post("/api/bulk-upload/import/", {"entity": "airlines", "file": uploaded_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data["total"], 2)
        self.assertEqual(data["created"], 2)
        self.assertEqual(data["failed"], 0)

    def test_bulk_import_zip_all(self):
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as zf:
            zf.writestr("countries.csv", "iso_code,name\nSG,Singapore\nMY,Malaysia\n")
            zf.writestr("airlines.csv", "iata_airline_code,airline_name\nSQ,Singapore Airlines\nMH,Malaysia Airlines\n")
        zip_buffer.seek(0)

        uploaded_zip = SimpleUploadedFile("archive.zip", zip_buffer.getvalue(), content_type="application/zip")
        response = self.client.post("/api/bulk-upload/import/", {"entity": "all", "file": uploaded_zip}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data["entity"], "all")
        self.assertEqual(data["total"], 4)
        self.assertEqual(data["created"], 4)
        self.assertEqual(data["failed"], 0)

    def test_import_bookings(self):
        ai = Airline.objects.create(iata_airline_code="AI", airline_name="Air India")
        am = AircraftModel.objects.create(manufacturer="Airbus", model_name="A320")
        ac = Aircraft.objects.create(registration="VT-BOK", airline=ai, aircraft_model=am, economy_capacity=100)
        route = FlightRoute.objects.create(flight_no="AI999", airline=ai, aircraft=ac)
        instance = FlightInstance.objects.create(
            flight=route, date=date(2026, 11, 1), aircraft=ac,
            scheduled_departure=datetime(2026, 11, 1, 6, 0),
            scheduled_arrival=datetime(2026, 11, 1, 8, 0)
        )
        seat = Seat.objects.create(flight_instance=instance, seat_number="15A", seat_class="ECONOMY", status=SeatStatus.AVAILABLE)

        rows = [
            {
                "user_email": "admin@test.com",
                "flight_no": "AI999",
                "date": "2026-11-01",
                "cabin_class": "ECONOMY",
                "seat_count": "1",
                "total_price": "4500.00",
                "status": "CONFIRMED",
                "passenger_name": "Rohan Verma",
                "passenger_age": "28",
                "passenger_gender": "M",
                "seat_number": "15A"
            }
        ]

        created, updated, errors = import_bookings(rows)
        self.assertEqual(created, 1)
        self.assertEqual(len(errors), 0)

        booking = Booking.objects.get(flight=instance, user=self.admin)
        self.assertEqual(str(booking.total_price), "4500.00")
        self.assertEqual(booking.status, "CONFIRMED")

        passenger = Passenger.objects.get(booking=booking)
        self.assertEqual(passenger.name, "Rohan Verma")
        self.assertEqual(passenger.seat_number, "15A")

        seat.refresh_from_db()
        self.assertEqual(seat.status, SeatStatus.BOOKED)


