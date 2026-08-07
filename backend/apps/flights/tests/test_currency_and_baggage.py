from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.flights.models import (
    Airline, FlightRoute, FlightInstance, Fare, FoodItem, FlightMeal
)
from apps.flights.services_currency import CurrencyService
from apps.users.models import Profile
from apps.bookings.services import create_booking

User = get_user_model()


class CurrencyServiceTests(TestCase):
    def setUp(self):
        self.user_in = User.objects.create_user(email="user_in@example.com", password="Password123!")
        Profile.objects.filter(user=self.user_in).update(country="India")

        self.user_us = User.objects.create_user(email="user_us@example.com", password="Password123!")
        Profile.objects.filter(user=self.user_us).update(country="United States")

        self.user_uk = User.objects.create_user(email="user_uk@example.com", password="Password123!")
        Profile.objects.filter(user=self.user_uk).update(country="United Kingdom")

    def test_get_user_currency(self):
        self.assertEqual(CurrencyService.get_user_currency(self.user_in), "INR")
        self.assertEqual(CurrencyService.get_user_currency(self.user_us), "USD")
        self.assertEqual(CurrencyService.get_user_currency(self.user_uk), "GBP")
        self.assertEqual(CurrencyService.get_user_currency(None), "USD")

    def test_convert_amount(self):
        # 100 USD to INR (rate 83.50)
        converted = CurrencyService.convert_amount(100, "USD", "INR")
        self.assertEqual(converted, Decimal("8350.00"))

        # Same currency
        self.assertEqual(CurrencyService.convert_amount(50, "INR", "INR"), Decimal("50.00"))


class MealsAndBaggageApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="testpax@example.com", password="Password123!")
        Profile.objects.filter(user=self.user).update(country="Germany")

        self.airline = Airline.objects.create(name="Lufthansa", iata_code="LH")
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
            scheduled_departure="2026-09-01T10:00:00Z",
            scheduled_arrival="2026-09-01T18:00:00Z",
        )
        self.fare = Fare.objects.create(
            flight_instance=self.instance,
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
        url = f"/api/flights/instances/{self.instance.id}/meals/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

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
        # Booking total: 15000 base fare + 5000 extra baggage = 20000 INR
        self.assertEqual(booking.total_price, Decimal("20000.00"))
