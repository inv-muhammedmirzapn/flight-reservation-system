from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.urls import reverse
from apps.notifications.models import Notification, NotificationType

User = get_user_model()

class NotificationAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='password123',
            first_name='Test'
        )
        self.client.force_authenticate(user=self.user)
        self.notif1 = Notification.objects.create(
            user=self.user,
            title='Notification 1',
            message='Message 1',
            notification_type=NotificationType.BOOKING_CONFIRMED,
            is_read=False
        )
        self.notif2 = Notification.objects.create(
            user=self.user,
            title='Notification 2',
            message='Message 2',
            notification_type=NotificationType.BOOKING_CANCELLED,
            is_read=False
        )

    def test_list_notifications(self):
        url = reverse('notification-list')
        response = self.client.get(url)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        self.assertEqual(len(results), 2)
        
    def test_mark_as_read(self):
        url = reverse('notification-read', args=[self.notif1.id])
        response = self.client.patch(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.notif1.refresh_from_db()
        self.assertTrue(self.notif1.is_read)
        self.assertFalse(self.notif2.is_read)

    def test_mark_all_read(self):
        url = reverse('notification-mark-all-read')
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.notif1.refresh_from_db()
        self.notif2.refresh_from_db()
        self.assertTrue(self.notif1.is_read)
        self.assertTrue(self.notif2.is_read)
