from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import serializers
from drf_spectacular.utils import extend_schema, inline_serializer

from .validators import validate_comparison_request
from .services import ComparisonService
from .serializers import FlightComparisonSerializer

class FlightCompareView(APIView):
    # Allow public access so unauthenticated users can still compare flights
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Compare Flights",
        description="Submit 2 to 4 flight_instance_ids to get side-by-side comparison data including fares, seats, and travel times.",
        request=inline_serializer(
            name='ComparisonRequest',
            fields={
                'flight_instance_ids': serializers.ListField(
                    child=serializers.IntegerField(),
                    min_length=2,
                    max_length=4,
                    help_text="List of 2 to 4 Flight Instance IDs to compare."
                )
            }
        ),
        responses={200: FlightComparisonSerializer(many=True)},
        tags=["Comparison"]
    )
    def post(self, request):
        # Extract IDs from the request body
        flight_instance_ids = request.data.get("flight_instance_ids", [])
        
        # Validate the input (Raises ValidationError if something is wrong)
        instances = validate_comparison_request(flight_instance_ids)
        
        # Build the raw dictionary data via our Service
        comparison_data = ComparisonService.build_comparison_data(instances)
        
        # Serialize the dictionary to ensure it strictly matches our JSON schema
        serializer = FlightComparisonSerializer(comparison_data, many=True)
        
        return Response(serializer.data)

