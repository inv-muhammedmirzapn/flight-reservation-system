from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as rf_serializers
from .models import Booking
from .serializers import BookingSerializer
from .services import cancel_booking, create_booking

@extend_schema(tags=["Bookings"])
class BookingViewSet(mixins.CreateModelMixin,
                     mixins.ListModelMixin,
                     mixins.RetrieveModelMixin,
                     viewsets.GenericViewSet):
  
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Booking.objects.filter(user=self.request.user).select_related('flight').prefetch_related('passengers').order_by('-created_at')

    @extend_schema(
        request=inline_serializer(
            name='BookingCreateRequest',
            fields={
                'flight': rf_serializers.IntegerField(),
                'passengers': rf_serializers.ListField(
                    child=inline_serializer(
                        name='BookingPassengerRequest',
                        fields={
                            'name': rf_serializers.CharField(),
                            'age': rf_serializers.IntegerField(),
                            'gender': rf_serializers.ChoiceField(choices=['M', 'F', 'O']),
                            'phone_number': rf_serializers.CharField(required=False, allow_blank=True)
                        }
                    )
                )
            }
        ),
        responses={201: BookingSerializer},
        tags=["Bookings"]
    )
    def create(self, request, *args, **kwargs):
        """
        Book a flight.
        Expects: { "flight": "<flight-uuid>", "passengers": [...] }
        Delegates to the service layer for seat-locking and validation.
        """
        flight_id = request.data.get('flight')
        passengers_data = request.data.get('passengers', [])

        if not flight_id:
            return Response({'detail': 'flight field is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not passengers_data or not isinstance(passengers_data, list) or len(passengers_data) == 0:
            return Response({'detail': 'At least one passenger is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            booking = create_booking(flight_id=flight_id, user=request.user, passengers_data=passengers_data)
            serializer = self.get_serializer(booking)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            # e.message is the clean string; str(e) would give "['message']"
            msg = e.message if isinstance(getattr(e, 'message', None), str) else (
                e.messages[0] if getattr(e, 'messages', None) else str(e)
            )
            return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': 'Booking failed. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @extend_schema(
        summary="Cancel Booking",
        description="Cancel a booking. This increments the flight's available seats and triggers the waitlist auto-allocation logic.",
        responses={200: inline_serializer('BookingCancelResponse', {
            'detail': rf_serializers.CharField(),
            'status': rf_serializers.CharField()
        })},
        tags=["Bookings"]
    )
    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        """
        Cancel a booking. This increments the flight's available seats
        and triggers the waitlist auto-allocation logic.
        """
        try:
            booking = cancel_booking(booking_id=pk, user=request.user)
            return Response(
                {"detail": "Booking cancelled successfully. Waitlist allocation triggered (if applicable).", "status": booking.status},
                status=status.HTTP_200_OK
            )
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)