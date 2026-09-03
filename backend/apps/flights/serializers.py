from rest_framework import serializers
from django.db import transaction
from drf_spectacular.utils import extend_schema_field
from .models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightLeg, FlightInstance,
    Seat, Fare, FoodItem, FlightMeal, FlightMealItem,
    CabinClass, RouteFareClass, FarePriceChangeLog,
    DynamicPricingConfig, HolidayEvent, DynamicPriceLog,
)


# ─── Legacy serializer ─────────────────────────────────────────────

class FrontendFlightInstanceSerializer(serializers.ModelSerializer):
    """Maps a FlightInstance to the legacy Flight JSON structure expected by the frontend."""
    flight_number = serializers.CharField(source='flight.flight_no')
    airline = serializers.CharField(source='flight.airline.airline_name')
    aircraft = serializers.SerializerMethodField()
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

    booking_cutoff_time = serializers.SerializerMethodField()
    booking_cutoff_passed = serializers.SerializerMethodField()
    delayed_departure_time = serializers.SerializerMethodField()
    delayed_arrival_time = serializers.SerializerMethodField()

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
            "booking_cutoff_time", "booking_cutoff_passed",
            "delayed_departure_time", "delayed_arrival_time",
        ]

    def get_aircraft(self, obj):
        if obj.aircraft and obj.aircraft.aircraft_model:
            model = obj.aircraft.aircraft_model
            manufacturer = model.manufacturer or ""
            model_name = model.model_name or ""
            if model_name.lower().startswith(manufacturer.lower()):
                return model_name
            return f"{manufacturer} {model_name}".strip()
        return "Airbus A320"

    def get_airline_logo(self, obj):
        if obj.flight and obj.flight.airline and obj.flight.airline.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.flight.airline.logo.url)
            logo_url = obj.flight.airline.logo.url
            if logo_url.startswith('/'):
                return f"http://127.0.0.1:8000{logo_url}"
            return logo_url
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
        from .services_currency import CurrencyService
        request = self.context.get('request')
        target_currency = CurrencyService.get_user_currency(request=request)
        fare = obj.fares.order_by('price').first()
        if fare:
            display_price = CurrencyService.convert_amount(fare.price, fare.currency, target_currency)
            return float(display_price)
        return 0.0

    def get_total_seats(self, obj):
        return obj.seats.count()

    def get_available_seats(self, obj):
        from .models import SeatStatus
        if obj.seats.exists():
            return obj.seats.filter(status=SeatStatus.AVAILABLE).count()
        return sum(f.available_seats for f in obj.fares.all())

    def get_booking_cutoff_time(self, obj):
        """ISO timestamp of the booking cutoff (3h before scheduled departure)."""
        from datetime import timedelta
        if obj.scheduled_departure:
            return (obj.scheduled_departure - timedelta(hours=3)).isoformat()
        return None

    def get_booking_cutoff_passed(self, obj):
        """True when the 3-hour booking window has closed (based on ORIGINAL departure)."""
        from datetime import timedelta
        from django.utils import timezone
        if obj.scheduled_departure:
            cutoff = obj.scheduled_departure - timedelta(hours=3)
            return timezone.now() >= cutoff
        return False

    def get_delayed_departure_time(self, obj):
        """ISO timestamp of the new expected departure if the flight is delayed."""
        from datetime import timedelta
        if obj.status == 'DELAYED' and obj.delay_minutes and obj.delay_minutes > 0 and obj.scheduled_departure:
            return (obj.scheduled_departure + timedelta(minutes=obj.delay_minutes)).isoformat()
        return None

    def get_delayed_arrival_time(self, obj):
        """ISO timestamp of the new expected arrival — shifts by the same delay_minutes."""
        from datetime import timedelta
        if obj.status == 'DELAYED' and obj.delay_minutes and obj.delay_minutes > 0 and obj.scheduled_arrival:
            return (obj.scheduled_arrival + timedelta(minutes=obj.delay_minutes)).isoformat()
        return None

    def get_stops(self, obj):
        from datetime import timedelta
        legs = obj.flight.legs.order_by('leg_order')
        if legs.count() <= 1:
            return []
        stops = []
        # For delayed flights, shift the entire stop schedule by the same delay_minutes
        is_delayed = obj.status == 'DELAYED' and obj.delay_minutes and obj.delay_minutes > 0
        delay = timedelta(minutes=obj.delay_minutes) if is_delayed else timedelta(0)
        curr_time = obj.scheduled_departure + delay
        # Also track original (undelayed) times for strikethrough display
        orig_curr_time = obj.scheduled_departure
        for leg in legs:
            if leg.leg_order > 1:
                arr_transit = curr_time
                dep_transit = curr_time + timedelta(minutes=leg.layover_duration_minutes)
                orig_arr_transit = orig_curr_time
                orig_dep_transit = orig_curr_time + timedelta(minutes=leg.layover_duration_minutes)
                stops.append({
                    "airport": leg.departure_airport.iata_code,
                    "airport_name": leg.departure_airport.airport_name,
                    "city": leg.departure_airport.city,
                    "arrival_time": arr_transit.isoformat(),
                    "departure_time": dep_transit.isoformat(),
                    "original_arrival_time": orig_arr_transit.isoformat() if is_delayed else None,
                    "original_departure_time": orig_dep_transit.isoformat() if is_delayed else None,
                    "layover_minutes": leg.layover_duration_minutes,
                })
                curr_time = dep_transit
                orig_curr_time = orig_dep_transit
            curr_time += timedelta(minutes=leg.flight_duration_minutes)
            orig_curr_time += timedelta(minutes=leg.flight_duration_minutes)
        return stops

    def get_fares(self, obj):
        from decimal import Decimal
        from .models import SeatStatus
        from .services_currency import CurrencyService
        from apps.pricing.services import DynamicPricingStrategy

        request = self.context.get('request')
        user = request.user if request else None
        target_currency = CurrencyService.get_user_currency(user)

        has_seats = obj.seats.exists()
        fares = {}
        strategy = DynamicPricingStrategy()

        for fare in obj.fares.all():
            if has_seats:
                real_available = obj.seats.filter(
                    seat_class=fare.cabin_class,
                    status=SeatStatus.AVAILABLE
                ).count()
            else:
                real_available = fare.available_seats

            display_price = CurrencyService.convert_amount(fare.price, fare.currency, target_currency)

            route_fare = obj.flight.fare_classes.filter(cabin_class=fare.cabin_class).first()
            if route_fare:
                breakdown = strategy.calculate_price_breakdown(
                    route_fare, obj.date, flight_instance=obj
                )
            else:
                breakdown = {
                    "base_price": fare.price,
                    "weekend_multiplier": Decimal("1.00"),
                    "holiday_multiplier": Decimal("1.00"),
                    "holiday_name": "",
                    "demand_surge_percent": Decimal("0.00"),
                    "recent_booking_count": 0,
                    "proximity_multiplier": Decimal("1.0000"),
                    "occupancy_percent": Decimal("0.00"),
                    "days_until_departure": 0,
                    "final_price": fare.price,
                }

            base_price_display = CurrencyService.convert_amount(breakdown["base_price"], fare.currency, target_currency)

            fares[fare.cabin_class] = {
                'price': float(fare.price),
                'currency': fare.currency,
                'display_price': float(display_price),
                'display_currency': target_currency,
                'available_seats': real_available,
                'fare_code': fare.fare_code,
                'refund_type': fare.refund_type,
                'change_fee': float(fare.change_fee),
                'meal_included': fare.meal_included,
                'baggage_allowance': float(fare.baggage_allowance) if fare.baggage_allowance else None,
                'price_breakdown': {
                    'base_price': float(breakdown['base_price']),
                    'base_price_display': float(base_price_display),
                    'weekend_multiplier': float(breakdown['weekend_multiplier']),
                    'holiday_multiplier': float(breakdown['holiday_multiplier']),
                    'holiday_name': breakdown['holiday_name'],
                    'demand_surge_percent': float(breakdown['demand_surge_percent']),
                    'recent_booking_count': breakdown['recent_booking_count'],
                    'proximity_multiplier': float(breakdown['proximity_multiplier']),
                    'occupancy_percent': float(breakdown['occupancy_percent']),
                    'days_until_departure': breakdown['days_until_departure'],
                    'final_price': float(breakdown['final_price']),
                    'final_price_display': float(display_price),
                }
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

    @extend_schema_field(serializers.URLField(allow_null=True))
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

    @extend_schema_field(serializers.CharField())
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
            "scheduled_departure_time", "scheduled_arrival_time",
            "scheduled_departure", "scheduled_arrival",
            "actual_departure", "actual_arrival"
        ]
        extra_kwargs = {
            "scheduled_departure_time": {"required": False, "allow_null": True},
            "scheduled_arrival_time": {"required": False, "allow_null": True},
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
        dep_time = attrs.get("scheduled_departure_time")
        arr_time = attrs.get("scheduled_arrival_time")
        if dep_time and arr_time and dep_time == arr_time:
            raise serializers.ValidationError(
                {"scheduled_arrival_time": "Leg departure and arrival times cannot be identical."}
            )
        return attrs


class FlightRouteSerializer(serializers.ModelSerializer):
    legs = FlightLegSerializer(many=True)
    airline_name = serializers.CharField(source="airline.airline_name", read_only=True)

    class Meta:
        model = FlightRoute
        fields = [
            "id", "flight_no", "airline", "airline_name",
            "operates_on_days", "valid_from", "valid_until",
            "scheduled_departure_time", "scheduled_arrival_time",
            "baggage_weight_allowed_per_person",
            "baggage_number_allowed_per_person",
            "handbag_weight_allowed_per_person",
            "max_extra_baggage_kg_per_person",
            "extra_baggage_price_per_kg",
            "extra_baggage_currency",
            "is_active",
            "legs",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_operates_on_days(self, value):
        if not value:
            return "1,2,3,4,5,6,7"
        parts = [p.strip() for p in value.split(",") if p.strip()]
        for p in parts:
            if not p.isdigit() or int(p) < 1 or int(p) > 7:
                raise serializers.ValidationError("operates_on_days must contain comma-separated integers between 1 (Mon) and 7 (Sun).")
        # Unique & sorted
        unique_days = sorted(list(set(int(p) for p in parts)))
        return ",".join(str(d) for d in unique_days)

    def validate(self, attrs):
        legs_data = attrs.get("legs", [])
        if not legs_data and not self.instance:
            raise serializers.ValidationError({"legs": "At least one leg is required."})

        route_dep_t = attrs.get("scheduled_departure_time", getattr(self.instance, "scheduled_departure_time", None))
        route_arr_t = attrs.get("scheduled_arrival_time", getattr(self.instance, "scheduled_arrival_time", None))

        if legs_data and route_dep_t and route_arr_t:
            first_leg = legs_data[0]
            last_leg = legs_data[-1]

            leg1_dep = first_leg.get("scheduled_departure_time")
            if leg1_dep and leg1_dep != route_dep_t:
                raise serializers.ValidationError({
                    "legs": f"Leg 1 departure time ({leg1_dep.strftime('%H:%M')}) must match the flight's overall departure time ({route_dep_t.strftime('%H:%M')})."
                })

            last_arr = last_leg.get("scheduled_arrival_time")
            if last_arr and last_arr != route_arr_t:
                raise serializers.ValidationError({
                    "legs": f"Final leg arrival time ({last_arr.strftime('%H:%M')}) must match the flight's overall arrival time ({route_arr_t.strftime('%H:%M')})."
                })

            for idx in range(len(legs_data) - 1):
                curr_arr = legs_data[idx].get("scheduled_arrival_time")
                next_dep = legs_data[idx + 1].get("scheduled_departure_time")
                if curr_arr and next_dep and next_dep < curr_arr:
                    raise serializers.ValidationError({
                        "legs": f"Leg {idx+2} departure ({next_dep.strftime('%H:%M')}) cannot be before Leg {idx+1} arrival ({curr_arr.strftime('%H:%M')})."
                    })

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

    @extend_schema_field(serializers.IntegerField())
    def get_total_capacity(self, obj):
        if not obj.aircraft:
            return 0
        return (obj.aircraft.economy_capacity or 0) + (obj.aircraft.business_capacity or 0) + (obj.aircraft.first_class_capacity or 0)

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_route(self, obj):
        legs = obj.flight.legs.order_by('leg_order')
        if not legs.exists():
            return None
        first_leg = legs.first()
        last_leg = legs.last()
        return {
            "source": {
                "iata_code": first_leg.departure_airport.iata_code,
                "city": first_leg.departure_airport.city,
                "name": first_leg.departure_airport.airport_name,
                "terminals": first_leg.departure_airport.terminals or [],
            },
            "destination": {
                "iata_code": last_leg.arrival_airport.iata_code,
                "city": last_leg.arrival_airport.city,
                "name": last_leg.arrival_airport.airport_name,
                "terminals": last_leg.arrival_airport.terminals or [],
            },
            "airline": {
                "name": obj.flight.airline.airline_name if obj.flight.airline else None
            }
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
    display_seat_fee = serializers.SerializerMethodField()
    display_currency = serializers.SerializerMethodField()
    my_hold = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Seat
        fields = [
            "id", "flight_instance", "seat_number",
            "seat_class", "position", "status",
            "exit_row", "extra_legroom", "seat_fee", "currency",
            "display_seat_fee", "display_currency",
            "last_rule_applied", "attributes", "my_hold",
        ]
        read_only_fields = ["id", "attributes", "display_seat_fee", "display_currency"]

    def _get_target_currency(self):
        request = self.context.get('request')
        user = request.user if request else None
        from .services_currency import CurrencyService
        return CurrencyService.get_user_currency(user)

    @extend_schema_field(serializers.CharField())
    def get_display_seat_fee(self, obj):
        from .services_currency import CurrencyService
        target_currency = self._get_target_currency()
        display_price = CurrencyService.convert_amount(obj.seat_fee, obj.currency, target_currency)
        return str(display_price)

    @extend_schema_field(serializers.CharField())
    def get_display_currency(self, obj):
        return self._get_target_currency()

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_attributes(self, obj):
        return obj.attributes

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_my_hold(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        if obj.status == 'HELD':
            try:
                hold = getattr(obj, 'hold', None)
                if hold and not hold.is_expired and hold.user_id == request.user.id:
                    return {
                        "id": str(hold.id),
                        "expires_at": hold.expires_at.isoformat()
                    }
            except Exception:
                pass
        return None

    def validate_seat_fee(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Seat fee cannot be negative.")
        return value


# ─── Fare ──────────────────────────────────────────────────────────────────────

class FareSerializer(serializers.ModelSerializer):
    available_seats = serializers.SerializerMethodField(read_only=True)
    effective_baggage_allowance_kg = serializers.FloatField(read_only=True)
    effective_handbag_allowance_kg = serializers.FloatField(read_only=True)
    effective_baggage_pieces = serializers.IntegerField(read_only=True)

    class Meta:
        model = Fare
        fields = [
            "id", "flight_instance", "fare_code", "cabin_class",
            "price", "currency", "available_seats",
            "refund_type", "change_fee", "meal_included",
            "baggage_allowance", "handbag_allowance", "baggage_pieces_allowance",
            "effective_baggage_allowance_kg", "effective_handbag_allowance_kg", "effective_baggage_pieces"
        ]
        read_only_fields = [
            "id", "available_seats",
            "effective_baggage_allowance_kg", "effective_handbag_allowance_kg", "effective_baggage_pieces"
        ]

    @extend_schema_field(serializers.IntegerField())
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
    display_price = serializers.SerializerMethodField()
    display_currency = serializers.SerializerMethodField()

    class Meta:
        model = FoodItem
        fields = [
            "id", "airline", "airline_name",
            "name", "price", "currency",
            "display_price", "display_currency",
            "is_veg", "is_halal", "is_vegan",
            "image", "image_url"
        ]

    @extend_schema_field(serializers.CharField())
    def get_display_currency(self, obj):
        from .services_currency import CurrencyService
        request = self.context.get("request")
        return CurrencyService.get_user_currency(request=request)

    @extend_schema_field(serializers.FloatField())
    def get_display_price(self, obj):
        from .services_currency import CurrencyService
        request = self.context.get("request")
        target_currency = CurrencyService.get_user_currency(request=request)
        return float(CurrencyService.convert_amount(obj.price, obj.currency or "INR", target_currency))

    @extend_schema_field(serializers.URLField(allow_null=True))
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
    airline_name = serializers.CharField(source="airline.airline_name", read_only=True)
    airline_code = serializers.CharField(source="airline.iata_airline_code", read_only=True)

    class Meta:
        model = FlightMeal
        fields = ["id", "airline", "airline_name", "airline_code", "cabin_class", "name", "price", "items"]

    def validate(self, attrs):
        airline = attrs.get("airline") or (self.instance.airline if self.instance else None)
        items_data = attrs.get("items", [])
        if airline:
            for item in items_data:
                food_item = item.get("food_item")
                if food_item and food_item.airline != airline:
                    raise serializers.ValidationError({
                        "items": f"Food item '{food_item.name}' does not belong to airline '{airline.airline_name}'."
                    })
        return attrs

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


class RouteFareClassSerializer(serializers.ModelSerializer):
    flight_no = serializers.CharField(source="route.flight_no", read_only=True)
    airline_name = serializers.CharField(source="route.airline.airline_name", read_only=True)
    airline_code = serializers.CharField(source="route.airline.iata_airline_code", read_only=True)
    fare_code = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = RouteFareClass
        fields = [
            "id",
            "route",
            "flight_no",
            "airline_name",
            "airline_code",
            "cabin_class",
            "fare_code",
            "base_price",
            "currency",
            "refund_type",
            "change_fee",
            "meal_included",
            "baggage_weight_allowed_kg",
        ]

    def validate(self, attrs):
        route = attrs.get("route") or (self.instance.route if self.instance else None)
        cabin_class = attrs.get("cabin_class") or (self.instance.cabin_class if self.instance else None)
        baggage_weight = attrs.get("baggage_weight_allowed_kg")

        if not attrs.get("fare_code") and cabin_class:
            attrs["fare_code"] = cabin_class

        if not self.instance and route and cabin_class:
            if RouteFareClass.objects.filter(route=route, cabin_class=cabin_class).exists():
                raise serializers.ValidationError({
                    "cabin_class": f"A fare template for {cabin_class} already exists on this flight route."
                })

        if baggage_weight is not None and route and route.baggage_weight_allowed_per_person is not None:
            if baggage_weight < route.baggage_weight_allowed_per_person:
                raise serializers.ValidationError({
                    "baggage_weight_allowed_kg": f"Baggage allowance cannot be less than the route default ({route.baggage_weight_allowed_per_person} kg)."
                })

        return attrs
    


class FarePriceChangeLogSerializer(serializers.ModelSerializer):
    changed_by_email = serializers.ReadOnlyField(source="changed_by.email")
    flight_no = serializers.SerializerMethodField()
    airline_name = serializers.SerializerMethodField()
    cabin_class = serializers.SerializerMethodField()
    fare_code = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    flight_date = serializers.SerializerMethodField()

    class Meta:
        model = FarePriceChangeLog
        fields = [
            "id",
            "route_fare",
            "fare",
            "old_price",
            "new_price",
            "changed_by",
            "changed_by_email",
            "changed_at",
            "fare_code",
            "cabin_class",
            "currency",
            "flight_no",
            "airline_name",
            "flight_date",
        ]

    def get_flight_no(self, obj):
        if obj.fare:
            return obj.fare.flight_instance.flight.flight_no
        if obj.route_fare:
            return obj.route_fare.route.flight_no
        return None

    def get_airline_name(self, obj):
        if obj.fare and obj.fare.flight_instance.flight.airline:
            return obj.fare.flight_instance.flight.airline.airline_name
        if obj.route_fare and obj.route_fare.route.airline:
            return obj.route_fare.route.airline.airline_name
        return None

    def get_cabin_class(self, obj):
        if obj.fare:
            return obj.fare.cabin_class
        if obj.route_fare:
            return obj.route_fare.cabin_class
        return None

    def get_fare_code(self, obj):
        if obj.fare:
            return obj.fare.fare_code
        if obj.route_fare:
            return obj.route_fare.fare_code
        return "TEMPLATE"

    def get_currency(self, obj):
        if obj.fare:
            return obj.fare.currency
        if obj.route_fare:
            return obj.route_fare.currency
        return "INR"

    def get_flight_date(self, obj):
        if obj.fare:
            return str(obj.fare.flight_instance.date)
        return "Template Baseline"


from apps.pricing.serializers import (
    DynamicPricingConfigSerializer,
    HolidayEventSerializer,
    DynamicPriceLogSerializer,
)