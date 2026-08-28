from rest_framework import viewsets, permissions, status
#@action allows you to create a custom API endpoint inside a ViewSet.
from rest_framework.decorators import action  
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import Notification
from .serializers import NotificationSerializer

@extend_schema(tags=["Notifications"])
#ReadOnlyModelViewSet provides only the standard read operations.
class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows users to view and manage their notifications.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Get the currently authenticated user from the HTTP request.
        user = self.request.user
        if not user or user.is_anonymous:
            return Notification.objects.none()

        ## Restrict the queryset to notifications belonging to the logged-in user.
        return Notification.objects.filter(user=user)

    @extend_schema(responses={200: NotificationSerializer}, tags=["Notifications"])

    #This action operates on one specific notification, so the URL contains its ID.
    @action(detail=True, methods=['patch'])
    def read(self, request, pk=None):
        """Mark a specific notification as read."""
        notification = self.get_object()

        # Only update the database if the notification is currently unread.
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])

        # Convert the updated Notification object into the API response format.
        serializer = self.get_serializer(notification)
        return Response(serializer.data)

   
    @extend_schema(responses={200: {"type": "object", "properties": {"message": {"type": "string"}}}}, tags=["Notifications"])
    # This action operates on the notification collection rather than one notification.  
    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):

        # Get this user's unread notifications and mark all of them as read.
        # `update()` returns how many database rows were changed.
        updated_count = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"message": f"{updated_count} notifications marked as read."})