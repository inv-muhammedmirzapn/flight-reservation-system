from rest_framework import viewsets, mixins, permissions
from .models import WaitlistEntry
from .serializers import WaitlistEntrySerializer

class WaitlistViewSet(mixins.CreateModelMixin,
                      mixins.ListModelMixin,
                      mixins.RetrieveModelMixin,
                      viewsets.GenericViewSet):
    """
    ViewSet for handling Waitlist operations.
    Allows customers to join the waitlist and view their waitlist entries.
    """
    serializer_class = WaitlistEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Users can only see their own waitlist entries
        return WaitlistEntry.objects.filter(user=self.request.user).select_related('flight')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)