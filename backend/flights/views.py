from django.http import Http404
from django.db import IntegrityError
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from flights.models import Flight
from flights.serializers import FlightSerializer

class FlightCreateView(APIView):
    """
    API View to handle creation of new flights.
    Supports POST requests.
    """

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

class FlightUpdateView(APIView):
    """
    API View to handle updates to existing flights.
    Supports PUT requests.
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