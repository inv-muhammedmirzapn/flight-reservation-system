from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import Booking, Passenger, PassengerMeal, SeatHold
from apps.flights.models import FlightInstance
from apps.flights.services_currency import CurrencyService



class FlightInstanceSummarySerializer(serializers.ModelSerializer):
    """Lightweight FlightInstance info embedded in booking responses."""
    flight_number = serializers.CharField(source='flight.flight_no', read_only=True)
    airline = serializers.CharField(source='flight.airline.airline_name', read_only=True)
    airline_logo = serializers.SerializerMethodField()
    aircraft = serializers.SerializerMethodField()
    source_airport = serializers.SerializerMethodField()
    destination_airport = serializers.SerializerMethodField()
    baggage_weight_allowed_per_person = serializers.DecimalField(source='flight.baggage_weight_allowed_per_person', max_digits=6, decimal_places=2, read_only=True)
    handbag_weight_allowed_per_person = serializers.DecimalField(source='flight.handbag_weight_allowed_per_person', max_digits=6, decimal_places=2, read_only=True)
    fares = serializers.SerializerMethodField()

    class Meta:
        model = FlightInstance
        fields = [
            'id', 'flight_number', 'airline', 'airline_logo', 'aircraft',
            'source_airport', 'destination_airport',
            'scheduled_departure', 'scheduled_arrival', 'status',
            'baggage_weight_allowed_per_person', 'handbag_weight_allowed_per_person',
            'fares',
        ]

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_fares(self, obj):
        fares = {}
        route = obj.flight
        request = self.context.get('request')
        target_currency = CurrencyService.get_user_currency(request.user if request else None)
        for fare in obj.fares.all():
            checked_kg = float(fare.effective_baggage_allowance_kg)
            handbag_kg = float(fare.effective_handbag_allowance_kg)
            fares[fare.cabin_class] = {
                'price': float(fare.price),
                'display_price': float(CurrencyService.convert_amount(fare.price, fare.currency, target_currency)),
                'currency': fare.currency,
                'display_currency': target_currency,
                'meal_included': fare.meal_included,
                'effective_baggage_allowance_kg': checked_kg,
                'effective_handbag_allowance_kg': handbag_kg,
                'baggage_allowance': checked_kg,
                'handbag_allowance': handbag_kg,
            }
        return fares if fares else None

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_airline_logo(self, obj):
        if obj.flight and obj.flight.airline and obj.flight.airline.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.flight.airline.logo.url)
            return obj.flight.airline.logo.url
        return None

    @extend_schema_field(serializers.CharField())
    def get_aircraft(self, obj):
        if obj.aircraft and obj.aircraft.aircraft_model:
            model = obj.aircraft.aircraft_model
            manufacturer = model.manufacturer or ""
            model_name = model.model_name or ""
            if model_name.lower().startswith(manufacturer.lower()):
                return model_name
            return f"{manufacturer} {model_name}".strip()
        return "Airbus A320"

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_source_airport(self, obj):
        first_leg = obj.flight.legs.order_by('leg_order').first()
        return first_leg.departure_airport.iata_code if first_leg else None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_destination_airport(self, obj):
        last_leg = obj.flight.legs.order_by('leg_order').last()
        return last_leg.arrival_airport.iata_code if last_leg else None


class PassengerMealSerializer(serializers.ModelSerializer):
    food_item_name = serializers.CharField(source='food_item.name', read_only=True, default=None)
    flight_meal_name = serializers.CharField(source='flight_meal.name', read_only=True, default=None)
    leg_info = serializers.SerializerMethodField()
    display_price = serializers.SerializerMethodField()

    class Meta:
        model = PassengerMeal
        fields = [
            'id', 'food_item', 'flight_meal', 'flight_leg',
            'food_item_name', 'flight_meal_name', 'leg_info',
            'quantity', 'unit_price', 'display_price',
        ]
        read_only_fields = ['id', 'unit_price', 'display_price', 'food_item_name', 'flight_meal_name', 'leg_info']

    @extend_schema_field(serializers.FloatField())
    def get_display_price(self, obj):
        request = self.context.get('request')
        target_currency = CurrencyService.get_user_currency(request.user if request else None)
        return float(CurrencyService.convert_amount(obj.unit_price, "INR", target_currency))

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_leg_info(self, obj):
        if obj.flight_leg:
            return {
                'id': obj.flight_leg.id,
                'leg_order': obj.flight_leg.leg_order,
                'departure': obj.flight_leg.departure_airport.iata_code,
                'arrival': obj.flight_leg.arrival_airport.iata_code,
            }
        return None


class PassengerSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='name', read_only=True)
    selected_meals = PassengerMealSerializer(many=True, read_only=True)
    display_extra_baggage_cost = serializers.SerializerMethodField()

    class Meta:
        model = Passenger
        fields = [
            'id', 'booking', 'name', 'full_name', 'age', 'gender', 'phone_number',
            'meal_preference', 'seat_number',
            'free_baggage_allowance_kg', 'free_handbag_allowance_kg',
            'extra_baggage_kg', 'extra_baggage_cost', 'display_extra_baggage_cost',
            'selected_meals'
        ]

    @extend_schema_field(serializers.FloatField())
    def get_display_extra_baggage_cost(self, obj):
        request = self.context.get('request')
        target_currency = CurrencyService.get_user_currency(request.user if request else None)
        return float(CurrencyService.convert_amount(obj.extra_baggage_cost, "INR", target_currency))

    def validate_age(self, value):
        if value < 0:
            raise serializers.ValidationError("Age cannot be negative.")
        return value


class BookingSerializer(serializers.ModelSerializer):
    """Full booking representation including nested flight instance summary."""
    flight_detail = FlightInstanceSummarySerializer(source='flight', read_only=True)
    passengers = PassengerSerializer(many=True, read_only=True)
    user = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_full_name = serializers.SerializerMethodField()
    base_fare = serializers.SerializerMethodField()
    display_base_fare = serializers.SerializerMethodField()
    display_total_price = serializers.SerializerMethodField()
    display_currency = serializers.SerializerMethodField()

    # Accept an integer FlightInstance PK
    flight_id_input = serializers.IntegerField(write_only=True, source='flight')

    class Meta:
        model = Booking
        fields = [
            'id', 'flight_id_input', 'flight_detail',
            'cabin_class', 'status', 'seat_count', 'total_price', 'display_total_price', 'display_currency', 'base_fare', 'display_base_fare',
            'created_at', 'passengers', 'user', 'user_email', 'user_full_name',
        ]
        read_only_fields = [
            'id', 'status', 'seat_count', 'total_price', 'display_total_price', 'display_currency', 'base_fare', 'display_base_fare',
            'created_at', 'flight_detail', 'passengers', 'user', 'user_email', 'user_full_name',
        ]

    @extend_schema_field(serializers.CharField())
    def get_display_currency(self, obj):
        request = self.context.get('request')
        return CurrencyService.get_user_currency(request.user if request else None)

    @extend_schema_field(serializers.FloatField())
    def get_display_total_price(self, obj):
        request = self.context.get('request')
        target_currency = CurrencyService.get_user_currency(request.user if request else None)
        return float(CurrencyService.convert_amount(obj.total_price, "INR", target_currency))

    @extend_schema_field(serializers.FloatField())
    def get_base_fare(self, obj):
        fare = obj.flight.fares.filter(cabin_class=obj.cabin_class).first()
        if fare:
            return fare.price * obj.seat_count
        return 0

    @extend_schema_field(serializers.FloatField())
    def get_display_base_fare(self, obj):
        request = self.context.get('request')
        target_currency = CurrencyService.get_user_currency(request.user if request else None)
        fare = obj.flight.fares.filter(cabin_class=obj.cabin_class).first()
        if fare:
            raw_val = fare.price * obj.seat_count
            return float(CurrencyService.convert_amount(raw_val, fare.currency, target_currency))
        return 0.0

    @extend_schema_field(serializers.CharField())
    def get_user_full_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name if full_name else obj.user.username
        return '—'

    def validate_flight(self, value):
        try:
            return FlightInstance.objects.get(id=int(value))
        except (FlightInstance.DoesNotExist, (ValueError, TypeError)):
            raise serializers.ValidationError("Invalid flight instance ID.")


class SeatHoldSerializer(serializers.ModelSerializer):
    seat_number = serializers.CharField(source='seat.seat_number', read_only=True)
    seconds_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = SeatHold
        fields = ['id', 'seat_number', 'flight_instance', 'expires_at', 'seconds_remaining', 'created_at']
        read_only_fields = ['id', 'seat_number', 'expires_at', 'seconds_remaining', 'created_at']