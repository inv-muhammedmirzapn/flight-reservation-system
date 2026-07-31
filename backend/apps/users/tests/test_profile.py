from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase
from apps.users.models import Profile

class ProfileAPITests(APITestCase):
    def setUp(self):
        self.register_url = "/api/auth/register/"
        self.login_url = "/api/auth/login/"
        self.profile_url = "/api/auth/profile/"
        
        self.user_data = {
            "username": "testuser",
            "password": "TestPassword123!",
            "email": "testuser@example.com",
            "first_name": "Test",
            "last_name": "User"
        }

    def test_registration_creates_profile(self):
        response = self.client.post(self.register_url, self.user_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        user = User.objects.get(username="testuser")
        self.assertTrue(Profile.objects.filter(user=user).exists())
        profile = user.profile
        self.assertEqual(profile.role, Profile.Role.CUSTOMER)

    def test_profile_retrieve_and_update(self):
        # 1. Register and get token
        self.client.post(self.register_url, self.user_data, format="json")
        
        login_response = self.client.post(self.login_url, {
            "username": "testuser",
            "password": "TestPassword123!"
        }, format="json")
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        access_token = login_response.data["access"]
        
        # Authenticate
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        
        # 2. Retrieve profile
        get_response = self.client.get(self.profile_url)
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["username"], "testuser")
        self.assertEqual(get_response.data["email"], "testuser@example.com")
        self.assertEqual(get_response.data["first_name"], "Test")
        self.assertEqual(get_response.data["last_name"], "User")
        
        # 3. Update profile fields and nested user fields
        # 3. Update profile fields and nested user fields (gender passed as "Male" to test normalization)
        update_payload = {
            "first_name": "UpdatedFirst",
            "last_name": "UpdatedLast",
            "email": "updated@example.com",  # Should be ignored (email is read-only)
            "phone_number": "1234567890",
            "gender": "Male",
            "country": "US",
            "state": "California",
            "city": "Los Angeles"
        }
        
        # Partial update (PATCH)
        patch_response = self.client.patch(self.profile_url, update_payload, format="json")
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["first_name"], "UpdatedFirst")
        self.assertEqual(patch_response.data["last_name"], "UpdatedLast")
        self.assertEqual(patch_response.data["email"], "testuser@example.com")
        self.assertEqual(patch_response.data["phone_number"], "1234567890")
        self.assertEqual(patch_response.data["gender"], "MALE")
        self.assertEqual(patch_response.data["country"], "US")
        
        # Verify changes in DB
        user = User.objects.get(username="testuser")
        self.assertEqual(user.first_name, "UpdatedFirst")
        self.assertEqual(user.last_name, "UpdatedLast")
        self.assertEqual(user.email, "testuser@example.com")
        self.assertEqual(user.profile.phone_number, "1234567890")
        self.assertEqual(user.profile.gender, "MALE")

    def test_date_of_birth_validation(self):
        # Register & authenticate
        self.client.post(self.register_url, self.user_data, format="json")
        login_res = self.client.post(self.login_url, {"username": "testuser", "password": "TestPassword123!"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_res.data['access']}")

        # 1. Future DOB should fail
        future_res = self.client.patch(self.profile_url, {"date_of_birth": "2050-01-01"}, format="json")
        self.assertEqual(future_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date_of_birth", future_res.data)

        # 2. DOB under 18 should fail
        underage_res = self.client.patch(self.profile_url, {"date_of_birth": "2020-01-01"}, format="json")
        self.assertEqual(underage_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date_of_birth", underage_res.data)

        # 3. Valid DOB (>= 18) should succeed
        valid_res = self.client.patch(self.profile_url, {"date_of_birth": "1995-05-15"}, format="json")
        self.assertEqual(valid_res.status_code, status.HTTP_200_OK)
        self.assertEqual(valid_res.data["date_of_birth"], "1995-05-15")
