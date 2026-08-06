from django.test import TestCase
from django.contrib.auth.models import User
from unittest.mock import patch, MagicMock
from django.core.cache import cache
from apps.users.services import (
    google_login,
    send_password_reset_otp,
    reset_password,
    send_email_change_otp,
    verify_email_change_otp,
    GoogleAuthError,
)
from apps.users.models import Profile

class UserServicesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="oldpassword")
        # Ensure cache is clean
        cache.clear()

    @patch("apps.users.services.http_requests.get")
    def test_google_login_success_new_user(self, mock_get):
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.json.return_value = {
            "email": "newgoogle@example.com",
            "given_name": "New",
            "family_name": "Google",
        }
        mock_get.return_value = mock_response

        result = google_login("real-google-token")
        
        self.assertEqual(result["email"], "newgoogle@example.com")
        user = User.objects.get(email="newgoogle@example.com")
        self.assertEqual(user.first_name, "New")
        self.assertEqual(user.last_name, "Google")
        self.assertTrue(Profile.objects.filter(user=user).exists())

    @patch("apps.users.services.http_requests.get")
    def test_google_login_invalid_token(self, mock_get):
        mock_response = MagicMock()
        mock_response.ok = False
        mock_get.return_value = mock_response

        with self.assertRaises(GoogleAuthError):
            google_login("bad-token")

    @patch("apps.notifications.services.NotificationService.send_password_reset_otp")
    def test_send_password_reset_otp(self, mock_send):
        send_password_reset_otp(self.user.email)
        mock_send.assert_called_once()
        self.assertTrue(cache.has_key(f"pwd_reset_otp_{self.user.email}"))

    def test_send_password_reset_otp_invalid_email(self):
        # Should not throw error, silent fail
        send_password_reset_otp("nobody@example.com")

    def test_reset_password_success(self):
        with patch("apps.users.services._generate_otp", return_value="123456"):
            send_password_reset_otp(self.user.email)
        
        success = reset_password(self.user.email, "123456", "newpassword123")
        self.assertTrue(success)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpassword123"))

    def test_reset_password_too_many_attempts(self):
        with patch("apps.users.services._generate_otp", return_value="123456"):
            send_password_reset_otp(self.user.email)
        
        # 5 wrong attempts
        for _ in range(5):
            reset_password(self.user.email, "000000", "newpassword123")
            
        # 6th attempt even with correct OTP should fail because it was deleted
        success = reset_password(self.user.email, "123456", "newpassword123")
        self.assertFalse(success)

    @patch("apps.notifications.services.NotificationService.send_email_change_otp")
    def test_send_email_change_otp(self, mock_send):
        send_email_change_otp(self.user, "new@example.com")
        mock_send.assert_called_once()
        self.assertTrue(cache.has_key(f"email_otp_{self.user.id}_new@example.com"))

    def test_send_email_change_otp_email_taken(self):
        User.objects.create_user(username="other", email="taken@example.com")
        send_email_change_otp(self.user, "taken@example.com")
        self.assertFalse(cache.has_key(f"email_otp_{self.user.id}_taken@example.com"))

    def test_verify_email_change_otp_success(self):
        with patch("apps.users.services._generate_otp", return_value="654321"):
            send_email_change_otp(self.user, "new@example.com")
            
        success = verify_email_change_otp(self.user, "new@example.com", "654321")
        self.assertTrue(success)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "new@example.com")

    def test_verify_email_change_otp_wrong_otp(self):
        with patch("apps.users.services._generate_otp", return_value="654321"):
            send_email_change_otp(self.user, "new@example.com")
            
        success = verify_email_change_otp(self.user, "new@example.com", "000000")
        self.assertFalse(success)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "test@example.com")
