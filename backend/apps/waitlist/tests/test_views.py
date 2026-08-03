from datetime import timedelta
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.flights.models import Flight, FlightStatus
from apps.bookings.models import Booking, BookingStatus
from apps.waitlist.models import WaitlistEntry, WaitlistStatus

User = get_user_model()


class WaitlistTests(TestCase):
    def setUp(self):
        # Create users
        self.customer_a = User.objects.create_user(
            username="customer_a",
            email="customer_a@example.com",
            password="password",
        )
        self.customer_b = User.objects.create_user(
            username="customer_b",
            email="customer_b@example.com",
            password="password",
        )
        self.admin_user = User.objects.create_user(
            username="admin_user",
            email="admin@example.com",
            password="password",
        )
        # Setup admin profile role
        from apps.users.models import Profile
        profile, _ = Profile.objects.get_or_create(user=self.admin_user)
        profile.role = Profile.Role.ADMIN
        profile.save()
        self.admin_user = User.objects.get(pk=self.admin_user.pk)

        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.customer_a)

        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.customer_b)

        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin_user)

        self.client_anon = APIClient()

        # Create flight
        self.flight = Flight.objects.create(
            flight_number="FL999",
            airline="Waitlist Airline",
            aircraft="Airbus A320",
            source_airport="JFK",
            destination_airport="LAX",
            departure_time=timezone.now() + timedelta(days=1),
            arrival_time=timezone.now() + timedelta(days=1, hours=6),
            base_fare=100.00,
            total_seats=10,
            available_seats=10,
            status=FlightStatus.SCHEDULED,
        )

    def test_join_waitlist_when_seats_available(self):
        # Flight has 10 available seats. Attempting to join waitlist should fail.
        url = reverse("waitlist-join")
        data = {"flight": str(self.flight.id), "passengers": [{"name": "Alice", "age": 20, "gender": "M"}]}
        response = self.client_a.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["message"],
            "Waitlist tickets cannot be booked on the flight as there are enough available seats",
        )

    def test_join_waitlist_success(self):
        # Make flight full
        self.flight.available_seats = 0
        self.flight.save()

        url = reverse("waitlist-join")
        data = {"flight": str(self.flight.id), "passengers": [{"name": "Alice", "age": 20, "gender": "M"}, {"name": "Bob", "age": 22, "gender": "F"}]}
        response = self.client_a.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Check waitlist entry
        entry = WaitlistEntry.objects.get(id=response.data["id"])
        self.assertEqual(entry.user, self.customer_a)
        self.assertEqual(entry.flight, self.flight)
        self.assertEqual(entry.seat_count, 2)
        self.assertEqual(entry.price, 200.00)  # base_fare 100 * 2 seats
        self.assertEqual(entry.status, WaitlistStatus.PENDING)

    def test_join_waitlist_duplicate(self):
        self.flight.available_seats = 0
        self.flight.save()

        # Join waitlist once
        WaitlistEntry.objects.create(
            user=self.customer_a,
            flight=self.flight,
            seat_count=1,
            price=100.00,
            status=WaitlistStatus.PENDING,
        )

        url = reverse("waitlist-join")
        data = {"flight": str(self.flight.id), "passengers": [{"name": "Alice", "age": 20, "gender": "M"}]}
        response = self.client_a.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["message"],
            "You are already on the waitlist for this flight",
        )

    def test_join_waitlist_invalid_seat_count(self):
        self.flight.available_seats = 0
        self.flight.save()

        url = reverse("waitlist-join")

        # Exceeds max seats of 9
        passengers_10 = [{"name": "Alice", "age": 20, "gender": "M"}] * 10
        response = self.client_a.post(url, {"flight": str(self.flight.id), "passengers": passengers_10}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Zero seat count
        response = self.client_a.post(url, {"flight": str(self.flight.id), "passengers": []}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Missing passenger data
        response = self.client_a.post(url, {"flight": str(self.flight.id), "passengers": [{}]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_join_waitlist_flight_departed(self):
        self.flight.available_seats = 0
        self.flight.departure_time = timezone.now() - timedelta(hours=1)
        self.flight.save()

        url = reverse("waitlist-join")
        data = {"flight": str(self.flight.id), "passengers": [{"name": "Alice", "age": 20, "gender": "M"}]}
        response = self.client_a.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["message"],
            "Cannot join the waitlist for a flight that has already departed.",
        )

    def test_list_waitlist_entries_customer_vs_admin(self):
        self.flight.available_seats = 0
        self.flight.save()

        # Create entries
        entry_a = WaitlistEntry.objects.create(
            user=self.customer_a,
            flight=self.flight,
            seat_count=1,
            price=100.00,
            status=WaitlistStatus.PENDING,
        )
        entry_b = WaitlistEntry.objects.create(
            user=self.customer_b,
            flight=self.flight,
            seat_count=2,
            price=200.00,
            status=WaitlistStatus.PENDING,
        )

        url = reverse("waitlist-list")

        # Customer A list
        response = self.client_a.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], str(entry_a.id))

        # Admin list (sees all)
        response = self.client_admin.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

        # Anon list (denied)
        response = self.client_anon.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_waitlist_order_by_latest(self):
        self.flight.available_seats = 0
        self.flight.save()

        entry_old = WaitlistEntry.objects.create(
            user=self.customer_a,
            flight=self.flight,
            seat_count=1,
            price=100.00,
            status=WaitlistStatus.PENDING,
        )
        entry_old.created_at = timezone.now() - timedelta(seconds=10)
        entry_old.save()

        entry_new = WaitlistEntry.objects.create(
            user=self.customer_a,
            flight=self.flight,
            seat_count=2,
            price=200.00,
            status=WaitlistStatus.PENDING,
        )
        entry_new.created_at = timezone.now()
        entry_new.save()

        url = reverse("waitlist-list")
        response = self.client_a.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        # Latest should be first
        self.assertEqual(response.data[0]["id"], str(entry_new.id))
        self.assertEqual(response.data[1]["id"], str(entry_old.id))

    def test_waitlist_detail_and_queue_position(self):
        self.flight.available_seats = 0
        self.flight.save()

        entry_a = WaitlistEntry.objects.create(
            user=self.customer_a,
            flight=self.flight,
            seat_count=1,
            price=100.00,
            status=WaitlistStatus.PENDING,
        )
        # Artificially delay creation slightly to ensure ordering
        timezone_now = timezone.now()
        entry_b = WaitlistEntry.objects.create(
            user=self.customer_b,
            flight=self.flight,
            seat_count=2,
            price=200.00,
            status=WaitlistStatus.PENDING,
        )
        entry_b.created_at = timezone_now + timedelta(seconds=1)
        entry_b.save()

        # Detail for customer A
        url_a = reverse("waitlist-detail", kwargs={"pk": entry_a.id})
        response = self.client_a.get(url_a)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["queue_position"], 1)

        # Detail for customer B
        url_b = reverse("waitlist-detail", kwargs={"pk": entry_b.id})
        response = self.client_b.get(url_b)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["queue_position"], 2)

        # Customer A trying to view B's detail should fail
        response = self.client_a.get(url_b)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Admin viewing B's detail should succeed
        response = self.client_admin.get(url_b)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["queue_position"], 2)

    def test_cancel_waitlist_entry(self):
        self.flight.available_seats = 0
        self.flight.save()

        entry = WaitlistEntry.objects.create(
            user=self.customer_a,
            flight=self.flight,
            seat_count=2,
            price=200.00,
            status=WaitlistStatus.PENDING,
        )

        url = reverse("waitlist-cancel", kwargs={"pk": entry.id})
        response = self.client_a.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify response contains refund calculations (95% refund)
        # Original price = 200.00. Processing fee 5% = 10.00. Refund = 190.00.
        self.assertEqual(float(response.data["refund_amount"]), 190.00)
        self.assertEqual(float(response.data["processing_fee"]), 10.00)
        self.assertEqual(response.data["message"], "Waitlist entry cancelled. A 95% refund of ₹190.00 has been processed (after a 5% processing fee of ₹10.00).")

        entry.refresh_from_db()
        self.assertEqual(entry.status, WaitlistStatus.CANCELLED)

        # Cancel again should fail
        response = self.client_a.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["message"], "Only pending waitlist entries can be cancelled.")

    def test_public_waitlist_flight_count(self):
        self.flight.available_seats = 0
        self.flight.save()

        WaitlistEntry.objects.create(
            user=self.customer_a,
            flight=self.flight,
            seat_count=2,
            price=200.00,
            status=WaitlistStatus.PENDING,
        )
        WaitlistEntry.objects.create(
            user=self.customer_b,
            flight=self.flight,
            seat_count=3,
            price=300.00,
            status=WaitlistStatus.PENDING,
        )

        url = reverse("waitlist-flight-count", kwargs={"flight_id": self.flight.id})
        response = self.client_anon.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Total seats waitlisted = 2 + 3 = 5
        self.assertEqual(response.data["waitlist_count"], 5)

    def test_waitlist_flight_departure_expiration(self):
        self.flight.available_seats = 0
        self.flight.save()

        entry = WaitlistEntry.objects.create(
            user=self.customer_a,
            flight=self.flight,
            seat_count=1,
            price=100.00,
            status=WaitlistStatus.PENDING,
        )

        # Move departure time to the past
        self.flight.departure_time = timezone.now() - timedelta(hours=1)
        self.flight.save()

        # Retrieve detail - should return status EXPIRED
        url = reverse("waitlist-detail", kwargs={"pk": entry.id})
        response = self.client_a.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], WaitlistStatus.EXPIRED)

        # Verify database updated
        entry.refresh_from_db()
        self.assertEqual(entry.status, WaitlistStatus.EXPIRED)

    def test_auto_allocation_on_booking_cancellation(self):
        # 1. Setup flight with 0 available seats
        self.flight.available_seats = 0
        self.flight.save()

        # 2. User A has a booking for 2 seats
        booking_a = Booking.objects.create(
            user=self.customer_a,
            flight=self.flight,
            seat_count=2,
            total_price=200.00,
            status=BookingStatus.CONFIRMED,
        )

        # 3. User B joins waitlist for 2 seats
        entry_b = WaitlistEntry.objects.create(
            user=self.customer_b,
            flight=self.flight,
            seat_count=2,
            price=200.00,
            status=WaitlistStatus.PENDING,
        )

        # 4. Cancel A's booking using API view action
        url = reverse("bookings:booking-cancel", kwargs={"pk": booking_a.pk})
        response = self.client_a.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 5. Verify B is promoted to CONFIRMED booking
        booking_a.refresh_from_db()
        self.assertEqual(booking_a.status, BookingStatus.CANCELLED)

        # Waitlist entry for B should be confirmed and linked to a new booking
        entry_b.refresh_from_db()
        self.assertEqual(entry_b.status, WaitlistStatus.CONFIRMED)
        self.assertIsNotNone(entry_b.booking)
        self.assertEqual(entry_b.booking.user, self.customer_b)
        self.assertEqual(entry_b.booking.seat_count, 2)
        self.assertEqual(entry_b.booking.status, BookingStatus.CONFIRMED)

        # Flight available seats should still be 0 (since the 2 freed seats went immediately to B)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 0)

    def test_auto_allocation_insufficient_seats_skipped(self):
        # 1. Setup flight with 0 available seats
        self.flight.available_seats = 0
        self.flight.save()

        # 2. User A has booking for 2 seats
        booking_a = Booking.objects.create(
            user=self.customer_a,
            flight=self.flight,
            seat_count=2,
            total_price=200.00,
            status=BookingStatus.CONFIRMED,
        )

        # 3. User B joins waitlist for 3 seats (needs more than 2)
        entry_b = WaitlistEntry.objects.create(
            user=self.customer_b,
            flight=self.flight,
            seat_count=3,
            price=300.00,
            status=WaitlistStatus.PENDING,
        )

        # 4. User A joins waitlist for 1 seat (needs 1)
        # Note: we need to use a different user to prevent duplicate waitlist check
        user_c = User.objects.create_user(username="customer_c", password="password")
        entry_c = WaitlistEntry.objects.create(
            user=user_c,
            flight=self.flight,
            seat_count=1,
            price=100.00,
            status=WaitlistStatus.PENDING,
        )

        # 5. Cancel A's booking (frees 2 seats)
        url = reverse("bookings:booking-cancel", kwargs={"pk": booking_a.pk})
        response = self.client_a.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # B needs 3, so B cannot be confirmed. B remains PENDING.
        entry_b.refresh_from_db()
        self.assertEqual(entry_b.status, WaitlistStatus.PENDING)

        # C needs 1, which fits in 2. C should be CONFIRMED.
        entry_c.refresh_from_db()
        self.assertEqual(entry_c.status, WaitlistStatus.CONFIRMED)
        self.assertIsNotNone(entry_c.booking)
        self.assertEqual(entry_c.booking.user, user_c)
        self.assertEqual(entry_c.booking.seat_count, 1)

        # Available seats goes to 1 (2 freed - 1 allocated to C)
        self.flight.refresh_from_db()
        self.assertEqual(self.flight.available_seats, 1)
