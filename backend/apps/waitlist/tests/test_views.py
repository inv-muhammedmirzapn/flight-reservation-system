from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, Seat, Fare,
    InstanceStatus, CabinClass, SeatStatus
)
from apps.bookings.models import Booking, BookingStatus
from apps.bookings.services import create_booking
from apps.waitlist.models import WaitlistEntry, WaitlistStatus

User = get_user_model()


class WaitlistViewSetTests(APITestCase):
    def setUp(self):
        # Create users
        self.customer1 = User.objects.create_user(
            username="customer1", email="c1@example.com", password="password"
        )
        self.customer2 = User.objects.create_user(
            username="customer2", email="c2@example.com", password="password"
        )
        self.admin_user = User.objects.create_superuser(
            username="admin", email="admin@example.com", password="password"
        )
        self.admin_user.profile.role = "ADMIN"
        self.admin_user.profile.save()

        # Create master data
        self.country = Country.objects.create(name="India", iso_code="IND")
        self.airport_dep = Airport.objects.create(
            airport_name="DEL", iata_code="DEL", city="New Delhi", country=self.country
        )
        self.airport_arr = Airport.objects.create(
            airport_name="BOM", iata_code="BOM", city="Mumbai", country=self.country
        )
        self.airline = Airline.objects.create(
            airline_name="Air India", iata_airline_code="AI"
        )
        self.aircraft_model = AircraftModel.objects.create(
            manufacturer="Boeing", model_name="737"
        )
        self.aircraft = Aircraft.objects.create(
            registration="VT-AI1", aircraft_model=self.aircraft_model, airline=self.airline,
            economy_capacity=1, business_capacity=0, first_class_capacity=0
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
        
        # Create Economy Fare (1 seat capacity)
        self.fare_eco = Fare.objects.create(
            flight_instance=self.flight_instance, fare_code="ECO", cabin_class=CabinClass.ECONOMY,
            price=Decimal("1500.00"), available_seats=1
        )
        
        # Create 1 seat
        self.seat = Seat.objects.create(
            flight_instance=self.flight_instance, seat_number="1A",
            seat_class=CabinClass.ECONOMY, status=SeatStatus.AVAILABLE
        )

        # Occupy the flight instance completely so waitlisting is allowed
        self.booking_c1 = create_booking(
            flight_id=self.flight_instance.id, user=self.customer1,
            passengers_data=[{"name": "Pax One", "age": 28, "gender": "M"}],
            cabin_class=CabinClass.ECONOMY
        )

        # Create waitlist entry for customer 2
        self.waitlist_entry = WaitlistEntry.objects.create(
            user=self.customer2, flight=self.flight_instance, cabin_class=CabinClass.ECONOMY,
            seat_count=1, price=Decimal("1500.00"), status=WaitlistStatus.PENDING
        )

        # URLs
        self.join_url = reverse("waitlist-join")
        self.list_url = reverse("waitlist-list")

    def test_join_waitlist_api_success(self):
        # customer2 is already on the waitlist, customer1 can join waitlist after cancelling booking
        self.booking_c1.status = BookingStatus.CANCELLED
        self.booking_c1.save()
        self.seat.status = SeatStatus.AVAILABLE
        self.seat.save()
        self.fare_eco.available_seats = 1
        self.fare_eco.save()
        
        # Join waitlist for customer 1 fails because seat is now available (rule validation)
        self.client.force_authenticate(user=self.customer1)
        payload = {
            "flight": self.flight_instance.id,
            "cabin_class": "ECONOMY",
            "passengers": [{"name": "Pax C1", "age": 30, "gender": "M"}]
        }
        response = self.client.post(self.join_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Re-fill the seat to allow waitlisting
        self.seat.status = SeatStatus.BOOKED
        self.seat.save()
        self.fare_eco.available_seats = 0
        self.fare_eco.save()

        # Try joining again when full
        response = self.client.post(self.join_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "PENDING")

    def test_list_waitlist_entries_customer(self):
        self.client.force_authenticate(user=self.customer2)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # customer2 has 1 entry
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], str(self.waitlist_entry.id))

        # customer1 has no entries
        self.client.force_authenticate(user=self.customer1)
        response2 = self.client.get(self.list_url)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response2.data), 0)

    def test_list_waitlist_entries_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_retrieve_waitlist_entry_permissions(self):
        detail_url = reverse("waitlist-detail", kwargs={"pk": self.waitlist_entry.id})
        
        # customer2 owner can retrieve
        self.client.force_authenticate(user=self.customer2)
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # customer1 non-owner gets 403 Forbidden
        self.client.force_authenticate(user=self.customer1)
        response2 = self.client.get(detail_url)
        self.assertEqual(response2.status_code, status.HTTP_403_FORBIDDEN)

    def test_cancel_waitlist_entry_api_success(self):
        cancel_url = reverse("waitlist-cancel", kwargs={"pk": self.waitlist_entry.id})
        self.client.force_authenticate(user=self.customer2)
        response = self.client.post(cancel_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Waitlist entry cancelled", response.data["message"])
        self.assertEqual(Decimal(response.data["refund_amount"]), Decimal("1425.00")) # 95% of 1500.00
        self.assertEqual(Decimal(response.data["processing_fee"]), Decimal("75.00")) # 5% of 1500.00

    def test_promote_waitlist_entry_admin_only(self):
        promote_url = reverse("waitlist-promote", kwargs={"pk": self.waitlist_entry.id})
        
        # customer2 cannot promote (forbidden)
        self.client.force_authenticate(user=self.customer2)
        response = self.client.post(promote_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # admin can promote (first free the seat so promotion succeeds)
        self.seat.status = SeatStatus.AVAILABLE
        self.seat.save()
        self.fare_eco.available_seats = 1
        self.fare_eco.save()

        self.client.force_authenticate(user=self.admin_user)
        response2 = self.client.post(promote_url)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertIn("promoted to confirmed booking", response2.data["message"])

    def test_get_waitlist_passenger_count_api(self):
        count_url = reverse("waitlist-flight-count", kwargs={"flight_id": self.flight_instance.id})
        # Unauthenticated request (AllowAny)
        response = self.client.get(count_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["waitlist_count"], 1)
