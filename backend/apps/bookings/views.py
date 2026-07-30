from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as rf_serializers
from .models import Booking, Passenger
from .serializers import BookingSerializer, PassengerSerializer
from .services import cancel_booking, create_booking

class BookingViewSet(mixins.CreateModelMixin,
                     mixins.ListModelMixin,
                     mixins.RetrieveModelMixin,
                     viewsets.GenericViewSet):
    """
    ViewSet for handling M3 Bookings.
    Includes the endpoint for cancelling a booking, which triggers auto-allocation.
    """
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Booking.objects.all() if (user.is_staff or user.is_superuser) else Booking.objects.filter(user=user)
        pnr = self.request.query_params.get('pnr')
        status_param = self.request.query_params.get('status')
        if pnr:
            qs = qs.filter(id__icontains=pnr)
        if status_param:
            qs = qs.filter(status=status_param)
        return qs.select_related('flight', 'user').order_by('-created_at')

    @extend_schema(
        request=inline_serializer(
            name='BookingCreateRequest',
            fields={
                'flight': rf_serializers.IntegerField(),
                'cabin_class': rf_serializers.ChoiceField(choices=['ECONOMY', 'BUSINESS', 'FIRST'], required=False, allow_null=True),
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
        responses={201: BookingSerializer}
    )
    def create(self, request, *args, **kwargs):
        """
        Book a flight.
        Expects: { "flight": "<flight-uuid>", "passengers": [...] }
        Delegates to the service layer for seat-locking and validation.
        """
        flight_id = request.data.get('flight')
        passengers_data = request.data.get('passengers', [])
        cabin_class = request.data.get('cabin_class', None)

        if not flight_id:
            return Response({'detail': 'flight field is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not passengers_data or not isinstance(passengers_data, list) or len(passengers_data) == 0:
            return Response({'detail': 'At least one passenger is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate cabin_class if provided
        valid_classes = {'ECONOMY', 'BUSINESS', 'FIRST'}
        if cabin_class and cabin_class not in valid_classes:
            return Response({'detail': f'Invalid cabin_class. Must be one of: {", ".join(valid_classes)}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            booking = create_booking(
                flight_id=flight_id,
                user=request.user,
                passengers_data=passengers_data,
                cabin_class=cabin_class,
            )
            serializer = self.get_serializer(booking)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            msg = e.message if isinstance(getattr(e, 'message', None), str) else (
                e.messages[0] if getattr(e, 'messages', None) else str(e)
            )
            return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': 'Booking failed. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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


class PassengerViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PassengerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Passenger.objects.all() if (user.is_staff or user.is_superuser) else Passenger.objects.filter(booking__user=user)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search)
        return qs.order_by('-id')