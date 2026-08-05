from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

from apps.users.services import GoogleAuthError

User = get_user_model()


class AuthenticationEdgeCasesTests(APITestCase):
    def setUp(self):
        # Create a default user
        self.user = User.objects.create_user(
            username="existinguser",
            email="existing@example.com",
            password="Password123!",
            first_name="Existing",
            last_name="User"
        )
        
        self.register_url = reverse("register")
        self.logout_url = reverse("logout")
        self.google_login_url = reverse("google_login")
        self.forgot_password_url = reverse("forgot_password")
        self.reset_password_url = reverse("reset_password")
        self.req_email_otp_url = reverse("request_email_otp")
        self.verify_email_otp_url = reverse("verify_email_otp")

    def test_register_existing_email(self):
        # Trying to register with an already existing email
        payload = {
            "username": "newuser",
            "email": "existing@example.com", # Same email as setUp user
            "password": "NewPassword123!",
            "first_name": "New",
            "last_name": "User"
        }
        response = self.client.post(self.register_url, payload, format="json")
        # Should return 201 Created and NOT leak that email already exists
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["detail"], "If the details are valid, your account has been created.")
        
        # Verify a new user was not actually created with this email
        self.assertEqual(User.objects.filter(email="existing@example.com").count(), 1)

    def test_register_existing_username(self):
        # Trying to register with an already existing username
        payload = {
            "username": "existinguser", # Same username as setUp user
            "email": "newunique@example.com",
            "password": "NewPassword123!",
            "first_name": "New",
            "last_name": "User"
        }
        response = self.client.post(self.register_url, payload, format="json")
        # Should return 201 Created (swallowing the username unique constraint error to prevent user enumeration)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["detail"], "If the details are valid, your account has been created.")

    def test_logout_invalid_refresh_token(self):
        self.client.force_authenticate(user=self.user)
        payload = {"refresh": "invalid_refresh_token"}
        response = self.client.post(self.logout_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid token", response.data["message"])

    def test_google_login_missing_token(self):
        payload = {}
        response = self.client.post(self.google_login_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No token provided", response.data["error"])

    @patch("apps.users.views.google_login")
    def test_google_login_invalid_token(self, mock_google_login):
        mock_google_login.side_effect = GoogleAuthError("Invalid token")
        payload = {"token": "bad_token"}
        response = self.client.post(self.google_login_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("Google login failed", response.data["message"])

    def test_forgot_password_nonexistent_email(self):
        payload = {"email": "nonexistent@example.com"}
        response = self.client.post(self.forgot_password_url, payload, format="json")
        # Returns 200 OK silently to prevent user enumeration
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("If an account with that email exists", response.data["detail"])

    def test_reset_password_invalid_otp(self):
        payload = {
            "email": "existing@example.com",
            "otp": "000000", # Wrong OTP
            "new_password": "NewPassword123!"
        }
        response = self.client.post(self.reset_password_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("The OTP is invalid or has expired", response.data["message"])

    def test_request_email_change_unauthenticated(self):
        # Email change request is protected
        payload = {"new_email": "newemail@example.com"}
        response = self.client.post(self.req_email_otp_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_request_email_change_invalid_email(self):
        self.client.force_authenticate(user=self.user)
        # Invalid email format
        payload = {"new_email": "invalid_email_format"}
        response = self.client.post(self.req_email_otp_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_email_change_invalid_otp(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            "new_email": "newemail@example.com",
            "otp": "999999"
        }
        response = self.client.post(self.verify_email_otp_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("The OTP is invalid or has expired", response.data["message"])
