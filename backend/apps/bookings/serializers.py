from rest_framework import serializers
from .models import Booking, Passenger
from apps.flights.models import FlightInstance


class FlightSummarySerializer(serializers.ModelSerializer):
    """Lightweight flight info embedded in booking responses."""
    flight_number = serializers.CharField(source='flight.flight_no', read_only=True)
    airline = serializers.CharField(source='flight.airline.airline_name', read_only=True)
    aircraft = serializers.CharField(source='aircraft.registration', read_only=True)
    source_airport = serializers.SerializerMethodField()
    destination_airport = serializers.SerializerMethodField()
    departure_time = serializers.DateTimeField(source='scheduled_departure', read_only=True)
    arrival_time = serializers.DateTimeField(source='scheduled_arrival', read_only=True)
    base_fare = serializers.SerializerMethodField()
    
    class Meta:
        model = FlightInstance
        fields = [
            'id', 'flight_number', 'airline', 'aircraft',
            'source_airport', 'destination_airport',
            'departure_time', 'arrival_time', 'base_fare',
            'status',
        ]

    def get_source_airport(self, obj):
        first_leg = obj.flight.legs.order_by('leg_order').first()
        return first_leg.departure_airport.iata_code if first_leg else ""

    def get_destination_airport(self, obj):
        last_leg = obj.flight.legs.order_by('leg_order').last()
        return last_leg.arrival_airport.iata_code if last_leg else ""

    def get_base_fare(self, obj):
        fare = obj.fares.first()
        return fare.price if fare else 0


class PassengerSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='name', read_only=True)
    seat_number = serializers.CharField(source='seat.seat_number', read_only=True)
    seat_class = serializers.CharField(source='seat.seat_class', read_only=True)

    class Meta:
        model = Passenger
        fields = ['id', 'booking', 'name', 'full_name', 'age', 'gender', 'phone_number', 'seat_number', 'seat_class', 'seat']
        read_only_fields = ['id', 'booking', 'full_name', 'seat_number', 'seat_class']

    def validate_age(self, value):
        if value < 0:
            raise serializers.ValidationError("Age cannot be negative.")
        return value

class BookingSerializer(serializers.ModelSerializer):
    """Full booking representation including nested flight summary."""
    flight_detail = FlightSummarySerializer(source='flight', read_only=True)
    passengers = PassengerSerializer(many=True, read_only=True)

    class Meta:
        model = Booking
        fields = ['id', 'flight', 'flight_detail', 'status', 'seat_count', 'total_price', 'created_at', 'passengers']
        read_only_fields = ['id', 'status', 'seat_count', 'total_price', 'created_at', 'flight_detail', 'passengers']