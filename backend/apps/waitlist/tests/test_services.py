from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance, Seat, Fare,
    InstanceStatus, CabinClass, SeatStatus
)
from apps.bookings.models import Booking, BookingStatus, Passenger
from apps.bookings.services import create_booking, cancel_booking
from apps.waitlist.models import WaitlistEntry, WaitlistPassenger, WaitlistStatus
from apps.waitlist.services import (
    join_waitlist, cancel_waitlist_entry, promote_waitlist_entry,
    process_waitlist_allocations, expire_departed_waitlist_entries,
    get_waitlist_passenger_count, WaitlistError
)

User = get_user_model()


class WaitlistServicesTests(TestCase):
    def setUp(self):
        # Create users
        self.customer = User.objects.create_user(
            username="customer", email="customer@test.com", password="password"
        )
        self.other_customer = User.objects.create_user(
            username="other", email="other@test.com", password="password"
        )

        # Create master data
        self.country = Country.objects.create(name="United States", iso_code="USA")
        self.airport_dep = Airport.objects.create(
            airport_name="JFK", iata_code="JFK", city="New York", country=self.country
        )
        self.airport_arr = Airport.objects.create(
            airport_name="LAX", iata_code="LAX", city="Los Angeles", country=self.country
        )
        self.airline = Airline.objects.create(
            airline_name="United Airlines", iata_airline_code="UA"
        )
        self.aircraft_model = AircraftModel.objects.create(
            manufacturer="Boeing", model_name="777"
        )
        self.aircraft = Aircraft.objects.create(
            registration="N777UA", aircraft_model=self.aircraft_model, airline=self.airline,
            economy_capacity=2, business_capacity=0, first_class_capacity=0
        )
        
        # Create route and legs
        self.route = FlightRoute.objects.create(airline=self.airline, flight_no="UA100")
        self.dep_time = timezone.now() + timedelta(days=2)
        self.arr_time = self.dep_time + timedelta(hours=6)
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
        
        # Create Economy Fare (2 seats capacity)
        self.fare_eco = Fare.objects.create(
            flight_instance=self.flight_instance, fare_code="ECO-BASE", cabin_class=CabinClass.ECONOMY,
            price=Decimal("1000.00"), available_seats=2
        )
        
        # Create 2 seats
        self.seats = []
        for i in range(1, 3):
            s = Seat.objects.create(
                flight_instance=self.flight_instance, seat_number=f"{i}A",
                seat_class=CabinClass.ECONOMY, status=SeatStatus.AVAILABLE
            )
            self.seats.append(s)

        self.passenger1_data = [{"name": "Pax One", "age": 25, "gender": "M"}]
        self.passenger2_data = [{"name": "Pax Two", "age": 30, "gender": "F"}]

    def test_join_waitlist_fails_when_seats_available(self):
        # Economy has 2 available seats, so joining waitlist should fail
        with self.assertRaises(WaitlistError) as ctx:
            join_waitlist(
                user=self.customer,
                flight_id=self.flight_instance.id,
                passengers_data=self.passenger1_data,
                cabin_class=CabinClass.ECONOMY
            )
        self.assertIn("enough available seats", str(ctx.exception))

    def test_join_waitlist_success_when_full(self):
        # Occupy all seats with bookings first
        create_booking(
            flight_id=self.flight_instance.id, user=self.other_customer,
            passengers_data=[{"name": "Occ1", "age": 22, "gender": "M"}, {"name": "Occ2", "age": 23, "gender": "F"}],
            cabin_class=CabinClass.ECONOMY
        )
        
        self.fare_eco.refresh_from_db()
        self.assertEqual(self.fare_eco.available_seats, 0)
        
        # Now joining waitlist should succeed
        entry = join_waitlist(
            user=self.customer,
            flight_id=self.flight_instance.id,
            passengers_data=self.passenger1_data,
            cabin_class=CabinClass.ECONOMY
        )
        self.assertEqual(entry.status, WaitlistStatus.PENDING)
        self.assertEqual(entry.price, Decimal("1000.00"))
        self.assertEqual(entry.passengers.count(), 1)
        self.assertEqual(entry.passengers.first().name, "Pax One")

    def test_join_waitlist_duplicate_denied(self):
        # Occupy seats
        create_booking(self.flight_instance.id, self.other_customer, [{"name": "O1", "age": 22, "gender": "M"}, {"name": "O2", "age": 23, "gender": "F"}], CabinClass.ECONOMY)
        
        join_waitlist(self.customer, self.flight_instance.id, self.passenger1_data, CabinClass.ECONOMY)
        
        with self.assertRaises(WaitlistError) as ctx:
            join_waitlist(self.customer, self.flight_instance.id, self.passenger2_data, CabinClass.ECONOMY)
        self.assertIn("already on the waitlist", str(ctx.exception))

    def test_join_waitlist_past_departure(self):
        self.flight_instance.scheduled_departure = timezone.now() - timedelta(hours=1)
        self.flight_instance.save()
        
        with self.assertRaises(WaitlistError) as ctx:
            join_waitlist(self.customer, self.flight_instance.id, self.passenger1_data, CabinClass.ECONOMY)
        self.assertIn("already departed", str(ctx.exception))

    def test_cancel_waitlist_entry_refund_calculation(self):
        # Setup: join waitlist
        create_booking(self.flight_instance.id, self.other_customer, [{"name": "O1", "age": 22, "gender": "M"}, {"name": "O2", "age": 23, "gender": "F"}], CabinClass.ECONOMY)
        entry = join_waitlist(self.customer, self.flight_instance.id, self.passenger1_data, CabinClass.ECONOMY)
        
        refund_info = cancel_waitlist_entry(entry)
        self.assertEqual(refund_info["status"], WaitlistStatus.CANCELLED)
        # Price is 1000.00. 95% refund = 950.00, 5% processing fee = 50.00
        self.assertEqual(refund_info["refund_amount"], Decimal("950.00"))
        self.assertEqual(refund_info["processing_fee"], Decimal("50.00"))

    def test_cancel_waitlist_entry_not_pending_fails(self):
        # Setup: join waitlist
        create_booking(self.flight_instance.id, self.other_customer, [{"name": "O1", "age": 22, "gender": "M"}, {"name": "O2", "age": 23, "gender": "F"}], CabinClass.ECONOMY)
        entry = join_waitlist(self.customer, self.flight_instance.id, self.passenger1_data, CabinClass.ECONOMY)
        entry.status = WaitlistStatus.CONFIRMED
        entry.save()
        
        with self.assertRaises(WaitlistError) as ctx:
            cancel_waitlist_entry(entry)
        self.assertIn("Only pending waitlist entries can be cancelled", str(ctx.exception))

    def test_promote_waitlist_entry_success(self):
        # Book flight completely
        booking_to_cancel = create_booking(self.flight_instance.id, self.other_customer, [{"name": "O1", "age": 22, "gender": "M"}, {"name": "O2", "age": 23, "gender": "F"}], CabinClass.ECONOMY)
        
        # Join waitlist
        entry = join_waitlist(self.customer, self.flight_instance.id, self.passenger1_data, CabinClass.ECONOMY)
        
        # Free up 1 seat by cancelling booking (for this test we cancel booking and we'll manually promote or auto-promote)
        # Let's free up seats manually first to isolate promote_waitlist_entry
        self.seats[0].status = SeatStatus.AVAILABLE
        self.seats[0].save()
        self.fare_eco.available_seats = 1
        self.fare_eco.save()
        
        # Promote manually
        booking = promote_waitlist_entry(entry)
        
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        self.assertEqual(booking.user, self.customer)
        self.assertEqual(booking.passengers.count(), 1)
        self.assertEqual(booking.passengers.first().name, "Pax One")
        
        entry.refresh_from_db()
        self.assertEqual(entry.status, WaitlistStatus.CONFIRMED)
        self.assertEqual(entry.booking, booking)

    def test_promote_waitlist_entry_insufficient_seats_fails(self):
        create_booking(self.flight_instance.id, self.other_customer, [{"name": "O1", "age": 22, "gender": "M"}, {"name": "O2", "age": 23, "gender": "F"}], CabinClass.ECONOMY)
        entry = join_waitlist(self.customer, self.flight_instance.id, self.passenger1_data, CabinClass.ECONOMY)
        
        # Promoting when flight is still full should fail
        with self.assertRaises(WaitlistError) as ctx:
            promote_waitlist_entry(entry)
        self.assertIn("Not enough available seats", str(ctx.exception))

    def test_auto_allocation_on_booking_cancellation(self):
        # 1. Book both economy seats
        booking = create_booking(
            flight_id=self.flight_instance.id, user=self.other_customer,
            passengers_data=[{"name": "Occ1", "age": 22, "gender": "M"}, {"name": "Occ2", "age": 23, "gender": "F"}],
            cabin_class=CabinClass.ECONOMY
        )
        
        # 2. Join waitlist
        entry = join_waitlist(
            user=self.customer,
            flight_id=self.flight_instance.id,
            passengers_data=self.passenger1_data,
            cabin_class=CabinClass.ECONOMY
        )
        
        self.assertEqual(entry.status, WaitlistStatus.PENDING)
        
        # 3. Cancel booking -> triggers waitlist auto-allocation inside cancel_booking
        # Note: cancel_booking calls process_waitlist_allocations
        cancel_booking(booking_id=booking.id, user=self.other_customer)
        
        # 4. Check that waitlist entry is now CONFIRMED and booking is created
        entry.refresh_from_db()
        self.assertEqual(entry.status, WaitlistStatus.CONFIRMED)
        self.assertIsNotNone(entry.booking)
        self.assertEqual(entry.booking.status, BookingStatus.CONFIRMED)
        self.assertEqual(entry.booking.user, self.customer)
        self.assertEqual(entry.booking.passengers.first().name, "Pax One")

    def test_expire_departed_waitlist_entries(self):
        # Setup: book seats, join waitlist
        create_booking(self.flight_instance.id, self.other_customer, [{"name": "O1", "age": 22, "gender": "M"}, {"name": "O2", "age": 23, "gender": "F"}], CabinClass.ECONOMY)
        entry = join_waitlist(self.customer, self.flight_instance.id, self.passenger1_data, CabinClass.ECONOMY)
        
        # Change flight departure to past
        self.flight_instance.scheduled_departure = timezone.now() - timedelta(minutes=5)
        self.flight_instance.save()
        
        count = expire_departed_waitlist_entries()
        self.assertEqual(count, 1)
        entry.refresh_from_db()
        self.assertEqual(entry.status, WaitlistStatus.EXPIRED)

    def test_get_waitlist_passenger_count(self):
        create_booking(self.flight_instance.id, self.other_customer, [{"name": "O1", "age": 22, "gender": "M"}, {"name": "O2", "age": 23, "gender": "F"}], CabinClass.ECONOMY)
        
        join_waitlist(self.customer, self.flight_instance.id, self.passenger1_data, CabinClass.ECONOMY)
        
        count = get_waitlist_passenger_count(self.flight_instance.id)
        self.assertEqual(count, 1)
