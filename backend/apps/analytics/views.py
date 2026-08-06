from datetime import date as date_type

from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.flights.permissions import IsAdminOrSuperuser

from .serializers import (
    SummaryStatsSerializer,
    MonthlyRevenueSerializer,
    PopularRouteSerializer,
    FlightOccupancySerializer,
    PeakBookingHourSerializer,
    AirlinePerformanceSerializer,
    AircraftUtilizationSerializer,
)
from .services import (
    get_summary_stats,
    get_monthly_revenue,
    get_popular_routes,
    get_flight_occupancy,
    get_peak_booking_hours,
    get_airline_performance,
    get_aircraft_utilization,
)

# ─── Common filter OpenAPI params (reused across views) ──────────────────────

_FILTER_PARAMS = [
    OpenApiParameter(
        name="start_date",
        description="Filter from this date (YYYY-MM-DD, inclusive). Defaults to unfiltered.",
        required=False,
        type=str,
        location=OpenApiParameter.QUERY,
    ),
    OpenApiParameter(
        name="end_date",
        description="Filter up to this date (YYYY-MM-DD, inclusive). Defaults to unfiltered.",
        required=False,
        type=str,
        location=OpenApiParameter.QUERY,
    ),
    OpenApiParameter(
        name="airline_id",
        description="Filter by Airline primary key.",
        required=False,
        type=int,
        location=OpenApiParameter.QUERY,
    ),
    OpenApiParameter(
        name="aircraft_id",
        description="Filter by Aircraft primary key.",
        required=False,
        type=int,
        location=OpenApiParameter.QUERY,
    ),
]


def _parse_filters(request):
    """
    Parse optional date/airline/aircraft/route query params from a request.
    Returns a dict of keyword arguments ready to spread into service calls.
    """
    params = request.query_params

    def safe_date(key):
        raw = params.get(key)
        if not raw:
            return None
        try:
            from datetime import datetime
            return datetime.strptime(raw, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None

    def safe_int(key):
        raw = params.get(key)
        try:
            return int(raw) if raw else None
        except (ValueError, TypeError):
            return None

    return {
        "start_date": safe_date("start_date"),
        "end_date": safe_date("end_date"),
        "airline_id": safe_int("airline_id"),
        "aircraft_id": safe_int("aircraft_id"),
    }


# ─── Views ────────────────────────────────────────────────────────────────────

class AnalyticsSummaryView(APIView):
    """
    Returns high-level booking analytics summary:
    total revenue, total bookings, confirmed/cancelled counts, and cancellation rate.
    """
    permission_classes = [IsAdminOrSuperuser]

    @extend_schema(
        summary="Booking Analytics Summary",
        description=(
            "Returns aggregated summary statistics: total revenue from confirmed bookings, "
            "total booking count, confirmed/cancelled breakdown, and cancellation rate. "
            "All fields can be filtered by start_date, end_date, airline_id, or aircraft_id."
        ),
        parameters=_FILTER_PARAMS,
        responses={200: SummaryStatsSerializer},
        tags=["Analytics"],
    )
    def get(self, request):
        filters = _parse_filters(request)
        data = get_summary_stats(**filters)
        serializer = SummaryStatsSerializer(data)
        return Response(serializer.data)


class MonthlyRevenueView(APIView):
    """
    Returns monthly revenue for the last 12 months (confirmed bookings only).
    """
    permission_classes = [IsAdminOrSuperuser]

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
            ),
            *_FILTER_PARAMS,
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

        filters = _parse_filters(request)
        data = get_monthly_revenue(months=months, **filters)
        serializer = MonthlyRevenueSerializer(data, many=True)
        return Response(serializer.data)


class PopularRoutesView(APIView):
    """
    Returns the most popular flight routes by confirmed booking count.
    """
    permission_classes = [IsAdminOrSuperuser]

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
            ),
            *_FILTER_PARAMS,
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

        filters = _parse_filters(request)
        data = get_popular_routes(top_n=top_n, **filters)
        serializer = PopularRouteSerializer(data, many=True)
        return Response(serializer.data)


class FlightOccupancyView(APIView):
    """
    Returns per-flight occupancy rates for the most-booked flights.
    """
    permission_classes = [IsAdminOrSuperuser]

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
            ),
            *_FILTER_PARAMS,
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

        filters = _parse_filters(request)
        data = get_flight_occupancy(top_n=top_n, **filters)
        serializer = FlightOccupancySerializer(data, many=True)
        return Response(serializer.data)


class PeakBookingHoursView(APIView):
    """
    Returns booking volume grouped by hour-of-day (0–23, based on created_at UTC).
    """
    permission_classes = [IsAdminOrSuperuser]

    @extend_schema(
        summary="Peak Booking Hours",
        description=(
            "Returns the number of bookings made during each hour of the day (UTC). "
            "All 24 hours are always returned; hours with no bookings show 0."
        ),
        parameters=_FILTER_PARAMS,
        responses={200: PeakBookingHourSerializer(many=True)},
        tags=["Analytics"],
    )
    def get(self, request):
        filters = _parse_filters(request)
        data = get_peak_booking_hours(**filters)
        serializer = PeakBookingHourSerializer(data, many=True)
        return Response(serializer.data)


class AirlinePerformanceView(APIView):
    """
    Returns per-airline performance breakdown: revenue, bookings, cancellation rate,
    and average seat occupancy for the top N airlines.
    """
    permission_classes = [IsAdminOrSuperuser]

    @extend_schema(
        summary="Airline Performance",
        description=(
            "Returns aggregated performance metrics per airline (top N by confirmed bookings): "
            "total revenue, booking count, cancellation rate, and average occupancy. "
            "Filterable by start_date and end_date."
        ),
        parameters=[
            OpenApiParameter(
                name="top",
                description="Number of top airlines to return (default: 10)",
                required=False,
                type=int,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="start_date",
                description="Filter from this date (YYYY-MM-DD). Defaults to unfiltered.",
                required=False,
                type=str,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="end_date",
                description="Filter up to this date (YYYY-MM-DD). Defaults to unfiltered.",
                required=False,
                type=str,
                location=OpenApiParameter.QUERY,
            ),
        ],
        responses={200: AirlinePerformanceSerializer(many=True)},
        tags=["Analytics"],
    )
    def get(self, request):
        try:
            top_n = int(request.query_params.get("top", 10))
            if top_n < 1 or top_n > 100:
                top_n = 10
        except (TypeError, ValueError):
            top_n = 10

        def safe_date(key):
            raw = request.query_params.get(key)
            if not raw:
                return None
            try:
                from datetime import datetime
                return datetime.strptime(raw, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                return None

        data = get_airline_performance(
            top_n=top_n,
            start_date=safe_date("start_date"),
            end_date=safe_date("end_date"),
        )
        serializer = AirlinePerformanceSerializer(data, many=True)
        return Response(serializer.data)


class AircraftUtilizationView(APIView):
    """
    Returns per-aircraft utilization stats: total flights, average occupancy,
    and cabin-class fill rates for the top N most-flown aircraft.
    """
    permission_classes = [IsAdminOrSuperuser]

    @extend_schema(
        summary="Aircraft Utilization",
        description=(
            "Returns utilization metrics per aircraft (top N by flight count): "
            "total flights operated, average seat occupancy, and cabin fill rates "
            "(economy / business / first class). Filterable by start_date and end_date."
        ),
        parameters=[
            OpenApiParameter(
                name="top",
                description="Number of top aircraft to return (default: 10)",
                required=False,
                type=int,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="start_date",
                description="Filter from this date (YYYY-MM-DD). Defaults to unfiltered.",
                required=False,
                type=str,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="end_date",
                description="Filter up to this date (YYYY-MM-DD). Defaults to unfiltered.",
                required=False,
                type=str,
                location=OpenApiParameter.QUERY,
            ),
        ],
        responses={200: AircraftUtilizationSerializer(many=True)},
        tags=["Analytics"],
    )
    def get(self, request):
        try:
            top_n = int(request.query_params.get("top", 10))
            if top_n < 1 or top_n > 100:
                top_n = 10
        except (TypeError, ValueError):
            top_n = 10

        def safe_date(key):
            raw = request.query_params.get(key)
            if not raw:
                return None
            try:
                from datetime import datetime
                return datetime.strptime(raw, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                return None

        data = get_aircraft_utilization(
            top_n=top_n,
            start_date=safe_date("start_date"),
            end_date=safe_date("end_date"),
        )
        serializer = AircraftUtilizationSerializer(data, many=True)
        return Response(serializer.data)