from rest_framework import serializers
from .models import Booking
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


class BookingSerializer(serializers.ModelSerializer):
    """Full booking representation including nested flight summary."""
    flight_detail = FlightSummarySerializer(source='flight', read_only=True)

    class Meta:
        model = Booking
        fields = ['id', 'flight', 'flight_detail', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at', 'flight_detail']