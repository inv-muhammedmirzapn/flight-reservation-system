from rest_framework import serializers
from django.db import transaction
from .models import (
    Flight,
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance,
    Seat, Fare, FoodItem, FlightMeal, FlightMealItem,
    CabinClass,
)


# ─── Legacy serializer (unchanged) ─────────────────────────────────────────────

class FlightSerializer(serializers.ModelSerializer):
    """Serializer for the legacy Flight model."""
    class Meta:
        model = Flight
        fields = [
            "id", "flight_number", "airline", "aircraft",
            "source_airport", "destination_airport",
            "departure_time", "arrival_time",
            "base_fare", "total_seats", "available_seats",
            "status", "external_id", "sync_source", "stops"
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        instance = self.instance
        departure_time = attrs.get("departure_time", getattr(instance, "departure_time", None))
        arrival_time = attrs.get("arrival_time", getattr(instance, "arrival_time", None))
        source_airport = attrs.get("source_airport", getattr(instance, "source_airport", ""))
        destination_airport = attrs.get("destination_airport", getattr(instance, "destination_airport", ""))
        total_seats = attrs.get("total_seats", getattr(instance, "total_seats", None))
        available_seats = attrs.get("available_seats", getattr(instance, "available_seats", None))
        base_fare = attrs.get("base_fare", getattr(instance, "base_fare", None))

        if source_airport and destination_airport:
            if source_airport.strip().upper() == destination_airport.strip().upper():
                raise serializers.ValidationError("Source and destination airports cannot be identical.")

        if departure_time and arrival_time:
            if arrival_time <= departure_time:
                raise serializers.ValidationError("Arrival time must be later than departure time.")

        if total_seats is not None and total_seats < 0:
            raise serializers.ValidationError({"total_seats": "Total seats cannot be negative."})
        if available_seats is not None and available_seats < 0:
            raise serializers.ValidationError({"available_seats": "Available seats cannot be negative."})
        if total_seats is not None and available_seats is not None and available_seats > total_seats:
            raise serializers.ValidationError("Available seats cannot exceed total seats.")

        if base_fare is not None:
            try:
                from decimal import Decimal
                if Decimal(base_fare) < 0:
                    raise serializers.ValidationError({"base_fare": "Base fare cannot be negative."})
            except (ValueError, TypeError):
                raise serializers.ValidationError({"base_fare": "Base fare must be a valid number."})

        return attrs


# ─── New entity serializers ─────────────────────────────────────────────────────

class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ["id", "name", "iso_code"]

    def validate_iso_code(self, value):
        return value.strip().upper()


class AirportSerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source="country.name", read_only=True)

    class Meta:
        model = Airport
        fields = [
            "id", "iata_code", "airport_name", "city",
            "timezone", "latitude", "longitude",
            "country", "country_name"
        ]

    def validate_iata_code(self, value):
        v = value.strip().upper()
        if len(v) != 3:
            raise serializers.ValidationError("Airport IATA code must be exactly 3 characters.")
        return v


class AirlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Airline
        fields = ["id", "iata_airline_code", "airline_name"]

    def validate_iata_airline_code(self, value):
        v = value.strip().upper()
        if len(v) != 2:
            raise serializers.ValidationError("Airline IATA code must be exactly 2 characters.")
        return v


class AircraftModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AircraftModel
        fields = ["id", "manufacturer", "model_name"]


class AircraftSerializer(serializers.ModelSerializer):
    airline_name = serializers.CharField(source="airline.airline_name", read_only=True)
    model_display = serializers.SerializerMethodField()

    class Meta:
        model = Aircraft
        fields = [
            "id", "registration",
            "airline", "airline_name",
            "aircraft_model", "model_display",
            "economy_capacity", "business_capacity", "first_class_capacity"
        ]

    def get_model_display(self, obj):
        return str(obj.aircraft_model)


# ─── Flight Route (with nested legs) ───────────────────────────────────────────

class FlightLegSerializer(serializers.ModelSerializer):
    departure_airport_iata = serializers.CharField(
        source="departure_airport.iata_code", read_only=True
    )
    arrival_airport_iata = serializers.CharField(
        source="arrival_airport.iata_code", read_only=True
    )

    class Meta:
        model = FlightLeg
        fields = [
            "id", "leg_order",
            "departure_airport", "departure_airport_iata",
            "arrival_airport", "arrival_airport_iata",
            "scheduled_departure", "scheduled_arrival",
            "actual_departure", "actual_arrival"
        ]

    def validate(self, attrs):
        dep = attrs.get("departure_airport")
        arr = attrs.get("arrival_airport")
        if dep and arr and dep == arr:
            raise serializers.ValidationError(
                {"arrival_airport": "Arrival airport must differ from departure airport."}
            )
        dep_time = attrs.get("scheduled_departure")
        arr_time = attrs.get("scheduled_arrival")
        if dep_time and arr_time and arr_time <= dep_time:
            raise serializers.ValidationError(
                {"scheduled_arrival": "Scheduled arrival must be after scheduled departure."}
            )
        return attrs


class FlightRouteSerializer(serializers.ModelSerializer):
    legs = FlightLegSerializer(many=True)
    airline_name = serializers.CharField(source="airline.airline_name", read_only=True)

    class Meta:
        model = FlightRoute
        fields = [
            "id", "flight_no", "airline", "airline_name",
            "baggage_weight_allowed_per_person",
            "baggage_number_allowed_per_person",
            "handbag_weight_allowed_per_person",
            "legs",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def _validate_legs_ordering(self, legs_data):
        """Cross-leg: each leg's departure must be after previous leg's arrival."""
        sorted_legs = sorted(legs_data, key=lambda l: l.get("leg_order", 0))
        for i in range(1, len(sorted_legs)):
            prev_arr = sorted_legs[i - 1].get("scheduled_arrival")
            curr_dep = sorted_legs[i].get("scheduled_departure")
            if prev_arr and curr_dep and curr_dep < prev_arr:
                raise serializers.ValidationError(
                    f"Leg {sorted_legs[i]['leg_order']} departure must be after leg "
                    f"{sorted_legs[i-1]['leg_order']} arrival."
                )

    def validate(self, attrs):
        legs_data = attrs.get("legs", [])
        if legs_data:
            self._validate_legs_ordering(legs_data)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        legs_data = validated_data.pop("legs", [])
        route = FlightRoute.objects.create(**validated_data)
        for i, leg_data in enumerate(legs_data, start=1):
            leg_data["leg_order"] = i
            FlightLeg.objects.create(flight=route, **leg_data)
        return route

    @transaction.atomic
    def update(self, instance, validated_data):
        legs_data = validated_data.pop("legs", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if legs_data is not None:
            instance.legs.all().delete()
            for i, leg_data in enumerate(legs_data, start=1):
                leg_data["leg_order"] = i
                FlightLeg.objects.create(flight=instance, **leg_data)
        return instance


# ─── Flight Instance ────────────────────────────────────────────────────────────

class FlightInstanceSerializer(serializers.ModelSerializer):
    flight_no = serializers.CharField(source="flight.flight_no", read_only=True)
    aircraft_registration = serializers.CharField(
        source="aircraft.registration", read_only=True
    )

    class Meta:
        model = FlightInstance
        fields = [
            "id", "flight", "flight_no", "date",
            "aircraft", "aircraft_registration",
            "status",
            "scheduled_departure", "scheduled_arrival",
            "actual_departure", "actual_arrival",
            "checkin_open", "boarding_time",
            "boarding_gate", "departure_terminal", "arrival_terminal",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        dep = attrs.get("scheduled_departure", getattr(self.instance, "scheduled_departure", None))
        arr = attrs.get("scheduled_arrival", getattr(self.instance, "scheduled_arrival", None))
        if dep and arr and arr <= dep:
            raise serializers.ValidationError(
                {"scheduled_arrival": "Scheduled arrival must be after scheduled departure."}
            )
        return attrs


# ─── Seat ──────────────────────────────────────────────────────────────────────

class SeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Seat
        fields = [
            "id", "flight_instance", "seat_number",
            "seat_class", "position", "status",
            "exit_row", "seat_fee", "currency"
        ]
        read_only_fields = ["id"]


# ─── Fare ──────────────────────────────────────────────────────────────────────

class FareSerializer(serializers.ModelSerializer):
    available_seats = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Fare
        fields = [
            "id", "flight_instance", "fare_code", "cabin_class",
            "price", "currency", "available_seats",
            "refund_type", "change_fee", "meal_included", "baggage_allowance"
        ]
        read_only_fields = ["id", "available_seats"]

    def get_available_seats(self, obj):
        """Derive available seats from actual seat status (source of truth)."""
        return obj.flight_instance.seats.filter(
            seat_class=obj.cabin_class, status="AVAILABLE"
        ).count()

    def validate(self, attrs):
        price = attrs.get("price", getattr(self.instance, "price", None))
        change_fee = attrs.get("change_fee", getattr(self.instance, "change_fee", None))
        if price is not None and price < 0:
            raise serializers.ValidationError({"price": "Price cannot be negative."})
        if change_fee is not None and change_fee < 0:
            raise serializers.ValidationError({"change_fee": "Change fee cannot be negative."})
        return attrs


# ─── Food Item ─────────────────────────────────────────────────────────────────

class FoodItemSerializer(serializers.ModelSerializer):
    airline_name = serializers.CharField(source="airline.airline_name", read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = FoodItem
        fields = [
            "id", "airline", "airline_name",
            "name", "price", "currency",
            "is_veg", "is_halal", "is_vegan",
            "image", "image_url"
        ]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


# ─── Flight Meal (with nested items) ───────────────────────────────────────────

class FlightMealItemSerializer(serializers.ModelSerializer):
    food_item_name = serializers.CharField(source="food_item.name", read_only=True)

    class Meta:
        model = FlightMealItem
        fields = ["id", "food_item", "food_item_name", "quantity"]


class FlightMealSerializer(serializers.ModelSerializer):
    items = FlightMealItemSerializer(many=True)

    class Meta:
        model = FlightMeal
        fields = ["id", "flight_instance", "name", "items"]

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        meal = FlightMeal.objects.create(**validated_data)
        for item_data in items_data:
            FlightMealItem.objects.create(flight_meal=meal, **item_data)
        return meal

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                FlightMealItem.objects.create(flight_meal=instance, **item_data)
        return instance