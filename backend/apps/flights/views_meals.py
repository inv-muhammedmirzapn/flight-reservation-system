from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from .models import FlightInstance, Fare, FoodItem, FlightMeal

class FlightMealsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, instance_id, *args, **kwargs) -> Response:
        instance = get_object_or_404(FlightInstance, id=instance_id)
        cabin_class_param = request.query_params.get("cabin_class", "ECONOMY").strip().upper()
        
        if "BUSINESS" in cabin_class_param:
            cabin_class = "BUSINESS"
        elif "FIRST" in cabin_class_param:
            cabin_class = "FIRST"
        else:
            cabin_class = "ECONOMY"

        fare = instance.fares.filter(cabin_class=cabin_class).first()
        meal_included = fare.meal_included if fare else False

        airline = instance.flight.airline
        food_items_qs = FoodItem.objects.filter(airline=airline)
        flight_meals_qs = instance.meals.all().prefetch_related('items__food_item')
        legs_qs = instance.flight.legs.all().order_by('leg_order')

        food_items_data = [
            {
                "id": item.id,
                "name": item.name,
                "price": str(item.price),
                "currency": item.currency,
                "is_veg": item.is_veg,
                "is_halal": item.is_halal,
                "is_vegan": item.is_vegan,
                "image": item.image.url if item.image else None,
            }
            for item in food_items_qs
        ]

        flight_meals_data = [
            {
                "id": meal.id,
                "name": meal.name,
                "price": str(meal.price),
                "items": [
                    {
                        "name": item.food_item.name,
                        "quantity": item.quantity,
                    }
                    for item in meal.items.all()
                ],
            }
            for meal in flight_meals_qs
        ]

        legs_data = [
            {
                "id": leg.id,
                "leg_order": leg.leg_order,
                "departure_airport": leg.departure_airport.iata_code,
                "departure_city": leg.departure_airport.city,
                "arrival_airport": leg.arrival_airport.iata_code,
                "arrival_city": leg.arrival_airport.city,
            }
            for leg in legs_qs
        ]

        return Response({
            "flight_id": instance.id,
            "cabin_class": cabin_class,
            "meal_included": meal_included,
            "legs": legs_data,
            "food_items": food_items_data,
            "flight_meals": flight_meals_data,
        }, status=200)
