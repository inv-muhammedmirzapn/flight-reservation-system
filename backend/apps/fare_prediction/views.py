import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .services import FarePredictionService

logger = logging.getLogger(__name__)


#This creates a REST API endpoint using Django REST Framework.
class FarePredictionView(APIView):
    """
    GET /api/fare-prediction/<flight_instance_id>/
    Query param: cabin_class (optional, defaults to ECONOMY)

    Returns a fare prediction for the given flight instance and cabin class.
    Does NOT change any price — read-only advisory endpoint.
    """
    permission_classes = [AllowAny]  # Public endpoint — no login required

    def get(self, request, flight_instance_id):
        # Read cabin_class from query param, default to ECONOMY
        cabin_class = request.query_params.get("cabin_class", "ECONOMY").upper()

        # Validate cabin class
        valid_classes = ["ECONOMY", "BUSINESS", "FIRST"]
        if cabin_class not in valid_classes:
            return Response(
                {"error": f"Invalid cabin_class. Must be one of: {valid_classes}"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Call the service
        try:
            result = FarePredictionService.predict_fare(
                flight_instance_id=flight_instance_id,
                cabin_class=cabin_class,
            )
            return Response(result, status=status.HTTP_200_OK)

        except ValueError as e:
            # Flight instance not found
            return Response(
                {"error": str(e)},
                status=status.HTTP_404_NOT_FOUND
            )

        except Exception:
            logger.exception(
                "Unexpected error in FarePredictionView for flight_instance_id=%s",
                flight_instance_id
            )
            return Response(
                {"error": "An unexpected error occurred while generating the prediction."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
