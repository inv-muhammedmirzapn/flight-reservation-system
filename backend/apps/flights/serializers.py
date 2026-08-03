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
    base_fare = serializers.SerializerMethodField()
    total_seats = serializers.SerializerMethodField()
    available_seats = serializers.SerializerMethodField()
    stops = serializers.SerializerMethodField()
    
    baggage_weight_kg = serializers.DecimalField(source='flight.baggage_weight_allowed_per_person', max_digits=6, decimal_places=2)
    baggage_number_allowed = serializers.IntegerField(source='flight.baggage_number_allowed_per_person')
    handbag_weight_kg = serializers.DecimalField(source='flight.handbag_weight_allowed_per_person', max_digits=6, decimal_places=2)
    fares = serializers.SerializerMethodField()
    flight_instance_id = serializers.IntegerField(source='id')

    class Meta:
        model = FlightInstance
        fields = [
            "id", "flight_number", "airline", "aircraft",
            "source_airport", "source_airport_name", "source_terminals",
            "destination_airport", "destination_airport_name", "destination_terminals",
            "departure_time", "arrival_time",
            "base_fare", "total_seats", "available_seats",
            "status", "delay_minutes", "stops",
            "baggage_weight_kg", "baggage_number_allowed", "handbag_weight_kg",
            "fares", "flight_instance_id",
        ]

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
        return obj.seats.filter(status=SeatStatus.AVAILABLE).count()

    def get_stops(self, obj):
        legs = obj.flight.legs.order_by('leg_order')
        if legs.count() <= 1:
            return []
        stops = []
        for leg in legs[:legs.count()-1]:
            stops.append(leg.arrival_airport.city)
        return stops

    def get_fares(self, obj):
        from .models import SeatStatus
        fares = {}
        for fare in obj.fares.all():
            real_available = obj.seats.filter(
                seat_class=fare.cabin_class,
                status=SeatStatus.AVAILABLE
            ).count()
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

class FlightSerializer(serializers.ModelSerializer):
    """Serializer for the legacy Flight model."""
    source_airport_name = serializers.SerializerMethodField()
    destination_airport_name = serializers.SerializerMethodField()
    source_terminals = serializers.SerializerMethodField()
    destination_terminals = serializers.SerializerMethodField()
    # New fields pulled from the normalised schema
    baggage_weight_kg = serializers.SerializerMethodField()
    baggage_number_allowed = serializers.SerializerMethodField()
    handbag_weight_kg = serializers.SerializerMethodField()
    fares = serializers.SerializerMethodField()
    flight_instance_id = serializers.SerializerMethodField()

    class Meta:
        model = Flight
        fields = [
            "id", "flight_number", "airline", "aircraft",
            "source_airport", "source_airport_name", "source_terminals",
            "destination_airport", "destination_airport_name", "destination_terminals",
            "departure_time", "arrival_time",
            "base_fare", "total_seats", "available_seats",
            "status", "external_id", "sync_source", "stops",
            # Enriched fields from normalised schema
            "baggage_weight_kg", "baggage_number_allowed", "handbag_weight_kg",
            "fares", "flight_instance_id",
        ]
        read_only_fields = ["id"]

    def _get_route(self, obj):
        """Cached lookup of the linked FlightRoute."""
        if not hasattr(self, '_route_cache'):
            self._route_cache = {}
        if obj.pk not in self._route_cache:
            try:
                self._route_cache[obj.pk] = FlightRoute.objects.get(flight_no=obj.flight_number)
            except FlightRoute.DoesNotExist:
                self._route_cache[obj.pk] = None
        return self._route_cache[obj.pk]

    def _get_instance(self, obj):
        """Cached lookup of FlightInstance closest to the requested search date."""
        if not hasattr(self, '_instance_cache'):
            self._instance_cache = {}
        if obj.pk not in self._instance_cache:
            route = self._get_route(obj)
            if route:
                qs = FlightInstance.objects.filter(flight=route)
                # If a search date is in the request context, prefer the instance on that date
                request = self.context.get('request')
                search_date = request.query_params.get('date') if request else None
                if search_date:
                    from datetime import date as date_type
                    inst = qs.filter(date=search_date).first()
                    if not inst:
                        # Fall back to nearest upcoming
                        inst = qs.order_by('date').first()
                else:
                    inst = qs.order_by('date').first()
                self._instance_cache[obj.pk] = inst
            else:
                self._instance_cache[obj.pk] = None
        return self._instance_cache[obj.pk]

    def get_source_airport_name(self, obj):
        try:
            return Airport.objects.get(iata_code=obj.source_airport).airport_name
        except Airport.DoesNotExist:
            return obj.source_airport

    def get_destination_airport_name(self, obj):
        try:
            return Airport.objects.get(iata_code=obj.destination_airport).airport_name
        except Airport.DoesNotExist:
            return obj.destination_airport

    def get_source_terminals(self, obj):
        try:
            return Airport.objects.get(iata_code=obj.source_airport).terminals
        except Airport.DoesNotExist:
            return []

    def get_destination_terminals(self, obj):
        try:
            return Airport.objects.get(iata_code=obj.destination_airport).terminals
        except Airport.DoesNotExist:
            return []

    def get_baggage_weight_kg(self, obj):
        route = self._get_route(obj)
        if route:
            return float(route.baggage_weight_allowed_per_person)
        return 15.0  # sensible default

    def get_baggage_number_allowed(self, obj):
        route = self._get_route(obj)
        if route:
            return route.baggage_number_allowed_per_person
        return 1

    def get_handbag_weight_kg(self, obj):
        route = self._get_route(obj)
        if route:
            return float(route.handbag_weight_allowed_per_person)
        return 7.0  # sensible default

    def get_fares(self, obj):
        """Return per-class fare info from the Fare model if available."""
        instance = self._get_instance(obj)
        if not instance:
            return {}
        from .models import SeatStatus
        fares = {}
        for fare in instance.fares.all():
            # Count physical AVAILABLE seats — this is the single source of truth
            real_available = instance.seats.filter(
                seat_class=fare.cabin_class,
                status=SeatStatus.AVAILABLE
            ).count()
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
        return fares

    def get_flight_instance_id(self, obj):
        instance = self._get_instance(obj)
        return instance.id if instance else None

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
    class Meta:
        model = Airline
        fields = ["id", "iata_airline_code", "airline_name"]

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
            "economy_capacity", "business_capacity", "first_class_capacity"
        ]

    def get_model_display(self, obj):
        return str(obj.aircraft_model)
        
    def validate_registration(self, value):
        v = value.strip().upper()
        import re
        if not re.match(r'^[A-Z0-9\-]+$', v):
            raise serializers.ValidationError("Registration must be alphanumeric with hyphens.")
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
    route = serializers.SerializerMethodField()

    total_capacity = serializers.SerializerMethodField()

    class Meta:
        model = FlightInstance
        fields = [
            "id", "flight", "flight_no", "flight_number", "date",
            "aircraft", "aircraft_registration", "total_capacity", "route",
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