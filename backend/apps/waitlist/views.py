from decimal import Decimal
from django.db.models import Sum
from django.http import Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from apps.flights.models import Flight
from .models import WaitlistEntry, WaitlistStatus
from .permissions import IsAdminOrSuperuser, IsOwnerOrAdmin
from .serializers import WaitlistEntrySerializer
from drf_spectacular.utils import extend_schema, inline_serializer
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
        responses={201: WaitlistEntrySerializer}
    )
    def post(self, request, *args, **kwargs):
        flight_id = request.data.get("flight")
        passengers_data = request.data.get("passengers", [])

        if not flight_id:
            return Response(
                {"error": "flight is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
            
        if not passengers_data or not isinstance(passengers_data, list) or len(passengers_data) == 0:
            return Response({'error': 'At least one passenger is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        seat_count = len(passengers_data)

        try:
            flight = Flight.objects.get(id=flight_id)
        except (Flight.DoesNotExist, ValueError):
            return Response(
                {"error": "Flight not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Validate flight departure
        if flight.departure_time <= timezone.now():
            return Response(
                {"error": "Cannot join the waitlist for a flight that has already departed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate seat_count range
        if seat_count < 1 or seat_count > 9:
            return Response(
                {"error": "Seat count must be between 1 and 9 seats."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Enforce that flight must be full
        if flight.available_seats >= seat_count:
            return Response(
                {"error": "Waitlist tickets cannot be booked on the flight as there are enough available seats"},
                status=status.HTTP_400_BAD_REQUEST,
            )
            
        # Validate passenger data
        for p in passengers_data:
            name = p.get('name', '')
            if isinstance(name, str):
                name = name.strip()
            age = p.get('age')
            gender = p.get('gender')
    
            if not name or not age or not gender:
                return Response({'error': 'Name, age, and gender are required for all passengers.'}, status=status.HTTP_400_BAD_REQUEST)
                
            if len(name) < 2:
                return Response({'error': 'Passenger name must be at least 2 characters.'}, status=status.HTTP_400_BAD_REQUEST)
                
            try:
                age_int = int(age)
                if age_int < 1 or age_int > 120:
                    return Response({'error': 'Passenger age must be between 1 and 120.'}, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({'error': 'Passenger age must be a valid number.'}, status=status.HTTP_400_BAD_REQUEST)
                    
            if gender not in ['M', 'F', 'O', 'Male', 'Female', 'Other']:
                raise Response("Please select a valid option for Gender.")
                
        # Check for duplicate pending waitlist entry
        if WaitlistEntry.objects.filter(
            user=request.user, flight=flight, status=WaitlistStatus.PENDING
        ).exists():
            return Response(
                {"error": "You are already on the waitlist for this flight"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Calculate price based on seat count
        price = flight.base_fare * seat_count

        # Create waitlist entry
        entry = WaitlistEntry.objects.create(
            user=request.user,
            flight=flight,
            seat_count=seat_count,
            price=price,
            status=WaitlistStatus.PENDING,
        )
        
        from .models import WaitlistPassenger
        for p_data in passengers_data:
            WaitlistPassenger.objects.create(
                waitlist_entry=entry,
                name=p_data['name'],
                age=p_data['age'],
                gender=p_data['gender'],
                phone_number=p_data.get('phone_number', '')
            )

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

    def get(self, request, *args, **kwargs):
        is_admin = IsAdminOrSuperuser().has_permission(request, self)

        # Auto-expire pending entries whose flights have already departed
        now = timezone.now()
        expired_qs = WaitlistEntry.objects.filter(
            status=WaitlistStatus.PENDING, flight__departure_time__lte=now
        )
        if not is_admin:
            expired_qs = expired_qs.filter(user=request.user)
        expired_qs.update(status=WaitlistStatus.EXPIRED)

        # Build list query
        if is_admin:
            queryset = WaitlistEntry.objects.all()
            flight_id = request.query_params.get("flight")
            if flight_id:
                queryset = queryset.filter(flight_id=flight_id)
        else:
            queryset = WaitlistEntry.objects.filter(user=request.user)

        queryset = queryset.order_by('-created_at')

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

    def post(self, request, pk, *args, **kwargs):
        entry = self.get_object(pk)

        if entry.status != WaitlistStatus.PENDING:
            return Response(
                {"error": "Only pending waitlist entries can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Cancel entry
        entry.status = WaitlistStatus.CANCELLED
        entry.save()

        # Calculate refund (95% refund, 5% processing fee)
        price = entry.price
        processing_fee = round(price * Decimal("0.05"), 2)
        refund_amount = round(price * Decimal("0.95"), 2)

        return Response(
            {
                "message": f"Waitlist entry cancelled. A 95% refund of ${refund_amount:.2f} has been processed (after a 5% processing fee of ${processing_fee:.2f}).",
                "refund_amount": refund_amount,
                "processing_fee": processing_fee,
                "status": entry.status,
            },
            status=status.HTTP_200_OK,
        )


class WaitlistFlightCountView(APIView):
    """
    GET /api/waitlist/flight/<uuid:flight_id>/
    Returns the count of waitlisted passengers (sum of seat_count of pending entries).
    Permission: AllowAny (public).
    """

    permission_classes = [AllowAny]

    def get(self, request, flight_id, *args, **kwargs):
        try:
            # Aggregate seat counts of PENDING waitlist entries
            result = WaitlistEntry.objects.filter(
                flight_id=flight_id, status=WaitlistStatus.PENDING
            ).aggregate(total=Sum("seat_count"))
            count = result["total"] or 0
        except ValueError:
            return Response(
                {"error": "Invalid flight_id format."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"waitlist_count": count}, status=status.HTTP_200_OK)