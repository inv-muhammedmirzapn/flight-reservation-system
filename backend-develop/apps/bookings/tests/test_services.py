import unittest
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from django.db import DatabaseError

from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, Seat, Fare,
    InstanceStatus, CabinClass, SeatStatus
)
from apps.bookings.models import Booking, BookingStatus, Passenger
from apps.bookings.services import create_booking, cancel_booking

User = get_user_model()


class BookingServicesTests(TestCase):
    def setUp(self):
        # Create standard user
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="password"
        )
        
        # Create master data
        self.country = Country.objects.create(name="United States", iso_code="USA")
        self.airport_dep = Airport.objects.create(
            airport_name="John F. Kennedy International Airport",
            iata_code="JFK",
            city="New York",
            country=self.country
        )
        self.airport_arr = Airport.objects.create(
            airport_name="Los Angeles International Airport",
            iata_code="LAX",
            city="Los Angeles",
            country=self.country
        )
        self.airline = Airline.objects.create(
            airline_name="Delta Air Lines", iata_airline_code="DL"
        )
        self.aircraft_model = AircraftModel.objects.create(
            manufacturer="Airbus", model_name="A320"
        )
        self.aircraft = Aircraft.objects.create(
            registration="N101DL",
            aircraft_model=self.aircraft_model,
            airline=self.airline,
            economy_capacity=10,
            business_capacity=2,
            first_class_capacity=0
        )
        
        # Create route and legs
        self.route = FlightRoute.objects.create(
            airline=self.airline,
            flight_no="DL101"
        )
        self.dep_time = timezone.now() + timedelta(days=2)
        self.arr_time = self.dep_time + timedelta(hours=6)
        self.leg = FlightLeg.objects.create(
            flight=self.route,
            leg_order=1,
            departure_airport=self.airport_dep,
            arrival_airport=self.airport_arr,
            scheduled_departure=self.dep_time,
            scheduled_arrival=self.arr_time
        )
        
        # Create FlightInstance
        self.flight_instance = FlightInstance.objects.create(
            flight=self.route,
            aircraft=self.aircraft,
            date=self.dep_time.date(),
            scheduled_departure=self.dep_time,
            scheduled_arrival=self.arr_time,
            status=InstanceStatus.SCHEDULED
        )
        
        # Create Fares
        self.fare_eco = Fare.objects.create(
            flight_instance=self.flight_instance,
            fare_code="ECO-BASE",
            cabin_class=CabinClass.ECONOMY,
            price=Decimal("500.00"),
            available_seats=10
        )
        self.fare_biz = Fare.objects.create(
            flight_instance=self.flight_instance,
            fare_code="BIZ-BASE",
            cabin_class=CabinClass.BUSINESS,
            price=Decimal("1200.00"),
            available_seats=2
        )
        
        # Generate seats manually for simplicity
        self.seats_eco = []
        for i in range(1, 11):
            seat = Seat.objects.create(
                flight_instance=self.flight_instance,
                seat_number=f"{i}A",
                seat_class=CabinClass.ECONOMY,
                status=SeatStatus.AVAILABLE
            )
            self.seats_eco.append(seat)
            
        self.seats_biz = []
        for i in range(1, 3):
            seat = Seat.objects.create(
                flight_instance=self.flight_instance,
                seat_number=f"{i}B",
                seat_class=CabinClass.BUSINESS,
                status=SeatStatus.AVAILABLE
            )
            self.seats_biz.append(seat)
            
        self.passengers_data = [
            {"name": "John Doe", "age": 30, "gender": "M", "phone_number": "1234567890"}
        ]

    def test_create_booking_success_economy(self):
        booking = create_booking(
            flight_id=self.flight_instance.id,
            user=self.user,
            passengers_data=self.passengers_data,
            cabin_class=CabinClass.ECONOMY
        )
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        self.assertEqual(booking.seat_count, 1)
        self.assertEqual(booking.total_price, Decimal("500.00"))
        
        # Check passenger created
        passenger = Passenger.objects.get(booking=booking)
        self.assertEqual(passenger.name, "John Doe")
        
        # Check seat status updated using the actual assigned seat
        assigned_seat_number = passenger.seat_number
        seat = Seat.objects.get(flight_instance=self.flight_instance, seat_number=assigned_seat_number)
        self.assertEqual(seat.status, SeatStatus.BOOKED)

    def test_create_booking_success_no_class_specified(self):
        # If no class specified, it defaults to booking available seats
        booking = create_booking(
            flight_id=self.flight_instance.id,
            user=self.user,
            passengers_data=self.passengers_data,
            cabin_class=None
        )
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        self.assertEqual(booking.seat_count, 1)

    def test_create_booking_invalid_flight(self):
        with self.assertRaises(ValidationError) as ctx:
            create_booking(flight_id=99999, user=self.user, passengers_data=self.passengers_data)
        self.assertIn("Flight not found", str(ctx.exception))

    def test_create_booking_flight_cancelled(self):
        self.flight_instance.status = InstanceStatus.CANCELLED
        self.flight_instance.save()
        with self.assertRaises(ValidationError) as ctx:
            create_booking(
                flight_id=self.flight_instance.id,
                user=self.user,
                passengers_data=self.passengers_data,
                cabin_class=CabinClass.ECONOMY
            )
        self.assertIn("Cannot book a flight that is already cancelled", str(ctx.exception))

    def test_create_booking_flight_departed(self):
        self.flight_instance.scheduled_departure = timezone.now() - timedelta(hours=1)
        self.flight_instance.save()
        with self.assertRaises(ValidationError) as ctx:
            create_booking(
                flight_id=self.flight_instance.id,
                user=self.user,
                passengers_data=self.passengers_data,
                cabin_class=CabinClass.ECONOMY
            )
        self.assertIn("Cannot book a flight that has already departed", str(ctx.exception))

    def test_create_booking_insufficient_seats_class(self):
        # Requesting 3 business class seats when only 2 are available
        pax = [
            {"name": "P1", "age": 20, "gender": "M"},
            {"name": "P2", "age": 21, "gender": "F"},
            {"name": "P3", "age": 22, "gender": "O"}
        ]
        with self.assertRaises(ValidationError) as ctx:
            create_booking(
                flight_id=self.flight_instance.id,
                user=self.user,
                passengers_data=pax,
                cabin_class=CabinClass.BUSINESS
            )
        self.assertIn("Only 2 business seat(s) available", str(ctx.exception))

    def test_create_booking_insufficient_seats_general(self):
        # Mark all seats as booked
        Seat.objects.filter(flight_instance=self.flight_instance).update(status=SeatStatus.BOOKED)
        
        with self.assertRaises(ValidationError) as ctx:
            create_booking(
                flight_id=self.flight_instance.id,
                user=self.user,
                passengers_data=self.passengers_data,
                cabin_class=None
            )
        self.assertIn("Only 0 seats available on this flight", str(ctx.exception))

    def test_create_booking_duplicate_booking(self):
        create_booking(
            flight_id=self.flight_instance.id,
            user=self.user,
            passengers_data=self.passengers_data,
            cabin_class=CabinClass.ECONOMY
        )
        with self.assertRaises(ValidationError) as ctx:
            create_booking(
                flight_id=self.flight_instance.id,
                user=self.user,
                passengers_data=self.passengers_data,
                cabin_class=CabinClass.ECONOMY
            )
        self.assertIn("already have a confirmed booking", str(ctx.exception))

    def test_create_booking_passenger_validation_name_short(self):
        invalid_pax = [{"name": "A", "age": 25, "gender": "M"}]
        with self.assertRaises(ValidationError) as ctx:
            create_booking(
                flight_id=self.flight_instance.id,
                user=self.user,
                passengers_data=invalid_pax,
                cabin_class=CabinClass.ECONOMY
            )
        self.assertIn("Passenger name must be at least 2 characters", str(ctx.exception))

    def test_create_booking_passenger_validation_age_out_of_bounds(self):
        invalid_pax = [{"name": "Jane", "age": 150, "gender": "F"}]
        with self.assertRaises(ValidationError) as ctx:
            create_booking(
                flight_id=self.flight_instance.id,
                user=self.user,
                passengers_data=invalid_pax,
                cabin_class=CabinClass.ECONOMY
            )
        self.assertIn("Passenger age must be between 1 and 120", str(ctx.exception))

    def test_create_booking_passenger_validation_gender_invalid(self):
        invalid_pax = [{"name": "Jane", "age": 30, "gender": "X"}]
        with self.assertRaises(ValidationError) as ctx:
            create_booking(
                flight_id=self.flight_instance.id,
                user=self.user,
                passengers_data=invalid_pax,
                cabin_class=CabinClass.ECONOMY
            )
        self.assertIn("Gender must be 'M', 'F', or 'O'", str(ctx.exception))

    def test_cancel_booking_success(self):
        booking = create_booking(
            flight_id=self.flight_instance.id,
            user=self.user,
            passengers_data=self.passengers_data,
            cabin_class=CabinClass.ECONOMY
        )
        self.fare_eco.refresh_from_db()
        self.assertEqual(self.fare_eco.available_seats, 9)
        
        # Get assigned seat before cancellation
        passenger = Passenger.objects.get(booking=booking)
        assigned_seat_number = passenger.seat_number

        # Cancel booking
        cancelled = cancel_booking(booking_id=booking.id, user=self.user)
        self.assertEqual(cancelled.status, BookingStatus.CANCELLED)
        
        # Verify seat status is freed
        seat = Seat.objects.get(flight_instance=self.flight_instance, seat_number=assigned_seat_number)
        self.assertEqual(seat.status, SeatStatus.AVAILABLE)
        
        # Verify Fare available seats restored
        self.fare_eco.refresh_from_db()
        self.assertEqual(self.fare_eco.available_seats, 10)

    def test_cancel_booking_not_found(self):
        import uuid
        with self.assertRaises(ValidationError) as ctx:
            cancel_booking(booking_id=uuid.uuid4(), user=self.user)
        self.assertIn("Booking not found", str(ctx.exception))

    def test_cancel_booking_unauthorized(self):
        other_user = User.objects.create_user(
            username="other", email="other@test.com", password="password"
        )
        booking = create_booking(
            flight_id=self.flight_instance.id,
            user=self.user,
            passengers_data=self.passengers_data,
            cabin_class=CabinClass.ECONOMY
        )
        with self.assertRaises(ValidationError) as ctx:
            cancel_booking(booking_id=booking.id, user=other_user)
        self.assertIn("Booking not found", str(ctx.exception))

    def test_cancel_booking_already_cancelled(self):
        booking = create_booking(
            flight_id=self.flight_instance.id,
            user=self.user,
            passengers_data=self.passengers_data,
            cabin_class=CabinClass.ECONOMY
        )
        cancel_booking(booking_id=booking.id, user=self.user)
        with self.assertRaises(ValidationError) as ctx:
            cancel_booking(booking_id=booking.id, user=self.user)
        self.assertIn("Booking is already cancelled", str(ctx.exception))

    @patch("apps.flights.models.FlightInstance.objects.select_for_update")
    def test_create_booking_database_lock_failure_recovery(self, mock_select_for_update):
        # Simulate DatabaseError during select_for_update to test the recovery path
        mock_select_for_update.return_value.get.side_effect = DatabaseError("Lock timeout")
        
        # Creating booking should fall back to standard get() and succeed
        booking = create_booking(
            flight_id=self.flight_instance.id,
            user=self.user,
            passengers_data=self.passengers_data,
            cabin_class=CabinClass.ECONOMY
        )
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        self.assertEqual(booking.seat_count, 1)
