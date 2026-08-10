from rest_framework import serializers
from django.db import transaction
from .models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance,
    Seat, Fare, FoodItem, FlightMeal, FlightMealItem,
    CabinClass,
)


# ─── Legacy serializer ─────────────────────────────────────────────

class FrontendFlightInstanceSerializer(serializers.ModelSerializer):
    """Maps a FlightInstance to the legacy Flight JSON structure expected by the frontend."""
    flight_number = serializers.CharField(source='flight.flight_no')
    airline = serializers.CharField(source='flight.airline.airline_name')
    aircraft = serializers.CharField(source='aircraft.registration')
    source_airport = serializers.SerializerMethodField()
    source_airport_name = serializers.SerializerMethodField()
    source_terminals = serializers.SerializerMethodField()
    destination_airport = serializers.SerializerMethodField()
    destination_airport_name = serializers.SerializerMethodField()
    destination_terminals = serializers.SerializerMethodField()
    departure_time = serializers.DateTimeField(source='scheduled_departure')
    arrival_time = serializers.DateTimeField(source='scheduled_arrival')
    
    aircraft_economy_layout = serializers.CharField(source='aircraft.economy_layout', read_only=True)
    aircraft_business_layout = serializers.CharField(source='aircraft.business_layout', read_only=True)
    aircraft_first_class_layout = serializers.CharField(source='aircraft.first_class_layout', read_only=True)
    base_fare = serializers.SerializerMethodField()
    total_seats = serializers.SerializerMethodField()
    available_seats = serializers.SerializerMethodField()
    stops = serializers.SerializerMethodField()
    
    baggage_weight_kg = serializers.DecimalField(source='flight.baggage_weight_allowed_per_person', max_digits=6, decimal_places=2)
    baggage_number_allowed = serializers.IntegerField(source='flight.baggage_number_allowed_per_person')
    handbag_weight_kg = serializers.DecimalField(source='flight.handbag_weight_allowed_per_person', max_digits=6, decimal_places=2)
    fares = serializers.SerializerMethodField()
    airline_logo = serializers.SerializerMethodField()
    flight_instance_id = serializers.IntegerField(source='id')

    class Meta:
        model = FlightInstance
        fields = [
            "id", "flight_number", "airline", "airline_logo", "aircraft",
            "source_airport", "source_airport_name", "source_terminals",
            "destination_airport", "destination_airport_name", "destination_terminals",
            "departure_time", "arrival_time",
            "base_fare", "total_seats", "available_seats",
            "status", "delay_minutes", "stops",
            "baggage_weight_kg", "baggage_number_allowed", "handbag_weight_kg",
            "fares", "flight_instance_id",
            "aircraft_economy_layout", "aircraft_business_layout", "aircraft_first_class_layout",
        ]

    def get_airline_logo(self, obj):
        if obj.flight and obj.flight.airline and obj.flight.airline.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.flight.airline.logo.url)
            return obj.flight.airline.logo.url
        return None

    def _get_first_leg(self, obj):
        return obj.flight.legs.order_by('leg_order').first()

    def _get_last_leg(self, obj):
        return obj.flight.legs.order_by('leg_order').last()

    def get_source_airport(self, obj):
        leg = self._get_first_leg(obj)
        return leg.departure_airport.iata_code if leg else "N/A"

    def get_source_airport_name(self, obj):
        leg = self._get_first_leg(obj)
        return leg.departure_airport.airport_name if leg else "N/A"

    def get_source_terminals(self, obj):
        leg = self._get_first_leg(obj)
        return leg.departure_airport.terminals if leg else []

    def get_destination_airport(self, obj):
        leg = self._get_last_leg(obj)
        return leg.arrival_airport.iata_code if leg else "N/A"

    def get_destination_airport_name(self, obj):
        leg = self._get_last_leg(obj)
        return leg.arrival_airport.airport_name if leg else "N/A"

    def get_destination_terminals(self, obj):
        leg = self._get_last_leg(obj)
        return leg.arrival_airport.terminals if leg else []

    def get_base_fare(self, obj):
        fare = obj.fares.order_by('price').first()
        return float(fare.price) if fare else 0.0

    def get_total_seats(self, obj):
        return obj.seats.count()

    def get_available_seats(self, obj):
        from .models import SeatStatus
        if obj.seats.exists():
            return obj.seats.filter(status=SeatStatus.AVAILABLE).count()
        return sum(f.available_seats for f in obj.fares.all())

    def get_stops(self, obj):
        from datetime import timedelta
        legs = obj.flight.legs.order_by('leg_order')
        if legs.count() <= 1:
            return []
        stops = []
        curr_time = obj.scheduled_departure
        for leg in legs:
            if leg.leg_order > 1:
                arr_transit = curr_time
                dep_transit = curr_time + timedelta(minutes=leg.layover_duration_minutes)
                stops.append({
                    "airport": leg.departure_airport.iata_code,
                    "airport_name": leg.departure_airport.airport_name,
                    "city": leg.departure_airport.city,
                    "arrival_time": arr_transit.isoformat(),
                    "departure_time": dep_transit.isoformat(),
                    "layover_minutes": leg.layover_duration_minutes,
                })
                curr_time = dep_transit
            curr_time += timedelta(minutes=leg.flight_duration_minutes)
        return stops

    def get_fares(self, obj):
        from .models import SeatStatus
        has_seats = obj.seats.exists()
        fares = {}
        for fare in obj.fares.all():
            if has_seats:
                real_available = obj.seats.filter(
                    seat_class=fare.cabin_class,
                    status=SeatStatus.AVAILABLE
                ).count()
            else:
                real_available = fare.available_seats
            fares[fare.cabin_class] = {
                'price': float(fare.price),
                'currency': fare.currency,
                'available_seats': real_available,
                'fare_code': fare.fare_code,
                'refund_type': fare.refund_type,
                'change_fee': float(fare.change_fee),
                'meal_included': fare.meal_included,
                'baggage_allowance': float(fare.baggage_allowance) if fare.baggage_allowance else None,
            }
        return fares if fares else None


# ─── New entity serializers ─────────────────────────────────────────────────────

class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ["id", "name", "iso_code"]

    def validate_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Country name must be at least 2 characters.")
        return value.strip()

    def validate_iso_code(self, value):
        v = value.strip().upper()
        if not v.isalpha() or len(v) not in (2, 3):
            raise serializers.ValidationError("ISO code must be 2-3 alphabetic characters.")
        return v


class AirportSerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source="country.name", read_only=True)

    class Meta:
        model = Airport
        fields = [
            "id", "iata_code", "airport_name", "city",
            "timezone", "latitude", "longitude",
            "country", "country_name", "terminals"
        ]

    def validate_iata_code(self, value):
        v = value.strip().upper()
        if not v.isalpha() or len(v) != 3:
            raise serializers.ValidationError("Airport IATA code must be exactly 3 alphabetic characters.")
        return v
        
    def validate_airport_name(self, value):
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Airport name must be at least 3 characters.")
        return value.strip()
        
    def validate_city(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("City name must be at least 2 characters.")
        return value.strip()
        
    def validate_latitude(self, value):
        if value is not None and (value < -90 or value > 90):
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value
        
    def validate_longitude(self, value):
        if value is not None and (value < -180 or value > 180):
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value


class AirlineSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Airline
        fields = ["id", "iata_airline_code", "airline_name", "logo", "logo_url"]

    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None

    def validate_iata_airline_code(self, value):
        v = value.strip().upper()
        if not v.isalnum() or len(v) != 2:
            raise serializers.ValidationError("Airline IATA code must be exactly 2 alphanumeric characters.")
        return v
        
    def validate_airline_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Airline name must be at least 2 characters.")
        return value.strip()


class AircraftModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AircraftModel
        fields = ["id", "manufacturer", "model_name"]
        
    def validate_manufacturer(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Manufacturer must be at least 2 characters.")
        return value.strip()
        
    def validate_model_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Model name must be at least 2 characters.")
        return value.strip()


class AircraftSerializer(serializers.ModelSerializer):
    airline_name = serializers.CharField(source="airline.airline_name", read_only=True)
    model_display = serializers.SerializerMethodField()

    class Meta:
        model = Aircraft
        fields = [
            "id", "registration",
            "airline", "airline_name",
            "aircraft_model", "model_display",
            "economy_capacity", "business_capacity", "first_class_capacity",
            "economy_layout", "business_layout", "first_class_layout"
        ]

    def get_model_display(self, obj):
        return str(obj.aircraft_model)
        
    def validate_registration(self, value):
        v = value.strip().upper()
        import re
        if not re.match(r'^[A-Z0-9\-]+$', v):
            raise serializers.ValidationError("Registration must be alphanumeric with hyphens.")
        return v

    def validate_economy_layout(self, value):
        import re
        v = value.strip()
        if not re.match(r'^\d+(-\d+)*$', v):
            raise serializers.ValidationError("Layout must be numbers separated by hyphens, e.g. 3-3")
        return v

    def validate_business_layout(self, value):
        import re
        v = value.strip()
        if not re.match(r'^\d+(-\d+)*$', v):
            raise serializers.ValidationError("Layout must be numbers separated by hyphens, e.g. 2-2")
        return v

    def validate_first_class_layout(self, value):
        import re
        v = value.strip()
        if not re.match(r'^\d+(-\d+)*$', v):
            raise serializers.ValidationError("Layout must be numbers separated by hyphens, e.g. 2-2")
        return v


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
            "flight_duration_minutes", "layover_duration_minutes",
            "scheduled_departure", "scheduled_arrival",
            "actual_departure", "actual_arrival"
        ]
        extra_kwargs = {
            "scheduled_departure": {"required": False, "allow_null": True},
            "scheduled_arrival": {"required": False, "allow_null": True},
        }

    def validate(self, attrs):
        dep = attrs.get("departure_airport")
        arr = attrs.get("arrival_airport")
        if dep and arr and dep == arr:
            raise serializers.ValidationError(
                {"arrival_airport": "Arrival airport must differ from departure airport."}
            )
        duration = attrs.get("flight_duration_minutes")
        if duration is not None and duration <= 0:
            raise serializers.ValidationError(
                {"flight_duration_minutes": "Flight duration must be greater than 0 minutes."}
            )
        layover = attrs.get("layover_duration_minutes")
        if layover is not None and layover < 0:
            raise serializers.ValidationError(
                {"layover_duration_minutes": "Layover duration cannot be negative."}
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

    def validate(self, attrs):
        legs_data = attrs.get("legs", [])
        if not legs_data and not self.instance:
            raise serializers.ValidationError({"legs": "At least one leg is required."})
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


# ─── Flight Instance ───────────────────────────────────────────────────────────

class FlightInstanceSerializer(serializers.ModelSerializer):
    flight_no = serializers.CharField(source="flight.flight_no", read_only=True)
    flight_number = serializers.CharField(source="flight.flight_no", read_only=True)
    aircraft_registration = serializers.CharField(
        source="aircraft.registration", read_only=True
    )
    aircraft_economy_layout = serializers.CharField(
        source="aircraft.economy_layout", read_only=True
    )
    aircraft_business_layout = serializers.CharField(
        source="aircraft.business_layout", read_only=True
    )
    aircraft_first_class_layout = serializers.CharField(
        source="aircraft.first_class_layout", read_only=True
    )
    route = serializers.SerializerMethodField()

    total_capacity = serializers.SerializerMethodField()

    class Meta:
        model = FlightInstance
        fields = [
            "id", "flight", "flight_no", "flight_number", "date",
            "aircraft", "aircraft_registration", "total_capacity", "route",
            "aircraft_economy_layout", "aircraft_business_layout", "aircraft_first_class_layout",
            "status", "delay_minutes",
            "scheduled_departure", "scheduled_arrival",
            "actual_departure", "actual_arrival",
            "checkin_open", "boarding_time",
            "boarding_gate", "departure_terminal", "arrival_terminal",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_total_capacity(self, obj):
        if not obj.aircraft:
            return 0
        return (obj.aircraft.economy_capacity or 0) + (obj.aircraft.business_capacity or 0) + (obj.aircraft.first_class_capacity or 0)

    def get_route(self, obj):
        legs = obj.flight.legs.order_by('leg_order')
        if not legs.exists():
            return None
        return {
            "source": {"iata_code": legs.first().departure_airport.iata_code},
            "destination": {"iata_code": legs.last().arrival_airport.iata_code}
        }

    def validate(self, attrs):
        dep = attrs.get("scheduled_departure", getattr(self.instance, "scheduled_departure", None))
        arr = attrs.get("scheduled_arrival", getattr(self.instance, "scheduled_arrival", None))
        route = attrs.get("flight", getattr(self.instance, "flight", None))

        if dep and route and not arr:
            from datetime import timedelta
            legs = route.legs.all()
            if legs.exists():
                total_mins = sum((leg.flight_duration_minutes or 0) + (leg.layover_duration_minutes or 0) for leg in legs)
                if total_mins > 0:
                    arr = dep + timedelta(minutes=total_mins)
                    attrs["scheduled_arrival"] = arr

        if dep and arr and arr <= dep:
            raise serializers.ValidationError(
                {"scheduled_arrival": "Scheduled arrival must be after scheduled departure."}
            )

        # Auto-set status to DELAYED when delay_minutes > 0 and status not explicitly provided
        delay = attrs.get("delay_minutes", getattr(self.instance, "delay_minutes", 0) or 0)
        if delay > 0 and "status" not in attrs:
            attrs["status"] = "DELAYED"

        return attrs


# ─── Seat ──────────────────────────────────────────────────────────────────────

class SeatSerializer(serializers.ModelSerializer):
    attributes = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Seat
        fields = [
            "id", "flight_instance", "seat_number",
            "seat_class", "position", "status",
            "exit_row", "extra_legroom", "seat_fee", "currency",
            "last_rule_applied", "attributes",
        ]
        read_only_fields = ["id", "attributes"]

    def get_attributes(self, obj):
        return obj.attributes

    def validate_seat_fee(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Seat fee cannot be negative.")
        return value


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
        
    def validate_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Item name must be at least 2 characters.")
        return value.strip()


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


# ─── SeatPriceTemplate ─────────────────────────────────────────────────────────

class SeatPriceTemplateSerializer(serializers.ModelSerializer):
    aircraft_model_display = serializers.CharField(
        source="aircraft_model.__str__", read_only=True
    )

    class Meta:
        from .models import SeatPriceTemplate
        model = SeatPriceTemplate
        fields = [
            "id", "aircraft_model", "aircraft_model_display",
            "name", "rules", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]