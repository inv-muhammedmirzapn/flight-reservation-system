from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.users.models import Profile

User = get_user_model()

class UserProfileSignalsTest(TestCase):
    def test_create_regular_user_creates_profile_with_customer_role(self):
        user = User.objects.create_user(
            username='customer_user',
            email='customer@example.com',
            password='password123'
        )
        self.assertTrue(hasattr(user, 'profile'))
        self.assertEqual(user.profile.role, Profile.Role.CUSTOMER)

    def test_create_superuser_creates_profile_with_admin_role(self):
        superuser = User.objects.create_superuser(
            username='admin_user',
            email='admin@example.com',
            password='password123'
        )
        self.assertTrue(hasattr(superuser, 'profile'))
        self.assertEqual(superuser.profile.role, Profile.Role.ADMIN)

    def test_profile_saved_on_user_save(self):
        user = User.objects.create_user(
            username='test_user',
            email='test@example.com',
            password='password123'
        )
        # Update user profile details to ensure the save receiver works
        user.profile.role = Profile.Role.ADMIN
        user.save()
        
        # Reload from db
        user.refresh_from_db()
        self.assertEqual(user.profile.role, Profile.Role.ADMIN)
