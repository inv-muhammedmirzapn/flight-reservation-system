from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from apps.flights.models import Flight, FlightStatus
from apps.waitlist.models import WaitlistEntry, WaitlistStatus
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

class WaitlistAPITestCase(APITestCase):
    def setUp(self):
        # Create users
        self.user1 = User.objects.create_user(
            username='user1', email='user1@example.com', password='testpassword'
        )
        self.user2 = User.objects.create_user(
            username='user2', email='user2@example.com', password='testpassword'
        )
        self.client.force_authenticate(user=self.user1)
        
        # Create full flight
        self.full_flight = Flight.objects.create(
            flight_number='FL001', airline='TestAir', aircraft='Boeing 737',
            source_airport='JFK', destination_airport='LHR',
            departure_time=timezone.now() + timedelta(days=1),
            arrival_time=timezone.now() + timedelta(days=1, hours=8),
            base_fare=500.00, total_seats=100, available_seats=0,  # Full
            status=FlightStatus.SCHEDULED
        )
        
        # Create open flight
        self.open_flight = Flight.objects.create(
            flight_number='FL002', airline='TestAir', aircraft='Boeing 737',
            source_airport='LAX', destination_airport='JFK',
            departure_time=timezone.now() + timedelta(days=2),
            arrival_time=timezone.now() + timedelta(days=2, hours=5),
            base_fare=300.00, total_seats=100, available_seats=10,  # Not full
            status=FlightStatus.SCHEDULED
        )

        self.url = reverse('waitlist:waitlist-list')

    def test_unauthenticated_access(self):
        """Ensure unauthenticated users cannot access waitlist API."""
        self.client.logout()
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        data = {'flight': self.full_flight.id}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_join_waitlist_full_flight(self):
        """Ensure we can join the waitlist if the flight is full."""
        data = {'flight': self.full_flight.id}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WaitlistEntry.objects.count(), 1)
        self.assertEqual(WaitlistEntry.objects.first().flight, self.full_flight)
        self.assertEqual(WaitlistEntry.objects.first().user, self.user1)
        self.assertEqual(WaitlistEntry.objects.first().status, WaitlistStatus.PENDING)

    def test_join_waitlist_open_flight(self):
        """Ensure we cannot join the waitlist if the flight has available seats."""
        data = {'flight': self.open_flight.id}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('flight', response.data)
        self.assertEqual(WaitlistEntry.objects.count(), 0)

    def test_join_waitlist_duplicate_pending(self):
        """Ensure we cannot join the waitlist twice for the same flight while pending."""
        WaitlistEntry.objects.create(user=self.user1, flight=self.full_flight, status=WaitlistStatus.PENDING)
        
        data = {'flight': self.full_flight.id}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('flight', response.data)
        self.assertEqual(WaitlistEntry.objects.count(), 1)

    def test_join_waitlist_after_allocation_or_cancellation(self):
        """Ensure user can join again if their previous entry was allocated or cancelled."""
        WaitlistEntry.objects.create(user=self.user1, flight=self.full_flight, status=WaitlistStatus.ALLOCATED)
        WaitlistEntry.objects.create(user=self.user1, flight=self.full_flight, status=WaitlistStatus.CANCELLED)
        
        data = {'flight': self.full_flight.id}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WaitlistEntry.objects.filter(status=WaitlistStatus.PENDING).count(), 1)
        self.assertEqual(WaitlistEntry.objects.count(), 3)

    def test_list_waitlist_is_isolated(self):
        """Ensure a user only sees their own waitlist entries."""
        WaitlistEntry.objects.create(user=self.user1, flight=self.full_flight)
        WaitlistEntry.objects.create(user=self.user2, flight=self.full_flight)
        
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['flight'], self.full_flight.id)

    def test_waitlist_fifo_ordering(self):
        """Ensure waitlist entries are returned in First-In-First-Out order."""
        # Create a few entries for user1 on different flights to check ordering
        flight2 = Flight.objects.create(
            flight_number='FL003', airline='TestAir', aircraft='Boeing 737',
            source_airport='SFO', destination_airport='JFK',
            departure_time=timezone.now() + timedelta(days=3),
            arrival_time=timezone.now() + timedelta(days=3, hours=5),
            base_fare=400.00, total_seats=100, available_seats=0, status=FlightStatus.SCHEDULED
        )
        
        # Add slight delay so joined_at differs (though auto_now_add generally guarantees sequential order)
        entry1 = WaitlistEntry.objects.create(user=self.user1, flight=self.full_flight)
        entry2 = WaitlistEntry.objects.create(user=self.user1, flight=flight2)
        
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        # Verify order
        self.assertEqual(response.data[0]['flight'], self.full_flight.id)
        self.assertEqual(response.data[1]['flight'], flight2.id)

    def test_join_waitlist_invalid_flight_id(self):
        """Ensure joining with a non-existent flight ID returns a 400 error."""
        import uuid
        data = {'flight': str(uuid.uuid4())}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('flight', response.data)

    def test_join_waitlist_missing_flight_id(self):
        """Ensure joining without providing a flight ID returns a 400 error."""
        data = {}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('flight', response.data)

    def test_retrieve_waitlist_entry(self):
        """Ensure a user can retrieve their specific waitlist entry details."""
        entry = WaitlistEntry.objects.create(user=self.user1, flight=self.full_flight)
        detail_url = reverse('waitlist:waitlist-detail', kwargs={'pk': entry.id})
        
        response = self.client.get(detail_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], str(entry.id))
        self.assertEqual(response.data['flight'], self.full_flight.id)

    def test_retrieve_other_users_waitlist_entry(self):
        """Ensure a user cannot retrieve someone else's waitlist entry."""
        entry = WaitlistEntry.objects.create(user=self.user2, flight=self.full_flight)
        detail_url = reverse('waitlist:waitlist-detail', kwargs={'pk': entry.id})
        
        response = self.client.get(detail_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_waitlist_not_allowed(self):
        """Ensure users cannot manually update a waitlist entry."""
        entry = WaitlistEntry.objects.create(user=self.user1, flight=self.full_flight)
        detail_url = reverse('waitlist:waitlist-detail', kwargs={'pk': entry.id})
        
        data = {'status': WaitlistStatus.ALLOCATED}
        response = self.client.put(detail_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        
        response = self.client.patch(detail_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_delete_waitlist_not_allowed(self):
        """Ensure users cannot delete a waitlist entry (they must cancel through specific logic if implemented)."""
        entry = WaitlistEntry.objects.create(user=self.user1, flight=self.full_flight)
        detail_url = reverse('waitlist:waitlist-detail', kwargs={'pk': entry.id})
        
        response = self.client.delete(detail_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
