from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase


class ChangePasswordAPITests(APITestCase):
    def setUp(self):
        self.register_url = "/api/auth/register/"
        self.login_url = "/api/auth/login/"
        self.change_password_url = "/api/auth/change-password/"
        
        self.user_data = {
            "username": "testuser",
            "password": "TestPassword123!",
            "email": "testuser@example.com",
            "first_name": "Test",
            "last_name": "User"
        }
        
        # Register and login to get access token
        self.client.post(self.register_url, self.user_data, format="json")
        login_response = self.client.post(self.login_url, {
            "username": "testuser",
            "password": "TestPassword123!"
        }, format="json")
        self.access_token = login_response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access_token}")

    def test_change_password_success(self):
        payload = {
            "old_password": "TestPassword123!",
            "new_password": "NewTestPassword123!"
        }
        response = self.client.post(self.change_password_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify the user can login with the new password
        login_response = self.client.post(self.login_url, {
            "username": "testuser",
            "password": "NewTestPassword123!"
        }, format="json")
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

    def test_change_password_wrong_old(self):
        payload = {
            "old_password": "WrongPassword123!",
            "new_password": "NewTestPassword123!"
        }
        response = self.client.post(self.change_password_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["message"], "Invalid credentials.")
        
        # Verify old password still works
        login_response = self.client.post(self.login_url, {
            "username": "testuser",
            "password": "TestPassword123!"
        }, format="json")
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

    def test_change_password_same_password(self):
        payload = {
            "old_password": "TestPassword123!",
            "new_password": "TestPassword123!"
        }
        response = self.client.post(self.change_password_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data.get("errors", {}))

    def test_change_password_weak_new(self):
        payload = {
            "old_password": "TestPassword123!",
            "new_password": "weakpassword"
        }
        response = self.client.post(self.change_password_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data.get("errors", {}))

    def test_change_password_unauthenticated(self):
        # Remove credentials
        self.client.credentials()
        payload = {
            "old_password": "TestPassword123!",
            "new_password": "NewTestPassword123!"
        }
        response = self.client.post(self.change_password_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
