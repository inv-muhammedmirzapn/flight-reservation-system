from rest_framework.permissions import BasePermission


class IsAdminOrSuperuser(BasePermission):
    """
    Grants access only to authenticated users who are either:
      - Django superusers (is_superuser=True), OR
      - Users with a Profile whose role is 'ADMIN'.

    Both view-level and object-level checks enforce the same rule,
    so check_object_permissions() is never silently bypassed.
    """

    message = "You do not have permission to perform this action."

    def _is_admin(self, user) -> bool:
        """Shared helper used by both permission check methods."""
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return hasattr(user, "profile") and user.profile.role == "ADMIN"

    def has_permission(self, request, view):
        return self._is_admin(request.user)

    def has_object_permission(self, request, view, obj):
        """Object-level: same admin/superuser requirement."""
        return self._is_admin(request.user)


class IsPassengerOnly(BasePermission):
    """
    Grants access only to authenticated non-staff / non-admin users.
    Administrators are blocked from performing passenger operations.
    """

    message = "Administrators are not permitted to perform passenger operations."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff:
            return False
        if hasattr(user, "profile") and user.profile.role == "ADMIN":
            return False
        return True