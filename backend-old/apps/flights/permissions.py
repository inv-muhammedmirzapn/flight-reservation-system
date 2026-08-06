from rest_framework.permissions import BasePermission


class IsAdminOrSuperuser(BasePermission):
    """
    Grants access only to authenticated users who are either:
      - Django superusers (is_superuser=True), OR
      - Users with a Profile whose role is 'ADMIN'.
    """

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return (
            hasattr(request.user, "profile")
            and request.user.profile.role == "ADMIN"
        )