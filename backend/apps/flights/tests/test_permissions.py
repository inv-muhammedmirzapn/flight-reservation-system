from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.users.models import Profile
from apps.flights.permissions import IsAdminOrSuperuser
from rest_framework.test import APIRequestFactory

User = get_user_model()

class MockView:
    pass

class IsAdminOrSuperuserTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission = IsAdminOrSuperuser()
        self.view = MockView()
        
        # Superuser
        self.superuser = User.objects.create_superuser(
            username="super", email="super@test.com", password="password"
        )
        
        # Admin user
        self.admin_user = User.objects.create_user(
            username="admin", email="admin@test.com", password="password"
        )
        self.admin_user.profile.role = "ADMIN"
        self.admin_user.profile.save()
        
        # Regular user
        self.regular_user = User.objects.create_user(
            username="user", email="user@test.com", password="password"
        )
        self.regular_user.profile.role = "CUSTOMER"
        self.regular_user.profile.save()
        
        # User without profile
        self.no_profile_user = User.objects.create_user(
            username="noprofile", email="no@test.com", password="password"
        )
        self.no_profile_user.profile.delete()

    def test_unauthenticated_user_denied(self):
        request = self.factory.get("/")
        # Simulate unauthenticated request
        from django.contrib.auth.models import AnonymousUser
        request.user = AnonymousUser()
        
        has_perm = self.permission.has_permission(request, self.view)
        self.assertFalse(has_perm)

    def test_superuser_allowed(self):
        request = self.factory.get("/")
        request.user = self.superuser
        
        has_perm = self.permission.has_permission(request, self.view)
        self.assertTrue(has_perm)

    def test_admin_role_allowed(self):
        request = self.factory.get("/")
        request.user = self.admin_user
        
        has_perm = self.permission.has_permission(request, self.view)
        self.assertTrue(has_perm)

    def test_customer_role_denied(self):
        request = self.factory.get("/")
        request.user = self.regular_user
        
        has_perm = self.permission.has_permission(request, self.view)
        self.assertFalse(has_perm)

    def test_user_without_profile_denied(self):
        request = self.factory.get("/")
        request.user = self.no_profile_user
        
        has_perm = self.permission.has_permission(request, self.view)
        self.assertFalse(has_perm)
