import csv
import io
from django.http import Http404
from django.db import IntegrityError
from django.db.models import Count, Q
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema

from .models import Flight
from .serializers import FlightSerializer
from .permissions import IsAdminOrSuperuser


class FlightPagination(PageNumberPagination):
    """Return 10 flights per page. Clients pass ?page=N."""
    page_size = 10
    page_size_query_param = 'page_size'   # allow override via ?page_size=N
    max_page_size = 2000
    page_query_param = 'page'


class FlightStatsView(APIView):
    """
    GET /api/flights/stats/
    Returns aggregate flight counts by status — always across ALL flights,
    independent of pagination or filters. Public endpoint.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs) -> Response:
        # Single efficient query: one row per status
        rows = (
            Flight.objects
            .values('status')
            .annotate(count=Count('id'))
        )
        stats = {
            'total': Flight.objects.count(),
            'scheduled': 0,
            'delayed': 0,
            'cancelled': 0,
            'boarding': 0,
            'departed': 0,
            'arrived': 0,
        }
        for row in rows:
            key = row['status'].lower()
            if key in stats:
                stats[key] = row['count']
        return Response(stats, status=status.HTTP_200_OK)


class FlightListCreateView(APIView):
    """
    API View to handle listing and creation of flights.

    - GET  (list):   Public — any visitor can browse flights.
                     Supports ?search, ?status, ?source, ?destination, ?date filters.
    - POST (create): Admin only — only ADMIN-role or superuser accounts may
                     create a new flight.
    """

    def get_permissions(self):
        """Return AllowAny for reads; IsAdminOrSuperuser for writes."""
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdminOrSuperuser()]

    @extend_schema(responses=FlightSerializer(many=True))
    def get(self, request, *args, **kwargs) -> Response:
        """
        List flights — 10 per page by default.
        Query params:
          ?page=N            page number
          ?page_size=N       override page size (max 100)
          ?search=<text>     OR-match on flight_number, airline, source, destination
          ?status=<STATUS>   exact match on status field
          ?source=<IATA>     case-insensitive contains match on source_airport
          ?destination=<IATA> case-insensitive contains match on destination_airport
          ?date=<YYYY-MM-DD> filter by departure date (local date of departure_time)
        """
        ordering = request.query_params.get('ordering', '').strip()
        allowed_orderings = [
            'departure_time', '-departure_time',
            'arrival_time', '-arrival_time',
            'base_fare', '-base_fare',
            'flight_number', '-flight_number',
            'status', '-status',
            'airline', '-airline'
        ]
        if ordering in allowed_orderings:
            qs = Flight.objects.all().order_by(ordering)
        else:
            qs = Flight.objects.all().order_by('-departure_time')

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(flight_number__icontains=search) |
                Q(airline__icontains=search) |
                Q(source_airport__icontains=search) |
                Q(destination_airport__icontains=search)
            )

        status_filter = request.query_params.get('status', '').strip().upper()
        if status_filter:
            qs = qs.filter(status=status_filter)

        source = request.query_params.get('source', '').strip()
        if source:
            qs = qs.filter(source_airport__icontains=source)

        destination = request.query_params.get('destination', '').strip()
        if destination:
            qs = qs.filter(destination_airport__icontains=destination)

        date = request.query_params.get('date', '').strip()
        if date:
            qs = qs.filter(departure_time__date=date)

        arrival_date = request.query_params.get('arrival_date', '').strip()
        if arrival_date:
            qs = qs.filter(arrival_time__date=arrival_date)

        # Advanced Filters
        min_fare = request.query_params.get('min_fare')
        if min_fare is not None:
            try:
                qs = qs.filter(base_fare__gte=float(min_fare))
            except ValueError:
                pass

        max_fare = request.query_params.get('max_fare')
        if max_fare is not None:
            try:
                qs = qs.filter(base_fare__lte=float(max_fare))
            except ValueError:
                pass

        stops = request.query_params.get('stops')
        if stops:
            # stops is a comma separated string like "0,1,2"
            try:
                stop_counts = [int(s.strip()) for s in stops.split(',')]
                
                # If 2 is in stop_counts, it means 2+ stops.
                q_objects = Q()
                for count in stop_counts:
                    if count >= 2:
                        q_objects |= Q(stops__len__gte=2)
                    else:
                        q_objects |= Q(stops__len=count)
                qs = qs.filter(q_objects)
            except ValueError:
                pass

        passengers = request.query_params.get('passengers')
        if passengers:
            try:
                p_count = int(passengers)
                # flight.available_seats >= passengers OR flight.available_seats == 0 (for waitlist)
                qs = qs.filter(Q(available_seats__gte=p_count) | Q(available_seats=0))
            except ValueError:
                pass

        paginator = FlightPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = FlightSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(request=FlightSerializer, responses={201: FlightSerializer})
    def post(self, request, *args, **kwargs) -> Response:
        """
        Create a new Flight.
        Requires ADMIN role or superuser.
        """
        serializer = FlightSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except (IntegrityError, DjangoValidationError) as exc:
            # Gracefully handle database constraint exceptions without exposing tracebacks
            return Response(
                {"non_field_errors": [str(exc)]},
                status=status.HTTP_400_BAD_REQUEST
            )


class FlightDetailView(APIView):
    """
    API View to retrieve or delete a single flight.

    - GET    (detail): Public — any visitor may view a flight's details.
    - DELETE:          Admin only — only ADMIN-role or superuser accounts may
                       delete a flight.
    """

    def get_permissions(self):
        """Return AllowAny for reads; IsAdminOrSuperuser for deletes."""
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdminOrSuperuser()]

    def get_object(self, pk: str) -> Flight:
        """
        Helper method to retrieve a flight by its primary key.
        Raises Http404 if not found or if the ID is invalid.
        """
        try:
            return Flight.objects.get(pk=pk)
        except (Flight.DoesNotExist, ValueError, DjangoValidationError):
            raise Http404

    @extend_schema(responses=FlightSerializer)
    def get(self, request, id, *args, **kwargs) -> Response:
        """Retrieve details of a single flight."""
        flight = self.get_object(id)
        serializer = FlightSerializer(flight)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(responses={204: None})
    def delete(self, request, id, *args, **kwargs) -> Response:
        """
        Delete a single flight.
        Requires ADMIN role or superuser.
        """
        flight = self.get_object(id)
        flight.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FlightUpdateView(APIView):
    """
    API View to handle updates to existing flights.
    Supports PUT (full update) and PATCH (partial update) requests.
    Admin only — only ADMIN-role or superuser accounts may update flights.
    """
    permission_classes = [IsAdminOrSuperuser]

    def get_object(self, pk: str) -> Flight:
        """
        Helper method to retrieve a flight by its primary key.
        Raises Http404 if not found or if the ID is invalid.
        """
        try:
            return Flight.objects.get(pk=pk)
        except (Flight.DoesNotExist, ValueError, DjangoValidationError):
            raise Http404

    @extend_schema(request=FlightSerializer, responses={200: FlightSerializer})
    def put(self, request, id, *args, **kwargs) -> Response:
        """
        Update an existing flight.
        Requires ADMIN role or superuser.
        """
        flight = self.get_object(id)
        serializer = FlightSerializer(flight, data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (IntegrityError, DjangoValidationError) as exc:
            # Gracefully handle database constraint exceptions
            return Response(
                {"non_field_errors": [str(exc)]},
                status=status.HTTP_400_BAD_REQUEST
            )

    @extend_schema(request=FlightSerializer, responses={200: FlightSerializer})
    def patch(self, request, id, *args, **kwargs) -> Response:
        """
        Partially update an existing flight.
        Requires ADMIN role or superuser.
        """
        flight = self.get_object(id)
        serializer = FlightSerializer(flight, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (IntegrityError, DjangoValidationError) as exc:
            # Gracefully handle database constraint exceptions
            return Response(
                {"non_field_errors": [str(exc)]},
                status=status.HTTP_400_BAD_REQUEST
            )


def _process_flight_records(records):
    """
    Shared helper: validate and save a list of flight dicts.
    Returns (created_flights, errors) lists.
    """
    created_flights = []
    errors = []

    for index, item in enumerate(records):
        flight_number = item.get("flight_number", f"Item #{index + 1}")
        serializer = FlightSerializer(data=item)
        if serializer.is_valid():
            try:
                serializer.save()
                created_flights.append(serializer.data)
            except (IntegrityError, DjangoValidationError) as exc:
                errors.append({
                    "flight_number": flight_number,
                    "errors": {"non_field_errors": [str(exc)]}
                })
        else:
            errors.append({
                "flight_number": flight_number,
                "errors": serializer.errors
            })

    return created_flights, errors


class FlightBulkImportView(APIView):
    """
    POST /api/flights/bulk-import/

    Accepts two formats — both admin-only:

    1. JSON body (list or {"flights": [...]}):
       Content-Type: application/json

    2. CSV file upload:
       Content-Type: multipart/form-data
       Field name: "file"
       Required CSV headers (matching model field names):
         flight_number, airline, aircraft, source_airport,
         destination_airport, departure_time, arrival_time,
         base_fare, total_seats, available_seats, status

    Returns: { created_count, created_flights, errors }
    """
    permission_classes = [IsAdminOrSuperuser]

    def post(self, request, *args, **kwargs) -> Response:
        # ── CSV path ────────────────────────────────────────────────
        csv_file = request.FILES.get('file')
        if csv_file is not None:
            filename = csv_file.name.lower()
            if not filename.endswith('.csv'):
                return Response(
                    {"detail": "Uploaded file must have a .csv extension."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            try:
                text = csv_file.read().decode('utf-8-sig')  # handle BOM
                reader = csv.DictReader(io.StringIO(text))
                records = [dict(row) for row in reader]
            except Exception as exc:
                return Response(
                    {"detail": f"Failed to parse CSV file: {exc}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not records:
                return Response(
                    {"detail": "CSV file is empty or has no data rows."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            created_flights, errors = _process_flight_records(records)
            return Response({
                "created_count": len(created_flights),
                "created_flights": created_flights,
                "errors": errors,
            }, status=status.HTTP_200_OK)

        # ── JSON path ────────────────────────────────────────────────
        data = request.data
        if isinstance(data, dict):
            # Accept {"flights": [...]} structure
            data = data.get("flights", [])

        if not isinstance(data, list):
            return Response(
                {"detail": "Invalid format. Expected a JSON array of flights or a CSV file upload."},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_flights, errors = _process_flight_records(data)
        return Response({
            "created_count": len(created_flights),
            "created_flights": created_flights,
            "errors": errors,
        }, status=status.HTTP_200_OK)