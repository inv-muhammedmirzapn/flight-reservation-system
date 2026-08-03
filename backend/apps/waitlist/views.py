from decimal import Decimal
from django.db.models import Sum
from django.http import Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from apps.flights.models import Flight, CabinClass
from apps.bookings.models import Booking, BookingStatus
from .models import WaitlistEntry, WaitlistStatus
from .permissions import IsAdminOrSuperuser, IsOwnerOrAdmin
from .serializers import WaitlistEntrySerializer
from .services import (
    process_waitlist_allocations,
    join_waitlist,
    cancel_waitlist_entry,
    promote_waitlist_entry,
    expire_departed_waitlist_entries,
    get_waitlist_passenger_count,
    WaitlistError,
)
from drf_spectacular.utils import extend_schema, inline_serializer, OpenApiParameter, OpenApiTypes
from rest_framework import serializers as rf_serializers


class WaitlistJoinView(APIView):
    """
    POST /api/waitlist/join/
    Joins the waitlist for a flight if it is full.
    Permission: IsAuthenticated.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer(
            name='WaitlistJoinRequest',
            fields={
                'flight': rf_serializers.IntegerField(),
                'cabin_class': rf_serializers.ChoiceField(choices=['ECONOMY', 'BUSINESS', 'FIRST'], required=False, allow_null=True),
                'passengers': rf_serializers.ListField(
                    child=inline_serializer(
                        name='WaitlistPassengerRequest',
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
        responses={201: WaitlistEntrySerializer},
        tags=["Waitlist"]
    )
    def post(self, request, *args, **kwargs):
        flight_id      = request.data.get("flight")
        passengers_data = request.data.get("passengers", [])
        cabin_class    = request.data.get("cabin_class")

        if not flight_id:
            raise ValidationError({"error": "flight is required."})
        if not passengers_data or not isinstance(passengers_data, list) or len(passengers_data) == 0:
            raise ValidationError({"error": "At least one passenger is required."})

        try:
            entry = join_waitlist(
                user=request.user,
                flight_id=flight_id,
                passengers_data=passengers_data,
                cabin_class=cabin_class,
            )
        except WaitlistError as exc:
            if exc.status_code == 404:
                raise Http404(str(exc))
            raise ValidationError({"error": str(exc)})

        serializer = WaitlistEntrySerializer(entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class WaitlistListView(APIView):
    """
    GET /api/waitlist/
    Lists waitlist entries.
    If the user is an admin, they see all entries (with optional flight filtering).
    If they are a customer, they see only their own entries.
    Automatically transitions expired pending entries to EXPIRED.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List Waitlist Entries",
        description="Lists waitlist entries for the current user. Admins can see all entries and filter by flight.",
        responses={200: WaitlistEntrySerializer(many=True)},
        tags=["Waitlist"],
        parameters=[
            OpenApiParameter(
                name="flight",
                description="Filter by flight ID (Admins only)",
                required=False,
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
            )
        ]
    )
    def get(self, request, *args, **kwargs):
        is_admin = IsAdminOrSuperuser().has_permission(request, self)

        # Auto-expire pending entries whose flights have already departed
        expire_departed_waitlist_entries(user=request.user)

        # Build list query
        if is_admin:
            queryset = WaitlistEntry.objects.all()
            flight_id = request.query_params.get("flight")
            if flight_id:
                queryset = queryset.filter(flight_id=flight_id)
        else:
            queryset = WaitlistEntry.objects.filter(user=request.user)

        queryset = queryset.select_related('flight', 'user').prefetch_related('passengers').order_by('-created_at')

        serializer = WaitlistEntrySerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WaitlistDetailView(APIView):
    """
    GET /api/waitlist/<uuid:pk>/
    Retrieves details of a waitlist entry.
    Permission: IsAuthenticated and IsOwnerOrAdmin.
    """

    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def get_object(self, pk):
        try:
            entry = WaitlistEntry.objects.get(pk=pk)
            self.check_object_permissions(self.request, entry)
            return entry
        except (WaitlistEntry.DoesNotExist, ValueError):
            raise Http404

    @extend_schema(
        summary="Waitlist Entry Details",
        description="Retrieves details of a specific waitlist entry.",
        responses={200: WaitlistEntrySerializer},
        tags=["Waitlist"]
    )
    def get(self, request, pk, *args, **kwargs):
        entry = self.get_object(pk)

        # Auto-expire if flight has departed
        if (
            entry.status == WaitlistStatus.PENDING
            and entry.flight.departure_time <= timezone.now()
        ):
            entry.status = WaitlistStatus.EXPIRED
            entry.save()

        serializer = WaitlistEntrySerializer(entry)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WaitlistCancelView(APIView):
    """
    POST /api/waitlist/<uuid:pk>/cancel/
    Cancels a pending waitlist entry and returns refund calculations.
    Permission: IsAuthenticated and IsOwnerOrAdmin.
    """

    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def get_object(self, pk):
        try:
            entry = WaitlistEntry.objects.get(pk=pk)
            self.check_object_permissions(self.request, entry)
            return entry
        except (WaitlistEntry.DoesNotExist, ValueError):
            raise Http404

    @extend_schema(
        summary="Cancel Waitlist Entry",
        description="Cancels a pending waitlist entry and returns refund details.",
        request=None,
        responses={200: inline_serializer('WaitlistCancelResponse', {
            'message': rf_serializers.CharField(),
            'refund_amount': rf_serializers.DecimalField(max_digits=10, decimal_places=2),
            'processing_fee': rf_serializers.DecimalField(max_digits=10, decimal_places=2),
            'status': rf_serializers.CharField(),
        })},
        tags=["Waitlist"]
    )
    def post(self, request, pk, *args, **kwargs):
        entry = self.get_object(pk)

        try:
            refund_info = cancel_waitlist_entry(entry)
        except WaitlistError as exc:
            raise ValidationError({"error": str(exc)})

        return Response(
            {
                "message": (
                    f"Waitlist entry cancelled. A 95% refund of "
                    f"\u20b9{refund_info['refund_amount']:.2f} has been processed "
                    f"(after a 5% processing fee of \u20b9{refund_info['processing_fee']:.2f})."
                ),
                "refund_amount":  refund_info["refund_amount"],
                "processing_fee": refund_info["processing_fee"],
                "status":         refund_info["status"],
            },
            status=status.HTTP_200_OK,
        )


class WaitlistPromoteView(APIView):
    """
    POST /api/waitlist/<uuid:pk>/promote/
    Manually promotes a pending waitlist entry to a confirmed booking.
    Permission: IsAdminOrSuperuser.
    """

    permission_classes = [IsAuthenticated, IsAdminOrSuperuser]

    def get_object(self, pk):
        try:
            return WaitlistEntry.objects.get(pk=pk)
        except (WaitlistEntry.DoesNotExist, ValueError):
            raise Http404

    @extend_schema(
        summary="Promote Waitlist Entry",
        description="Manually promotes a pending waitlist entry to a confirmed booking. Admin only.",
        request=None,
        responses={200: inline_serializer('WaitlistPromoteResponse', {'message': rf_serializers.CharField()})},
        tags=["Waitlist"]
    )
    def post(self, request, pk, *args, **kwargs):
        entry = self.get_object(pk)

        try:
            promote_waitlist_entry(entry)
        except WaitlistError as exc:
            raise ValidationError({"error": str(exc)})

        return Response(
            {"message": "Waitlist entry successfully promoted to confirmed booking."},
            status=status.HTTP_200_OK,
        )


class WaitlistFlightCountView(APIView):
    """
    GET /api/waitlist/flight/<uuid:flight_id>/
    Returns the count of waitlisted passengers (sum of seat_count of pending entries).
    Permission: AllowAny (public).
    """

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Waitlist Flight Count",
        description="Returns the total number of passengers currently on the waitlist (pending) for a specific flight.",
        responses={200: inline_serializer('WaitlistCountResponse', {'waitlist_count': rf_serializers.IntegerField()})},
        tags=["Waitlist"]
    )
    def get(self, request, flight_id, *args, **kwargs):
        try:
            count = get_waitlist_passenger_count(flight_id)
        except ValueError:
            return Response(
                {"error": "Invalid flight_id format."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"waitlist_count": count}, status=status.HTTP_200_OK)