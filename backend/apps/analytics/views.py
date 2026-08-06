
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    SummaryStatsSerializer,
    MonthlyRevenueSerializer,
    PopularRouteSerializer,
    FlightOccupancySerializer,
    PeakBookingHourSerializer,
)
from .services import (
    get_summary_stats,
    get_monthly_revenue,
    get_popular_routes,
    get_flight_occupancy,
    get_peak_booking_hours,
)


class AnalyticsSummaryView(APIView):
    """
    Returns high-level booking analytics summary:
    total revenue, total bookings, confirmed/cancelled counts, and cancellation rate.
    """
    permission_classes = [IsAdminUser]

    @extend_schema(
        summary="Booking Analytics Summary",
        description=(
            "Returns aggregated summary statistics: total revenue from confirmed bookings, "
            "total booking count, confirmed/cancelled breakdown, and cancellation rate."
        ),
        responses={200: SummaryStatsSerializer},
        tags=["Analytics"],
    )
    def get(self, request):
        data = get_summary_stats()
        serializer = SummaryStatsSerializer(data)
        return Response(serializer.data)


class MonthlyRevenueView(APIView):
    """
    Returns monthly revenue for the last 12 months (confirmed bookings only).
    """
    permission_classes = [IsAdminUser]

    @extend_schema(
        summary="Monthly Revenue",
        description="Returns revenue grouped by calendar month for the last 12 months.",
        parameters=[
            OpenApiParameter(
                name="months",
                description="Number of past months to include (default: 12)",
                required=False,
                type=int,
                location=OpenApiParameter.QUERY,
            )
        ],
        responses={200: MonthlyRevenueSerializer(many=True)},
        tags=["Analytics"],
    )
    def get(self, request):
        try:
            months = int(request.query_params.get("months", 12))
            if months < 1 or months > 60:
                months = 12
        except (TypeError, ValueError):
            months = 12

        data = get_monthly_revenue(months=months)
        serializer = MonthlyRevenueSerializer(data, many=True)
        return Response(serializer.data)


class PopularRoutesView(APIView):
    """
    Returns the most popular flight routes by confirmed booking count.
    """
    permission_classes = [IsAdminUser]

    @extend_schema(
        summary="Popular Routes",
        description="Returns the top N routes ordered by number of confirmed bookings.",
        parameters=[
            OpenApiParameter(
                name="top",
                description="Number of top routes to return (default: 10)",
                required=False,
                type=int,
                location=OpenApiParameter.QUERY,
            )
        ],
        responses={200: PopularRouteSerializer(many=True)},
        tags=["Analytics"],
    )
    def get(self, request):
        try:
            top_n = int(request.query_params.get("top", 10))
            if top_n < 1 or top_n > 100:
                top_n = 10
        except (TypeError, ValueError):
            top_n = 10

        data = get_popular_routes(top_n=top_n)
        serializer = PopularRouteSerializer(data, many=True)
        return Response(serializer.data)


class FlightOccupancyView(APIView):
    """
    Returns per-flight occupancy rates for the most-booked flights.
    """
    permission_classes = [IsAdminUser]

    @extend_schema(
        summary="Flight Occupancy",
        description=(
            "Returns occupancy statistics (booked_seats / total_seats) for the "
            "top N most-booked flights."
        ),
        parameters=[
            OpenApiParameter(
                name="top",
                description="Number of flights to return (default: 20)",
                required=False,
                type=int,
                location=OpenApiParameter.QUERY,
            )
        ],
        responses={200: FlightOccupancySerializer(many=True)},
        tags=["Analytics"],
    )
    def get(self, request):
        try:
            top_n = int(request.query_params.get("top", 20))
            if top_n < 1 or top_n > 200:
                top_n = 20
        except (TypeError, ValueError):
            top_n = 20

        data = get_flight_occupancy(top_n=top_n)
        serializer = FlightOccupancySerializer(data, many=True)
        return Response(serializer.data)


class PeakBookingHoursView(APIView):
    """
    Returns booking volume grouped by hour-of-day (0–23, based on created_at UTC).
    """
    permission_classes = [IsAdminUser]

    @extend_schema(
        summary="Peak Booking Hours",
        description=(
            "Returns the number of bookings made during each hour of the day (UTC). "
            "All 24 hours are always returned; hours with no bookings show 0."
        ),
        responses={200: PeakBookingHourSerializer(many=True)},
        tags=["Analytics"],
    )
    def get(self, request):
        data = get_peak_booking_hours()
        serializer = PeakBookingHourSerializer(data, many=True)
        return Response(serializer.data)