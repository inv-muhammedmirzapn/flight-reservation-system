from django.http import Http404
from django.db import IntegrityError
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from .models import Flight
from .serializers import FlightSerializer


class FlightPagination(PageNumberPagination):
    """Return 10 flights per page. Clients pass ?page=N."""
    page_size = 10
    page_size_query_param = 'page_size'   # allow override via ?page_size=N
    max_page_size = 100
    page_query_param = 'page'


class FlightListCreateView(APIView):
    """
    API View to handle listing and creation of flights.
    Supports GET (list, paginated) and POST (create) requests.
    """

    def get(self, request, *args, **kwargs) -> Response:
        """
        List flights — 10 per page by default.
        Query params: ?page=N  ?page_size=N
        """
        flights = Flight.objects.all().order_by('-departure_time')
        paginator = FlightPagination()
        page = paginator.paginate_queryset(flights, request)
        serializer = FlightSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, *args, **kwargs) -> Response:
        """
        Create a new Flight.
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
    API View to retrieve details of an existing flight.
    Supports GET requests.
    """

    def get_object(self, pk: str) -> Flight:
        """
        Helper method to retrieve a flight by its primary key.
        Raises Http404 if not found or if the ID is invalid.
        """
        try:
            return Flight.objects.get(pk=pk)
        except (Flight.DoesNotExist, ValueError, DjangoValidationError):
            raise Http404

    def get(self, request, id, *args, **kwargs) -> Response:
        """
        Retrieve details of a single flight.
        """
        flight = self.get_object(id)
        serializer = FlightSerializer(flight)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, id, *args, **kwargs) -> Response:
        """
        Delete a single flight.
        """
        if not (request.user.is_authenticated and (request.user.is_superuser or (hasattr(request.user, 'profile') and request.user.profile.role == 'ADMIN'))):
            return Response(
                {"detail": "You do not have permission to delete this flight."},
                status=status.HTTP_403_FORBIDDEN
            )
        flight = self.get_object(id)
        flight.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class FlightUpdateView(APIView):
    """
    API View to handle updates to existing flights.
    Supports PUT (full update) and PATCH (partial update) requests.
    """

    def get_object(self, pk: str) -> Flight:
        """
        Helper method to retrieve a flight by its primary key.
        Raises Http404 if not found or if the ID is invalid.
        """
        try:
            return Flight.objects.get(pk=pk)
        except (Flight.DoesNotExist, ValueError, DjangoValidationError):
            raise Http404

    def put(self, request, id, *args, **kwargs) -> Response:
        """
        Update an existing flight.
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

    def patch(self, request, id, *args, **kwargs) -> Response:
        """
        Partially update an existing flight.
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

class FlightBulkImportView(APIView):
    """
    API View to handle bulk import of flights from a JSON list.
    Only authenticated users with superuser or ADMIN role are allowed.
    """
    def post(self, request, *args, **kwargs) -> Response:
        if not (request.user.is_authenticated and (request.user.is_superuser or (hasattr(request.user, 'profile') and request.user.profile.role == 'ADMIN'))):
            return Response(
                {"detail": "You do not have permission to import flights."},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data
        if isinstance(data, dict):
            # Accept {"flights": [...]} structure
            data = data.get("flights", [])

        if not isinstance(data, list):
            return Response(
                {"detail": "Invalid format. Expected a JSON array of flights."},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_flights = []
        errors = []

        for index, item in enumerate(data):
            # Identify flight by flight_number or index
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

        return Response({
            "created_count": len(created_flights),
            "created_flights": created_flights,
            "errors": errors
        }, status=status.HTTP_200_OK)