from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model

from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, Seat, Fare
)

User = get_user_model()

class FlightV2APITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create an admin user for API requests
        self.admin_user = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='password123',
            first_name='Admin',
            last_name='User'
        )
        self.client.force_authenticate(user=self.admin_user)

        # 1. Master Data
        self.country = Country.objects.create(
            name="India", iso_code="IND"
        )
        self.airport1 = Airport.objects.create(
            airport_name="Indira Gandhi International Airport", iata_code="DEL",
            city="New Delhi", country=self.country
        )
        self.airport2 = Airport.objects.create(
            airport_name="Chhatrapati Shivaji Maharaj International Airport", iata_code="BOM",
            city="Mumbai", country=self.country
        )
        self.airline = Airline.objects.create(
            airline_name="Air India", iata_airline_code="AI"
        )
        self.aircraft_model = AircraftModel.objects.create(
            manufacturer="Boeing", model_name="737-800"
        )
        self.aircraft = Aircraft.objects.create(
            registration="VT-ABC",
            aircraft_model=self.aircraft_model,
            airline=self.airline,
            economy_capacity=168,
            business_capacity=12,
            first_class_capacity=0
        )

        # 2. Flight Route
        self.route = FlightRoute.objects.create(
            airline=self.airline,
            flight_no="AI101"
        )
        self.departure_time = timezone.now() + timedelta(days=2)
        self.arrival_time = self.departure_time + timedelta(hours=2)
        self.leg = FlightLeg.objects.create(
            flight=self.route,
            leg_order=1,
            departure_airport=self.airport1,
            arrival_airport=self.airport2,
            scheduled_departure=self.departure_time,
            scheduled_arrival=self.arrival_time
        )

        # 3. Flight Instance
        self.instance = FlightInstance.objects.create(
            flight=self.route,
            aircraft=self.aircraft,
            date=self.departure_time.date(),
            scheduled_departure=self.departure_time,
            scheduled_arrival=self.arrival_time,
            status="SCHEDULED"
        )

    def test_model_creation(self):
        """Test that the normalized models are created correctly."""
        self.assertEqual(Country.objects.count(), 1)
        self.assertEqual(Airport.objects.count(), 2)
        self.assertEqual(Airline.objects.count(), 1)
        self.assertEqual(AircraftModel.objects.count(), 1)
        self.assertEqual(Aircraft.objects.count(), 1)
        self.assertEqual(FlightRoute.objects.count(), 1)
        self.assertEqual(FlightLeg.objects.count(), 1)
        self.assertEqual(FlightInstance.objects.count(), 1)
        
        self.assertEqual(self.route.legs.count(), 1)
        self.assertEqual(self.route.legs.first().departure_airport.iata_code, "DEL")

    def test_api_countries_list(self):
        """Test the v2 countries API endpoint."""
        url = '/api/flights/v2/countries/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], "India")

    def test_api_flight_instance_create(self):
        """Test creating a new flight instance via the API."""
        url = '/api/flights/v2/flight-instances/'
        new_dep = timezone.now() + timedelta(days=5)
        new_arr = new_dep + timedelta(hours=2)
        
        data = {
            "flight": self.route.id,
            "aircraft": self.aircraft.id,
            "date": new_dep.date().isoformat(),
            "scheduled_departure": new_dep.isoformat(),
            "scheduled_arrival": new_arr.isoformat(),
            "boarding_gate": "G1",
            "departure_terminal": "T1",
            "arrival_terminal": "T2",
            "status": "SCHEDULED"
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(FlightInstance.objects.count(), 2)

    def test_generate_seats_action(self):
        """Test the custom generate-seats action on FlightInstanceViewSet."""
        url = f'/api/flights/v2/flight-instances/{self.instance.id}/generate-seats/'
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('generated', response.data['detail'])
        
        # Verify seats were actually created in the database
        seats_count = Seat.objects.filter(flight_instance=self.instance).count()
        # Should equal total capacity of the aircraft model (180)
        self.assertEqual(seats_count, 180)
        
        # Calling it again should return an error
        response_duplicate = self.client.post(url)
        self.assertEqual(response_duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already', response_duplicate.data['detail'])

    def test_fare_validation(self):
        """Test creating a fare via the API with validation."""
        url = '/api/flights/v2/fares/'
        data = {
            "flight_instance": self.instance.id,
            "fare_code": "ECO-BASE",
            "cabin_class": "ECONOMY",
            "price": "1500.00",
            "currency": "INR",
            "refund_type": "NON_REFUNDABLE",
            "change_fee": "500.00",
            "meal_included": False
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Fare.objects.count(), 1)
        
        # Test negative price validation
        data_invalid = data.copy()
        data_invalid["price"] = "-100.00"
        response_invalid = self.client.post(url, data_invalid, format='json')
        self.assertEqual(response_invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_fares_instance_filtering(self):
        """Test filtering fares by flight instance."""
        url = '/api/flights/v2/fares/'
        Fare.objects.create(flight_instance=self.instance, fare_code="ECO1", cabin_class="ECONOMY", price="100.00", currency="USD")
        
        # Another instance
        instance2 = FlightInstance.objects.create(
            flight=self.route, aircraft=self.aircraft, date=self.departure_time.date(),
            scheduled_departure=self.departure_time, scheduled_arrival=self.arrival_time, status="SCHEDULED"
        )
        Fare.objects.create(flight_instance=instance2, fare_code="ECO2", cabin_class="ECONOMY", price="200.00", currency="USD")
        
        response = self.client.get(f"{url}?flight_instance={self.instance.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['fare_code'], "ECO1")

    def test_seats_instance_filtering(self):
        """Test filtering seats by flight instance."""
        url = '/api/flights/v2/seats/'
        Seat.objects.create(flight_instance=self.instance, seat_number="1A", seat_class="FIRST", status="AVAILABLE")
        
        instance2 = FlightInstance.objects.create(
            flight=self.route, aircraft=self.aircraft, date=self.departure_time.date(),
            scheduled_departure=self.departure_time, scheduled_arrival=self.arrival_time, status="SCHEDULED"
        )
        Seat.objects.create(flight_instance=instance2, seat_number="1B", seat_class="FIRST", status="AVAILABLE")
        
        response = self.client.get(f"{url}?flight_instance={self.instance.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['seat_number'], "1A")

    def test_meals_airline_and_cabin_filtering(self):
        """Test filtering meals by airline and cabin class."""
        url = '/api/flights/v2/flight-meals/'
        from apps.flights.models import FlightMeal
        airline2 = Airline.objects.create(airline_name="IndiGo", iata_airline_code="6E")

        FlightMeal.objects.create(airline=self.airline, cabin_class="ECONOMY", name="Veg Meal")
        FlightMeal.objects.create(airline=airline2, cabin_class="ECONOMY", name="Non-Veg Meal")
        FlightMeal.objects.create(airline=self.airline, cabin_class="BUSINESS", name="Gourmet Meal")
        
        response = self.client.get(f"{url}?airline={self.airline.id}&cabin_class=ECONOMY")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], "Veg Meal")
