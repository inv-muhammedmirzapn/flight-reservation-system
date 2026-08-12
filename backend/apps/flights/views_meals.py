from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404

from .models import FlightInstance, Fare, FoodItem, FlightMeal
from .services_currency import CurrencyService


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

        # Resolve target currency based on user profile country or default USD
        target_currency = CurrencyService.get_user_currency(request.user)

        airline = instance.flight.airline
        food_items_qs = FoodItem.objects.filter(airline=airline)
        flight_meals_qs = instance.meals.all().prefetch_related('items__food_item')
        legs_qs = instance.flight.legs.all().order_by('leg_order')

        food_items_data = []
        for item in food_items_qs:
            display_price = CurrencyService.convert_amount(item.price, item.currency, target_currency)
            food_items_data.append({
                "id": item.id,
                "name": item.name,
                "price": str(item.price),
                "currency": item.currency,
                "display_price": str(display_price),
                "display_currency": target_currency,
                "is_veg": item.is_veg,
                "is_halal": item.is_halal,
                "is_vegan": item.is_vegan,
                "image": request.build_absolute_uri(item.image.url) if item.image else None,
            })

        flight_meals_data = []
        for meal in flight_meals_qs:
            display_price = CurrencyService.convert_amount(meal.price, "INR", target_currency)
            items_list = list(meal.items.all())
            is_veg_combo = all(it.food_item.is_veg for it in items_list) if items_list else False
            is_halal_combo = all(it.food_item.is_halal for it in items_list) if items_list else False
            is_vegan_combo = all(it.food_item.is_vegan for it in items_list) if items_list else False

            flight_meals_data.append({
                "id": meal.id,
                "name": meal.name,
                "price": str(meal.price),
                "display_price": str(display_price),
                "display_currency": target_currency,
                "is_veg": is_veg_combo,
                "is_halal": is_halal_combo,
                "is_vegan": is_vegan_combo,
                "items": [
                    {
                        "name": it.food_item.name,
                        "quantity": it.quantity,
                        "is_veg": it.food_item.is_veg,
                        "is_halal": it.food_item.is_halal,
                        "is_vegan": it.food_item.is_vegan,
                    }
                    for it in items_list
                ],
            })

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

        # Baggage allowance & extra baggage parameters
        route = instance.flight
        cabin_baggage = fare.baggage_allowance if (fare and fare.baggage_allowance is not None) else route.baggage_weight_allowed_per_person
        extra_baggage_disp_price = CurrencyService.convert_amount(
            route.extra_baggage_price_per_kg,
            route.extra_baggage_currency,
            target_currency
        )

        baggage_info = {
            "cabin_baggage_kg": float(cabin_baggage) if cabin_baggage is not None else 20.0,
            "handbag_kg": float(route.handbag_weight_allowed_per_person) if route.handbag_weight_allowed_per_person is not None else 7.0,
            "max_extra_baggage_kg_per_person": float(route.max_extra_baggage_kg_per_person),
            "extra_baggage_price_per_kg": str(route.extra_baggage_price_per_kg),
            "extra_baggage_currency": route.extra_baggage_currency,
            "extra_baggage_display_price_per_kg": str(extra_baggage_disp_price),
            "display_currency": target_currency,
        }

        return Response({
            "flight_id": instance.id,
            "cabin_class": cabin_class,
            "meal_included": meal_included,
            "target_currency": target_currency,
            "baggage_info": baggage_info,
            "legs": legs_data,
            "food_items": food_items_data,
            "flight_meals": flight_meals_data,
        }, status=200)
