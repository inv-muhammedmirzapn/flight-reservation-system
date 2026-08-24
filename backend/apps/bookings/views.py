import logging
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse, Http404
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as rf_serializers
from .models import Booking, Passenger, SeatHold
from .serializers import BookingSerializer, PassengerSerializer, SeatHoldSerializer
from .services import cancel_booking, create_booking, hold_seat, release_hold
from apps.flights.permissions import IsAdminOrSuperuser

logger = logging.getLogger(__name__)

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
        if not user or user.is_anonymous:
            return Booking.objects.none()
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
                            'phone_number': rf_serializers.CharField(required=False, allow_blank=True),
                            'seat_number': rf_serializers.CharField(required=False, allow_blank=True, allow_null=True),
                            'extra_baggage_kg': rf_serializers.DecimalField(required=False, max_digits=6, decimal_places=2, allow_null=True),
                            'meal_preference': rf_serializers.ChoiceField(choices=['VEG', 'NON_VEG', 'NONE'], required=False, allow_null=True),
                            'selected_meals': rf_serializers.ListField(
                                required=False,
                                allow_null=True,
                                child=inline_serializer(
                                    name='BookingSelectedMealRequest',
                                    fields={
                                        'food_item_id': rf_serializers.IntegerField(required=False, allow_null=True),
                                        'flight_meal_id': rf_serializers.IntegerField(required=False, allow_null=True),
                                        'flight_leg_id': rf_serializers.IntegerField(required=False, allow_null=True),
                                        'quantity': rf_serializers.IntegerField(required=False, default=1)
                                    }
                                )
                            )
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
            raise ValidationError({'detail': 'flight field is required.'})
        if not passengers_data or not isinstance(passengers_data, list) or len(passengers_data) == 0:
            raise ValidationError({'detail': 'At least one passenger is required.'})

        # Validate cabin_class if provided
        valid_classes = {'ECONOMY', 'BUSINESS', 'FIRST'}
        if cabin_class and cabin_class not in valid_classes:
            raise ValidationError({'detail': f'Invalid cabin_class. Must be one of: {", ".join(valid_classes)}'})

        try:
            booking = create_booking(
                flight_id=flight_id,
                user=request.user,
                passengers_data=passengers_data,
                cabin_class=cabin_class,
            )
            serializer = self.get_serializer(booking)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except DjangoValidationError as e:
            msg = e.message if isinstance(getattr(e, 'message', None), str) else (
                e.messages[0] if getattr(e, 'messages', None) else str(e)
            )
            raise ValidationError({'detail': msg})
        except Exception as e:
            logger.exception("Booking failed")
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
        except DjangoValidationError as e:
            raise ValidationError({'detail': str(e)})

    @action(detail=True, methods=['get'], url_path='download-pdf')
    def download_pdf(self, request, pk=None):
        """
        GET /api/bookings/:id/download-pdf/
        Returns a PDF of the booking ticket as a file download.
        """
        from .ticket_pdf import generate_booking_pdf
        try:
            booking = self.get_object()
            if not (request.user.is_staff or request.user.is_superuser):
                if booking.user != request.user:
                    return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
            if booking.status != 'CONFIRMED':
                return Response({'detail': 'PDF is only available for confirmed bookings.'},
                                status=status.HTTP_400_BAD_REQUEST)
            pdf_bytes = generate_booking_pdf(booking)
            ref = str(booking.id).replace('-', '').upper()[:8]
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Passenger-Ticket-{ref}.pdf"'
            return response
        except Http404:
            raise
        except Exception:
            logger.exception('Failed to generate ticket PDF')
            return Response({'detail': 'Failed to generate PDF. Please try again.'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='send-ticket-email')
    def send_ticket_email(self, request, pk=None):
        """
        POST /api/bookings/:id/send-ticket-email/
        Re-sends the booking confirmation email with the PDF attached.
        """
        from apps.notifications.services import NotificationService
        try:
            booking = self.get_object()
            if not (request.user.is_staff or request.user.is_superuser):
                if booking.user != request.user:
                    return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
            if booking.status != 'CONFIRMED':
                return Response({'detail': 'Ticket email is only available for confirmed bookings.'},
                                status=status.HTTP_400_BAD_REQUEST)
            NotificationService.send_booking_confirmation(booking)
            return Response({'detail': 'Ticket email sent successfully.'}, status=status.HTTP_200_OK)
        except Http404:
            raise
        except Exception:
            logger.exception('Failed to send ticket email')
            return Response({'detail': 'Failed to send email. Please try again.'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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


class AdminBookingViewSet(mixins.ListModelMixin,
                          mixins.RetrieveModelMixin,
                          viewsets.GenericViewSet):
    """
    Admin-only ViewSet for managing all bookings across all users.
    Provides:
      - GET  /api/admin/bookings/          — list all bookings with optional filters
      - GET  /api/admin/bookings/<pk>/     — retrieve any booking
      - POST /api/admin/bookings/<pk>/force-cancel/ — cancel any booking regardless of owner
    """
    serializer_class = BookingSerializer
    permission_classes = [IsAdminOrSuperuser]

    def get_queryset(self):
        qs = Booking.objects.select_related('flight', 'user').order_by('-created_at')

        # Optional filters
        pnr = self.request.query_params.get('pnr')
        if pnr:
            qs = qs.filter(id__icontains=pnr)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)

        flight_id = self.request.query_params.get('flight_id')
        if flight_id:
            qs = qs.filter(flight_id=flight_id)

        return qs

    @extend_schema(
        summary="Force-cancel any booking (admin)",
        description="Allows admins to cancel any booking regardless of ownership. Triggers waitlist allocation.",
        request=None,
        responses={200: inline_serializer('AdminForceCancelResponse', {
            'detail': rf_serializers.CharField(),
            'status': rf_serializers.CharField(),
        })},
        tags=["Admin — Bookings"],
    )
    @action(detail=True, methods=['post'], url_path='force-cancel',
            permission_classes=[IsAdminOrSuperuser])
    def force_cancel(self, request, pk=None):
        """
        POST /api/admin/bookings/<pk>/force-cancel/
        Cancel a booking as an admin, bypassing ownership checks.
        """
        try:
            # Pass the booking's own user so service-layer ownership logic passes
            booking = Booking.objects.get(pk=pk)
            booking = cancel_booking(booking_id=pk, user=booking.user, is_admin_cancel=True)
            return Response(
                {
                    "detail": "Booking force-cancelled by admin. Waitlist allocation triggered (if applicable).",
                    "status": booking.status,
                },
                status=status.HTTP_200_OK,
            )
        except Booking.DoesNotExist:
            return Response({'detail': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)
        except DjangoValidationError as e:
            raise ValidationError({'detail': str(e)})


class SeatHoldViewSet(mixins.CreateModelMixin,
                      mixins.DestroyModelMixin,
                      viewsets.GenericViewSet):
    """
    Temporary seat hold endpoints.
      POST   /api/bookings/holds/          — hold a seat (returns hold id + seconds_remaining)
      DELETE /api/bookings/holds/{id}/     — release a hold early (user deselected seat)
    """
    serializer_class = SeatHoldSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return SeatHold.objects.none()
        return SeatHold.objects.filter(user=user)

    def create(self, request, *args, **kwargs):
        """
        POST /api/bookings/holds/
        Body: { "flight_instance": <id>, "seat_number": "12A" }
        """
        flight_instance_id = request.data.get('flight_instance')
        seat_number = request.data.get('seat_number', '').strip().upper()
        old_seat_number = request.data.get('old_seat_number')
        if old_seat_number:
            old_seat_number = str(old_seat_number).strip().upper()

        if not flight_instance_id:
            raise ValidationError({'detail': 'flight_instance is required.'})
        if not seat_number:
            raise ValidationError({'detail': 'seat_number is required.'})

        try:
            from apps.flights.models import FlightInstance
            flight_instance = FlightInstance.objects.get(pk=flight_instance_id)
        except FlightInstance.DoesNotExist:
            raise ValidationError({'detail': 'Flight instance not found.'})

        try:
            hold = hold_seat(flight_instance, seat_number, request.user, old_seat_number=old_seat_number)
            serializer = self.get_serializer(hold)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except DjangoValidationError as e:
            msg = e.message if isinstance(getattr(e, 'message', None), str) else (
                e.messages[0] if getattr(e, 'messages', None) else str(e)
            )
            raise ValidationError({'detail': msg})

    def destroy(self, request, *args, **kwargs):
        """
        DELETE /api/bookings/holds/{id}/
        Releases the hold and frees the seat back to AVAILABLE immediately.
        """
        try:
            release_hold(kwargs['pk'], request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DjangoValidationError as e:
            raise ValidationError({'detail': str(e)})