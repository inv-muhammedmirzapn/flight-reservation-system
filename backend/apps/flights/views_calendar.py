import datetime
from django.utils import timezone
from django.db.models import Count, Q, OuterRef, Subquery, IntegerField
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import FlightInstance, Fare, FlightLeg

class FlightFaresCalendarView(APIView):
    permission_classes = [AllowAny]
    
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

        cabin_norm = (cabin_class or "ECONOMY").strip().upper()
        if "BUSINESS" in cabin_norm:
            class_key = "BUSINESS"
        elif "FIRST" in cabin_norm:
            class_key = "FIRST"
        else:
            class_key = "ECONOMY"

        if waitlist_mode == "available_only":
            qs = qs.filter(Q(seats__seat_class=class_key, seats__status="AVAILABLE") | Q(fares__cabin_class=class_key, fares__available_seats__gt=0))
        elif waitlist_mode == "waitlisted_only":
            qs = qs.filter(Q(fares__cabin_class=class_key, fares__available_seats__lte=0) | ~Q(seats__seat_class=class_key, seats__status="AVAILABLE"))

        qs = qs.distinct().prefetch_related('fares', 'flight', 'seats')

        max_fare_val = None
        if max_fare_param:
            try:
                max_fare_val = float(max_fare_param)
            except ValueError:
                pass
        
        fares_by_date = {}
        for instance in qs:
            date_str = str(instance.date)
            instance_fares = instance.fares.all()
            
            matching_prices = []
            for f in instance_fares:
                if f.cabin_class != class_key:
                    continue
                if max_fare_val is not None and float(f.price) > max_fare_val:
                    continue
                
                if instance.seats.exists():
                    is_avail = instance.seats.filter(seat_class=f.cabin_class, status="AVAILABLE").exists()
                else:
                    is_avail = f.available_seats > 0

                if waitlist_mode == "available_only" and not is_avail:
                    continue
                elif waitlist_mode == "waitlisted_only" and is_avail:
                    continue

                matching_prices.append(float(f.price))

            if matching_prices:
                min_price = min(matching_prices)
                if date_str not in fares_by_date:
                    fares_by_date[date_str] = min_price
                else:
                    fares_by_date[date_str] = min(fares_by_date[date_str], min_price)
                    
        return Response(fares_by_date, status=200)

class FlightFareBoundsView(APIView):
    permission_classes = [AllowAny]

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

        for instance in qs:
            instance_fares = instance.fares.all()
            prices = [float(f.price) for f in instance_fares if f.cabin_class == class_key]

            if prices:
                min_val = min(min_val, *prices)
                max_val = max(max_val, *prices)
                
        if min_val == float('inf'):
            min_val = 0
            max_val = 100000
            
        return Response({"min": min_val, "max": max_val}, status=200)
