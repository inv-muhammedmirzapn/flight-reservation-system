from rest_framework import serializers
from .models import Booking, Passenger
from apps.flights.models import FlightInstance


class FlightInstanceSummarySerializer(serializers.ModelSerializer):
    """Lightweight FlightInstance info embedded in booking responses."""
    flight_number = serializers.CharField(source='flight.flight_no', read_only=True)
    airline = serializers.CharField(source='flight.airline.airline_name', read_only=True)
    source_airport = serializers.SerializerMethodField()
    destination_airport = serializers.SerializerMethodField()

    class Meta:
        model = FlightInstance
        fields = [
            'id', 'flight_number', 'airline',
            'source_airport', 'destination_airport',
            'scheduled_departure', 'scheduled_arrival', 'status',
        ]

    def get_source_airport(self, obj):
        first_leg = obj.flight.legs.order_by('leg_order').first()
        return first_leg.departure_airport.iata_code if first_leg else None

    def get_destination_airport(self, obj):
        last_leg = obj.flight.legs.order_by('leg_order').last()
        return last_leg.arrival_airport.iata_code if last_leg else None


class PassengerSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='name', read_only=True)

    class Meta:
        model = Passenger
        fields = ['id', 'booking', 'name', 'full_name', 'age', 'gender', 'phone_number', 'seat_number']

    def validate_age(self, value):
        if value < 0:
            raise serializers.ValidationError("Age cannot be negative.")
        return value


class BookingSerializer(serializers.ModelSerializer):
    """Full booking representation including nested flight instance summary."""
    flight_detail = FlightInstanceSummarySerializer(source='flight', read_only=True)
    passengers = PassengerSerializer(many=True, read_only=True)

    # Accept an integer FlightInstance PK
    flight_id_input = serializers.IntegerField(write_only=True, source='flight')

    class Meta:
        model = Booking
        fields = [
            'id', 'flight_id_input', 'flight_detail',
            'cabin_class', 'status', 'seat_count', 'total_price',
            'created_at', 'passengers',
        ]
        read_only_fields = [
            'id', 'status', 'seat_count', 'total_price',
            'created_at', 'flight_detail', 'passengers',
        ]

    def validate_flight(self, value):
        try:
            return FlightInstance.objects.get(id=int(value))
        except (FlightInstance.DoesNotExist, (ValueError, TypeError)):
            raise serializers.ValidationError("Invalid flight instance ID.")