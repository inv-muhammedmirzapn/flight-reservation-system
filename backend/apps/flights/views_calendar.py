from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import FlightInstance, Fare

class FlightFaresCalendarView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs) -> Response:
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        source = request.query_params.get("source", "").strip().upper()
        destination = request.query_params.get("destination", "").strip().upper()
        cabin_class = request.query_params.get("cabin_class", "Economy")
        
        if not start_date or not end_date:
            return Response({"error": "start_date and end_date are required."}, status=400)
            
        qs = FlightInstance.objects.filter(
            date__range=[start_date, end_date],
            status__in=['SCHEDULED', 'DELAYED', 'BOARDING']
        )
        if source:
            qs = qs.filter(flight__legs__departure_airport__iata_code=source, flight__legs__leg_order=1)
        if destination:
            qs = qs.filter(flight__legs__arrival_airport__iata_code=destination)
            
        qs = qs.prefetch_related('fares')
        
        class_map = {'Economy': 'ECONOMY', 'Business': 'BUSINESS', 'First': 'FIRST'}
        class_key = class_map.get(cabin_class, 'ECONOMY')
        
        fares_by_date = {}
        for instance in qs:
            date_str = str(instance.date)
            # Find min price for cabin class
            prices = [float(f.price) for f in instance.fares.all() if f.cabin_class == class_key]
            
            if prices:
                min_price = min(prices)
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

        qs = FlightInstance.objects.filter(
            status__in=['SCHEDULED', 'DELAYED', 'BOARDING']
        )
        if source:
            qs = qs.filter(flight__legs__departure_airport__iata_code=source, flight__legs__leg_order=1)
        if destination:
            qs = qs.filter(flight__legs__arrival_airport__iata_code=destination)
        if date:
            qs = qs.filter(date=date)
            
        qs = qs.prefetch_related('fares')

        class_map = {'Economy': 'ECONOMY', 'Business': 'BUSINESS', 'First': 'FIRST'}
        class_key = class_map.get(cabin_class, 'ECONOMY')

        min_val = float('inf')
        max_val = float('-inf')

        for instance in qs:
            prices = [float(f.price) for f in instance.fares.all() if f.cabin_class == class_key]
            if prices:
                min_val = min(min_val, *prices)
                max_val = max(max_val, *prices)
                
        if min_val == float('inf'):
            min_val = 0
            max_val = 100000
            
        return Response({"min": min_val, "max": max_val}, status=200)
