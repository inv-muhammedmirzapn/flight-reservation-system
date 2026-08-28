import datetime
from django.utils import timezone
from django.db.models import Count, Q, OuterRef, Subquery, IntegerField
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import serializers
from drf_spectacular.utils import extend_schema, inline_serializer, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from .models import FlightInstance, Fare, FlightLeg, Seat
from .services_currency import CurrencyService


class CalendarDayFareSerializer(serializers.Serializer):
    min_fare = serializers.FloatField()
    currency = serializers.CharField()

class FlightFaresCalendarView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Flight fare calendar",
        description="Returns the minimum fare per date for a given route and cabin class, over a date range.",
        parameters=[
            OpenApiParameter("source", OpenApiTypes.STR, OpenApiParameter.QUERY, description="Departure airport IATA code (e.g. DEL)"),
            OpenApiParameter("destination", OpenApiTypes.STR, OpenApiParameter.QUERY, description="Arrival airport IATA code (e.g. BOM)"),
            OpenApiParameter("start_date", OpenApiTypes.DATE, OpenApiParameter.QUERY, description="Start of date range (YYYY-MM-DD). Defaults to today."),
            OpenApiParameter("end_date", OpenApiTypes.DATE, OpenApiParameter.QUERY, description="End of date range (YYYY-MM-DD). Defaults to 90 days after start_date."),
            OpenApiParameter("cabin_class", OpenApiTypes.STR, OpenApiParameter.QUERY, description="Cabin class: Economy (default), Business, First"),
            OpenApiParameter("stops", OpenApiTypes.INT, OpenApiParameter.QUERY, description="Number of stops: 0 = non-stop, 1 = one stop, 2 = two or more"),
            OpenApiParameter("airlines", OpenApiTypes.STR, OpenApiParameter.QUERY, description="Comma-separated airline names to filter (e.g. IndiGo,Air India)"),
            OpenApiParameter("max_fare", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, description="Maximum fare price to include in results"),
            OpenApiParameter("waitlist_mode", OpenApiTypes.STR, OpenApiParameter.QUERY, description="Filter by seat availability: available_only or waitlisted_only"),
        ],
    )
    def get(self, request, *args, **kwargs) -> Response:
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        source = request.query_params.get("source", "").strip().upper()
        destination = request.query_params.get("destination", "").strip().upper()
        cabin_class = request.query_params.get("cabin_class", "Economy")
        stops_param = request.query_params.get("stops", "").strip()
        airlines_param = request.query_params.get("airlines", request.query_params.get("airline", "")).strip()
        max_fare_param = request.query_params.get("max_fare", request.query_params.get("max_price", "")).strip()
        waitlist_mode = request.query_params.get("waitlist_mode", request.query_params.get("waitlistMode", "")).strip()

        if not start_date:
            start_date = str(timezone.now().date())
        if not end_date:
            try:
                s_date = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
                end_date = str(s_date + datetime.timedelta(days=90))
            except ValueError:
                end_date = str((timezone.now() + datetime.timedelta(days=90)).date())
            
        qs = FlightInstance.objects.filter(
            date__range=[start_date, end_date]
        ).exclude(status='CANCELLED')

        if source:
            qs = qs.filter(flight__legs__departure_airport__iata_code__iexact=source, flight__legs__leg_order=1)
        if destination:
            qs = qs.filter(flight__legs__arrival_airport__iata_code__iexact=destination)
            
        if stops_param != "":
            try:
                stops_num = int(stops_param)
                total_legs_subquery = Subquery(
                    FlightLeg.objects.filter(flight_id=OuterRef("flight_id"))
                    .values("flight_id")
                    .annotate(cnt=Count("id"))
                    .values("cnt")[:1],
                    output_field=IntegerField()
                )
                qs = qs.annotate(total_legs=total_legs_subquery)
                if stops_num == 0:
                    qs = qs.filter(total_legs=1)
                elif stops_num == 1:
                    qs = qs.filter(total_legs=2)
                elif stops_num >= 2:
                    qs = qs.filter(total_legs__gte=3)
            except ValueError:
                pass

        if airlines_param:
            airline_list = [a.strip() for a in airlines_param.split(",") if a.strip()]
            if airline_list:
                airline_q = Q()
                for a in airline_list:
                    airline_q |= Q(flight__airline__airline_name__icontains=a)
                qs = qs.filter(airline_q)

        cabin_norm = (cabin_class or "ECONOMY").strip().upper().replace(" ", "_")
        if "BUSINESS" in cabin_norm:
            class_key = "BUSINESS"
        elif "FIRST" in cabin_norm:
            class_key = "FIRST"
        else:
            class_key = "ECONOMY"

        from django.db.models import Exists, OuterRef
        if class_key:
            has_fare = Exists(
                Fare.objects.filter(flight_instance=OuterRef('pk'), cabin_class=class_key)
            )
            qs = qs.filter(has_fare)

        if waitlist_mode in ["available_only", "waitlisted_only"]:
            has_any_seats = Exists(Seat.objects.filter(flight_instance=OuterRef('pk')))
            
            if class_key:
                has_avail_class_seats = Exists(
                    Seat.objects.filter(flight_instance=OuterRef('pk'), seat_class=class_key, status="AVAILABLE")
                )
                fare_gt_zero = Exists(
                    Fare.objects.filter(flight_instance=OuterRef('pk'), cabin_class=class_key, available_seats__gt=0)
                )
                fare_lte_zero = Exists(
                    Fare.objects.filter(flight_instance=OuterRef('pk'), cabin_class=class_key, available_seats__lte=0)
                )
                has_fare = Exists(
                    Fare.objects.filter(flight_instance=OuterRef('pk'), cabin_class=class_key)
                )

                if waitlist_mode == "available_only":
                    avail_q = has_avail_class_seats | (~has_any_seats & fare_gt_zero)
                    qs = qs.filter(has_fare & avail_q)
                elif waitlist_mode == "waitlisted_only":
                    waitlist_q = (has_any_seats & ~has_avail_class_seats) | (~has_any_seats & fare_lte_zero)
                    qs = qs.filter(has_fare & waitlist_q)
            else:
                has_any_avail_seats = Exists(
                    Seat.objects.filter(flight_instance=OuterRef('pk'), status="AVAILABLE")
                )
                any_fare_gt_zero = Exists(
                    Fare.objects.filter(flight_instance=OuterRef('pk'), available_seats__gt=0)
                )
                any_fare_lte_zero = Exists(
                    Fare.objects.filter(flight_instance=OuterRef('pk'), available_seats__lte=0)
                )

                if waitlist_mode == "available_only":
                    qs = qs.filter(has_any_avail_seats | (~has_any_seats & any_fare_gt_zero))
                elif waitlist_mode == "waitlisted_only":
                    qs = qs.filter((has_any_seats & ~has_any_avail_seats) | (~has_any_seats & any_fare_lte_zero))

        qs = qs.distinct().prefetch_related('fares', 'flight', 'seats')

        target_currency = CurrencyService.get_user_currency(request.user)

        max_fare_val = None
        if max_fare_param:
            try:
                max_fare_val = float(max_fare_param)
                max_fare_val = float(CurrencyService.convert_amount(max_fare_val, target_currency, "INR"))
            except ValueError:
                pass

        now = timezone.now()
        fares_by_date = {}
        for instance in qs:
            if instance.scheduled_departure and instance.scheduled_departure <= now:
                continue

            date_str = str(instance.date)
            instance_fares = instance.fares.all()
            instance_seats = instance.seats.all()
            
            matching_prices = []
            for f in instance_fares:
                if f.cabin_class != class_key:
                    continue
                if max_fare_val is not None and float(f.price) > max_fare_val:
                    continue
                
                # Check seat table in-memory if seat records exist for this specific class_key
                seats_for_class = [s for s in instance_seats if s.seat_class == class_key]
                if seats_for_class:
                    is_avail = any(s.status == "AVAILABLE" for s in seats_for_class)
                else:
                    is_avail = f.available_seats > 0

                if waitlist_mode == "available_only" and not is_avail:
                    continue
                elif waitlist_mode == "waitlisted_only" and is_avail:
                    continue
                
                # Convert price to user currency
                display_price = CurrencyService.convert_amount(f.price, f.currency, target_currency)
                matching_prices.append(float(display_price))

            if matching_prices:
                min_price = min(matching_prices)
                if date_str not in fares_by_date:
                    fares_by_date[date_str] = min_price
                else:
                    fares_by_date[date_str] = min(fares_by_date[date_str], min_price)
                    
        # Wrap the result
        fares_with_currency = {
            date_str: {
                "min_fare": price,
                "currency": target_currency
            } for date_str, price in fares_by_date.items()
        }
                    
        return Response(fares_with_currency, status=200)

class FlightFareBoundsView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter(name="source", type=str, required=False, description="Departure airport IATA code"),
            OpenApiParameter(name="destination", type=str, required=False, description="Arrival airport IATA code"),
            OpenApiParameter(name="date", type=str, required=False, description="Date of the flight (YYYY-MM-DD)"),
            OpenApiParameter(name="cabin_class", type=str, required=False, description="Cabin class (Economy, Business, First)"),
            OpenApiParameter(name="stops", type=str, required=False, description="Number of stops (0, 1, or 2+)"),
            OpenApiParameter(name="airlines", type=str, required=False, description="Comma-separated airline names"),
        ],
        responses={
            200: inline_serializer(
                name="FlightFareBoundsResponse",
                fields={
                    "min": serializers.FloatField(),
                    "max": serializers.FloatField(),
                    "currency": serializers.CharField(),
                }
            )
        }
    )
    def get(self, request, *args, **kwargs) -> Response:
        source = request.query_params.get("source", "").strip().upper()
        destination = request.query_params.get("destination", "").strip().upper()
        date = request.query_params.get("date", "").strip()
        cabin_class = request.query_params.get("cabin_class", "Economy")
        stops_param = request.query_params.get("stops", "").strip()
        airlines_param = request.query_params.get("airlines", request.query_params.get("airline", "")).strip()

        qs = FlightInstance.objects.exclude(status='CANCELLED')

        if source:
            qs = qs.filter(flight__legs__departure_airport__iata_code__iexact=source, flight__legs__leg_order=1)
        if destination:
            qs = qs.filter(flight__legs__arrival_airport__iata_code__iexact=destination)
        if date:
            qs = qs.filter(date=date)

        if stops_param != "":
            try:
                stops_num = int(stops_param)
                total_legs_subquery = Subquery(
                    FlightLeg.objects.filter(flight_id=OuterRef("flight_id"))
                    .values("flight_id")
                    .annotate(cnt=Count("id"))
                    .values("cnt")[:1],
                    output_field=IntegerField()
                )
                qs = qs.annotate(total_legs=total_legs_subquery)
                if stops_num == 0:
                    qs = qs.filter(total_legs=1)
                elif stops_num == 1:
                    qs = qs.filter(total_legs=2)
                elif stops_num >= 2:
                    qs = qs.filter(total_legs__gte=3)
            except ValueError:
                pass

        if airlines_param:
            airline_list = [a.strip() for a in airlines_param.split(",") if a.strip()]
            if airline_list:
                airline_q = Q()
                for a in airline_list:
                    airline_q |= Q(flight__airline__airline_name__icontains=a)
                qs = qs.filter(airline_q)

        qs = qs.distinct().prefetch_related('fares', 'flight')

        cabin_norm = (cabin_class or "ECONOMY").strip().upper()
        if "BUSINESS" in cabin_norm:
            class_key = "BUSINESS"
        elif "FIRST" in cabin_norm:
            class_key = "FIRST"
        else:
            class_key = "ECONOMY"

        min_val = float('inf')
        max_val = float('-inf')

        target_currency = CurrencyService.get_user_currency(request.user)

        for instance in qs:
            instance_fares = instance.fares.all()
            prices = []
            for f in instance_fares:
                if f.cabin_class == class_key:
                    # Convert price to target currency
                    display_price = CurrencyService.convert_amount(f.price, f.currency, target_currency)
                    prices.append(float(display_price))

            if prices:
                min_val = min(min_val, *prices)
                max_val = max(max_val, *prices)
                
        if min_val == float('inf'):
            min_val = 0
            max_val = 100000
            
        return Response({"min": min_val, "max": max_val, "currency": target_currency}, status=200)
