from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, extend_schema_view

from .models import Booking, BookingStatus
from .serializers import BookingSerializer
from apps.flights.models import Flight

@extend_schema_view(
    list=extend_schema(summary="List all bookings for the authenticated user", tags=["Bookings"]),
    create=extend_schema(summary="Create a new booking", tags=["Bookings"]),
    retrieve=extend_schema(summary="Retrieve a booking", tags=["Bookings"]),
    update=extend_schema(summary="Update a booking", tags=["Bookings"]),
    partial_update=extend_schema(summary="Partially update a booking", tags=["Bookings"]),
    destroy=extend_schema(summary="Delete a booking", tags=["Bookings"]),
)
class BookingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = BookingSerializer

    def get_queryset(self):
        return Booking.objects.filter(user=self.request.user).order_by('-created_at')

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        flight_id = request.data.get('flight')
        try:
            seat_count = int(request.data.get('seat_count', 1))
        except ValueError:
            return Response({"error": "seat_count must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        if not flight_id:
            return Response({"error": "flight is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Select for update to prevent concurrent overbooking
            flight = Flight.objects.select_for_update().get(id=flight_id)
        except Flight.DoesNotExist:
            return Response({"error": "Flight not found"}, status=status.HTTP_404_NOT_FOUND)

        if flight.available_seats < seat_count:
            return Response({"error": "Not enough seats available"}, status=status.HTTP_400_BAD_REQUEST)

        # Update available seats
        flight.available_seats -= seat_count
        flight.save()

        total_price = flight.base_fare * seat_count

        # Create booking
        booking = Booking.objects.create(
            user=request.user,
            flight=flight,
            seat_count=seat_count,
            total_price=total_price,
            status=BookingStatus.CONFIRMED
        )

        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Cancel a booking",
        tags=["Bookings"],
        request=None,
        responses={200: BookingSerializer, 400: None, 404: None}
    )
    @transaction.atomic
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        try:
            # Lock the booking to prevent concurrent cancellations
            booking = Booking.objects.select_for_update().get(pk=pk, user=request.user)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=status.HTTP_404_NOT_FOUND)

        if booking.status == BookingStatus.CANCELLED:
            return Response({"error": "Booking is already cancelled"}, status=status.HTTP_400_BAD_REQUEST)

        # Lock the flight to safely add seats back
        try:
            flight = Flight.objects.select_for_update().get(id=booking.flight_id)
        except Flight.DoesNotExist:
            return Response({"error": "Associated flight not found"}, status=status.HTTP_404_NOT_FOUND)

        # Re-add available seats
        flight.available_seats += booking.seat_count
        flight.save()

        booking.status = BookingStatus.CANCELLED
        booking.save()

        # Auto-allocate seats to waitlist passengers
        from apps.waitlist.services import process_waitlist_allocations
        process_waitlist_allocations(flight)

        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)