import datetime
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.flights.models import (
    Airline, FlightRoute, FlightInstance, Fare, FoodItem, FlightMeal, AircraftModel, Aircraft, Seat
)
from apps.flights.services_currency import CurrencyService
from apps.users.models import Profile
from apps.bookings.services import create_booking

User = get_user_model()


class CurrencyServiceTests(TestCase):
    def setUp(self):
        self.user_in = User.objects.create_user(username="user_in@example.com", email="user_in@example.com", password="Password123!")
        self.user_in.profile.country = "India"
        self.user_in.profile.save()

        self.user_us = User.objects.create_user(username="user_us@example.com", email="user_us@example.com", password="Password123!")
        self.user_us.profile.country = "United States"
        self.user_us.profile.save()

        self.user_uk = User.objects.create_user(username="user_uk@example.com", email="user_uk@example.com", password="Password123!")
        self.user_uk.profile.country = "United Kingdom"
        self.user_uk.profile.save()

    def test_get_user_currency(self):
        self.assertEqual(CurrencyService.get_user_currency(self.user_in), "INR")
        self.assertEqual(CurrencyService.get_user_currency(self.user_us), "USD")
        self.assertEqual(CurrencyService.get_user_currency(self.user_uk), "GBP")
        self.assertEqual(CurrencyService.get_user_currency(None), "INR")

    def test_convert_amount(self):
        # 100 USD to INR (rate 83.50)
        converted = CurrencyService.convert_amount(100, "USD", "INR")
        self.assertEqual(converted, Decimal("8350.00"))

        # Same currency
        self.assertEqual(CurrencyService.convert_amount(50, "INR", "INR"), Decimal("50.00"))


class MealsAndBaggageApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testpax@example.com", email="testpax@example.com", password="Password123!")
        self.user.profile.country = "Germany"
        self.user.profile.save()

        self.airline = Airline.objects.create(airline_name="Lufthansa", iata_airline_code="LH")
        self.ac_model = AircraftModel.objects.create(manufacturer="Airbus", model_name="A350")
        self.aircraft = Aircraft.objects.create(registration="D-AIXA", airline=self.airline, aircraft_model=self.ac_model, economy_capacity=250)
        self.route = FlightRoute.objects.create(
            airline=self.airline,
            flight_no="LH400",
            baggage_weight_allowed_per_person=Decimal("23.00"),
            handbag_weight_allowed_per_person=Decimal("8.00"),
            max_extra_baggage_kg_per_person=Decimal("15.00"),
            extra_baggage_price_per_kg=Decimal("1000.00"),
            extra_baggage_currency="INR",
        )
        self.instance = FlightInstance.objects.create(
            flight=self.route,
            date=datetime.date(2026, 9, 1),
            aircraft=self.aircraft,
            scheduled_departure="2026-09-01T10:00:00Z",
            scheduled_arrival="2026-09-01T18:00:00Z",
        )
        Seat.objects.create(flight_instance=self.instance, seat_number="1A", seat_class="ECONOMY", status="AVAILABLE")

        self.fare = Fare.objects.create(
            flight_instance=self.instance,
            fare_code="LH_ECO",
            cabin_class="ECONOMY",
            price=Decimal("15000.00"),
            currency="INR",
            meal_included=True,
            baggage_allowance=Decimal("25.00"),
        )
        self.food_item = FoodItem.objects.create(
            airline=self.airline,
            name="Vegetable Pasta",
            price=Decimal("500.00"),
            currency="INR",
            is_veg=True,
        )

    def test_meals_api_response_with_currency_and_baggage(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/flights/{self.instance.id}/meals/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=f"Response failed: {response.content}")
        res_json = response.json()
        data = res_json.get("data", res_json)

        self.assertEqual(data["target_currency"], "EUR")
        self.assertTrue(data["meal_included"])

        # Check food items converted price
        item = data["food_items"][0]
        self.assertEqual(item["name"], "Vegetable Pasta")
        self.assertEqual(item["display_currency"], "EUR")

        # Check baggage info
        baggage = data["baggage_info"]
        self.assertEqual(baggage["cabin_baggage_kg"], 25.0)
        self.assertEqual(baggage["handbag_kg"], 8.0)
        self.assertEqual(baggage["max_extra_baggage_kg_per_person"], 15.0)
        self.assertEqual(baggage["display_currency"], "EUR")

    def test_extra_baggage_booking_calculation(self):
        passengers_data = [
            {
                "name": "John Doe",
                "age": 30,
                "gender": "M",
                "extra_baggage_kg": 5,
            }
        ]
        booking = create_booking(
            flight_id=self.instance.id,
            user=self.user,
            passengers_data=passengers_data,
            cabin_class="ECONOMY"
        )

        pax = booking.passengers.first()
        self.assertEqual(pax.extra_baggage_kg, Decimal("5.00"))
        # Extra cost: 5 kg * 1000 INR = 5000 INR
        self.assertEqual(pax.extra_baggage_cost, Decimal("5000.00"))
        # Booking total: 15000 base fare + 5000 extra baggage = 20000 INR + 12% GST = 22400.00 INR
        self.assertEqual(booking.total_price, Decimal("22400.00"))
