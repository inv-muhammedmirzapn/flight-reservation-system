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
        fields = ['id', 'booking', 'name', 'full_name', 'age', 'gender', 'phone_number', 'seat_number']

    def validate_age(self, value):
        if value < 0:
            raise serializers.ValidationError("Age cannot be negative.")
        return value

class BookingSerializer(serializers.ModelSerializer):
    """Full booking representation including nested flight summary."""
    flight_detail = FlightSummarySerializer(source='flight', read_only=True)
    passengers = PassengerSerializer(many=True, read_only=True)
    
    # We accept string to allow both legacy UUIDs and FlightInstance IDs (integers)
    flight_id_input = serializers.CharField(write_only=True, source='flight')

    class Meta:
        model = Booking
        fields = ['id', 'flight_id_input', 'flight_detail', 'cabin_class', 'status', 'seat_count', 'total_price', 'created_at', 'passengers']
        read_only_fields = ['id', 'status', 'seat_count', 'total_price', 'created_at', 'flight_detail', 'passengers']

    def validate_flight(self, value):
        import uuid
        from apps.flights.models import FlightInstance, Flight
        try:
            # If it's a valid UUID, use it directly
            uuid.UUID(str(value))
            return Flight.objects.get(id=value)
        except ValueError:
            # It's an integer ID of FlightInstance
            try:
                instance = FlightInstance.objects.get(id=int(value))
                legacy_flight = Flight.objects.filter(flight_number=instance.flight.flight_no).first()
                if not legacy_flight:
                    # Fallback if no legacy flight exists at all (should not happen if seed is run, but just in case)
                    # We create a dummy one for the route
                    first_leg = instance.flight.legs.order_by('leg_order').first()
                    last_leg = instance.flight.legs.order_by('leg_order').last()
                    src = first_leg.departure_airport.iata_code if first_leg else "N/A"
                    dst = last_leg.arrival_airport.iata_code if last_leg else "N/A"
                    legacy_flight = Flight.objects.create(
                        flight_number=instance.flight.flight_no,
                        airline=instance.flight.airline.airline_name,
                        aircraft=instance.aircraft.registration,
                        source_airport=src,
                        destination_airport=dst,
                        departure_time=instance.scheduled_departure,
                        arrival_time=instance.scheduled_arrival,
                        base_fare=0.0,
                        total_seats=0,
                        available_seats=0,
                        status=instance.status
                    )
                return legacy_flight
            except (ValueError, FlightInstance.DoesNotExist):
                raise serializers.ValidationError("Invalid flight ID")