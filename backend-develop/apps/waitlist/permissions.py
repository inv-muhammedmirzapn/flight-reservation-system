from rest_framework.permissions import BasePermission, IsAuthenticated


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


class IsOwnerOrAdmin(BasePermission):
    """
    Grants access to the object owner or administrators/superusers.
    Requires the user to be authenticated first.
    """

    message = "You do not have permission to access this resource."

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True
        if hasattr(request.user, "profile") and request.user.profile.role == "ADMIN":
            return True
        return obj.user == request.user