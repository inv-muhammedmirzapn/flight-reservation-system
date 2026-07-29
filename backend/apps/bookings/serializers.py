from rest_framework import serializers
from .models import Booking, Passenger
from apps.flights.models import Flight


class FlightSummarySerializer(serializers.ModelSerializer):
    """Lightweight flight info embedded in booking responses."""
    class Meta:
        model = Flight
        fields = [
            'id', 'flight_number', 'airline', 'aircraft',
            'source_airport', 'destination_airport',
            'departure_time', 'arrival_time', 'base_fare',
            'status',
        ]


class PassengerSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='name', read_only=True)

    class Meta:
        model = Passenger
        fields = ['id', 'booking', 'name', 'full_name', 'age', 'gender', 'phone_number']

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