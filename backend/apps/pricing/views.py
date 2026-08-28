from datetime import date
from decimal import Decimal

from django.utils import timezone
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.flights.permissions import IsAdminOrSuperuser
from apps.flights.pagination import StandardPagination
from apps.flights.models import RouteFareClass
from apps.pricing.models import DynamicPricingConfig, HolidayEvent, DynamicPriceLog
from apps.pricing.serializers import (
    DynamicPricingConfigSerializer,
    HolidayEventSerializer,
    DynamicPriceLogSerializer,
)
from apps.pricing.services import DynamicPricingStrategy, reevaluate_route_fares_dynamically


class DynamicPricingConfigViewSet(viewsets.ModelViewSet):
    queryset = DynamicPricingConfig.objects.all()
    serializer_class = DynamicPricingConfigSerializer
    permission_classes = [IsAdminOrSuperuser]

    @action(detail=False, methods=["post"], url_path="evaluate-all")
    def evaluate_all(self, request):
        """Triggers manual re-evaluation of all future fares across all routes."""
        count = reevaluate_route_fares_dynamically()
        return Response({"message": f"Successfully re-evaluated dynamic pricing. Updated {count} fares."})

    @action(detail=False, methods=["post"], url_path="simulate")
    def simulate(self, request):
        """
        Simulator endpoint for testing dynamic pricing breakdowns against hypothetical parameters.
        Expected JSON payload:
        {
          "route_fare_id": int (optional),
          "base_price": decimal (optional if route_fare_id provided),
          "origin_country": str (optional),
          "destination_country": str (optional),
          "flight_date": YYYY-MM-DD (optional, default today),
          "mock_booking_count": int (optional)
        }
        """
        route_fare_id = request.data.get("route_fare_id")
        flight_date_str = request.data.get("flight_date")
        mock_booking_count = request.data.get("mock_booking_count")

        if flight_date_str:
            try:
                flight_date = date.fromisoformat(flight_date_str)
            except ValueError:
                return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)
        else:
            flight_date = timezone.now().date()

        route_fare = None
        if route_fare_id:
            route_fare = RouteFareClass.objects.filter(id=route_fare_id).first()

        if not route_fare:
            base_price_val = request.data.get("base_price", "5000.00")
            try:
                base_price = Decimal(str(base_price_val))
            except Exception:
                base_price = Decimal("5000.00")

            class DummyAirport:
                def __init__(self, country):
                    self.country = country

            class DummyRoute:
                def __init__(self, origin_c, dest_c):
                    self.origin_airport = DummyAirport(origin_c)
                    self.destination_airport = DummyAirport(dest_c)

            class DummyRouteFare:
                def __init__(self, bp, orig_c, dest_c):
                    self.base_price = bp
                    self.route = DummyRoute(orig_c, dest_c)

            route_fare = DummyRouteFare(
                bp=base_price,
                orig_c=request.data.get("origin_country", "India"),
                dest_c=request.data.get("destination_country", "Germany")
            )

        strategy = DynamicPricingStrategy()
        mock_count = int(mock_booking_count) if mock_booking_count is not None else None
        breakdown = strategy.calculate_price_breakdown(
            route_fare=route_fare,
            flight_date=flight_date,
            mock_booking_count=mock_count
        )

        currency = getattr(route_fare, "currency", "INR") if route_fare else "INR"
        w_m = float(breakdown.get("weekend_multiplier", 1.0))
        h_m = float(breakdown.get("holiday_multiplier", 1.0))
        d_p = float(breakdown.get("demand_surge_percent", 0.0))
        combined = round(w_m * h_m * (1.0 + (d_p / 100.0)), 2)

        breakdown["currency"] = currency
        breakdown["final_calculated_price"] = str(breakdown["final_price"])
        breakdown["combined_multiplier"] = combined
        breakdown["holiday_applied"] = breakdown.get("holiday_name", "")
        breakdown["is_weekend"] = flight_date.isoweekday() in [6, 7]

        return Response(breakdown)


class HolidayEventViewSet(viewsets.ModelViewSet):
    queryset = HolidayEvent.objects.all()
    serializer_class = HolidayEventSerializer
    permission_classes = [IsAdminOrSuperuser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["start_date", "end_date", "name"]


class DynamicPriceLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DynamicPriceLog.objects.select_related(
        "flight_instance", "flight_instance__flight", "fare"
    ).all()
    serializer_class = DynamicPriceLogSerializer
    permission_classes = [IsAdminOrSuperuser]
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "flight_instance__flight__flight_no", "cabin_class", "holiday_applied"
    ]
    ordering_fields = ["calculated_at", "final_calculated_price"]