from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, Seat, Fare,
    InstanceStatus, CabinClass, SeatStatus
)
from apps.bookings.models import Booking, BookingStatus, Passenger

User = get_user_model()


class BookingViewSetTests(APITestCase):
    def setUp(self):
        # Create users
        self.customer1 = User.objects.create_user(
            username="customer1", email="c1@example.com", password="password123"
        )
        self.customer2 = User.objects.create_user(
            username="customer2", email="c2@example.com", password="password123"
        )
        self.admin_user = User.objects.create_superuser(
            username="admin", email="admin@example.com", password="password123"
        )
        # Ensure profile role for admin is ADMIN
        self.admin_user.profile.role = "ADMIN"
        self.admin_user.profile.save()

        # Create master data
        self.country = Country.objects.create(name="India", iso_code="IND")
        self.airport_dep = Airport.objects.create(
            airport_name="Indira Gandhi International Airport", iata_code="DEL",
            city="New Delhi", country=self.country
        )
        self.airport_arr = Airport.objects.create(
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
            registration="VT-AI1",
            aircraft_model=self.aircraft_model,
            airline=self.airline,
            economy_capacity=10,
            business_capacity=0,
            first_class_capacity=0
        )
        
        # Create route and legs
        self.route = FlightRoute.objects.create(airline=self.airline, flight_no="AI101")
        self.dep_time = timezone.now() + timedelta(days=2)
        self.arr_time = self.dep_time + timedelta(hours=2)
        self.leg = FlightLeg.objects.create(
            flight=self.route, leg_order=1,
            departure_airport=self.airport_dep, arrival_airport=self.airport_arr,
            scheduled_departure=self.dep_time, scheduled_arrival=self.arr_time
        )
        
        # Create FlightInstance
        self.flight_instance = FlightInstance.objects.create(
            flight=self.route, aircraft=self.aircraft, date=self.dep_time.date(),
            scheduled_departure=self.dep_time, scheduled_arrival=self.arr_time,
            status=InstanceStatus.SCHEDULED
        )
        
        # Create Fare
        self.fare = Fare.objects.create(
            flight_instance=self.flight_instance, fare_code="ECO", cabin_class=CabinClass.ECONOMY,
            price=Decimal("4000.00"), available_seats=10
        )
        
        # Create seats
        self.seats = []
        for i in range(1, 11):
            s = Seat.objects.create(
                flight_instance=self.flight_instance, seat_number=f"{i}A",
                seat_class=CabinClass.ECONOMY, status=SeatStatus.AVAILABLE
            )
            self.seats.append(s)

        # Create some bookings
        # Customer 1 booking
        self.booking_c1 = Booking.objects.create(
            user=self.customer1, flight=self.flight_instance, cabin_class=CabinClass.ECONOMY,
            seat_count=1, total_price=Decimal("4000.00"), status=BookingStatus.CONFIRMED
        )
        s1 = self.seats[0]
        s1.status = SeatStatus.BOOKED
        s1.save()
        Passenger.objects.create(
            booking=self.booking_c1, name="Pax One", age=30, gender="M", seat_number="1A"
        )
        self.fare.available_seats = 9
        self.fare.save()

        # Customer 2 booking
        self.booking_c2 = Booking.objects.create(
            user=self.customer2, flight=self.flight_instance, cabin_class=CabinClass.ECONOMY,
            seat_count=1, total_price=Decimal("4000.00"), status=BookingStatus.CONFIRMED
        )
        s2 = self.seats[1]
        s2.status = SeatStatus.BOOKED
        s2.save()
        Passenger.objects.create(
            booking=self.booking_c2, name="Pax Two", age=25, gender="F", seat_number="2A"
        )
        self.fare.available_seats = 8
        self.fare.save()

        self.list_url = reverse("bookings:booking-list")

    def test_customer_list_only_own_bookings(self):
        self.client.force_authenticate(user=self.customer1)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verify pagination structure exists and returns only 1 result
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(self.booking_c1.id))

    def test_admin_list_all_bookings(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)

    def test_customer_retrieve_own_booking(self):
        self.client.force_authenticate(user=self.customer1)
        url = reverse("bookings:booking-detail", kwargs={"pk": self.booking_c1.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], str(self.booking_c1.id))

    def test_customer_retrieve_other_booking_fails(self):
        # A user trying to retrieve another user's booking should get 404 (or 403, depending on queryset structure, view has filter(user=user))
        self.client.force_authenticate(user=self.customer1)
        url = reverse("bookings:booking-detail", kwargs={"pk": self.booking_c2.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_booking_api_success(self):
        customer3 = User.objects.create_user(
            username="customer3", email="c3@example.com", password="password123"
        )
        self.client.force_authenticate(user=customer3)
        payload = {
            "flight": self.flight_instance.id,
            "cabin_class": "ECONOMY",
            "passengers": [
                {"name": "Alice Bob", "age": 28, "gender": "F", "phone_number": "99998888"}
            ]
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "CONFIRMED")
        self.assertEqual(response.data["seat_count"], 1)
        
        # Verify seats
        self.assertEqual(Seat.objects.filter(flight_instance=self.flight_instance, status=SeatStatus.BOOKED).count(), 3)

    def test_create_booking_api_validation_errors(self):
        self.client.force_authenticate(user=self.customer1)
        # Missing flight
        payload = {
            "cabin_class": "ECONOMY",
            "passengers": [{"name": "Test", "age": 20, "gender": "M"}]
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("flight field is required", response.data["message"])

        # Empty passenger list
        payload = {
            "flight": self.flight_instance.id,
            "passengers": []
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("At least one passenger is required", response.data["message"])

    def test_cancel_booking_api_success(self):
        self.client.force_authenticate(user=self.customer1)
        url = reverse("bookings:booking-cancel", kwargs={"pk": self.booking_c1.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], BookingStatus.CANCELLED)

    def test_passenger_list_restrictions(self):
        # Customer lists passengers
        self.client.force_authenticate(user=self.customer1)
        passenger_list_url = reverse("bookings:passenger-list")
        response = self.client.get(passenger_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Customer 1 has 1 passenger (Pax One)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Pax One")

        # Admin lists passengers
        self.client.force_authenticate(user=self.admin_user)
        response_admin = self.client.get(passenger_list_url)
        self.assertEqual(response_admin.status_code, status.HTTP_200_OK)
        # Admin gets all 2 passengers
        results_admin = response_admin.data.get("results", response_admin.data)
        self.assertEqual(len(results_admin), 2)
