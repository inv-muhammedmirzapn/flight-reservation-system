from rest_framework import serializers
from django.db.models import Sum
from .models import Flight

class FlightSerializer(serializers.ModelSerializer):
    """
    Serializer for the Flight model, handling representation and validation.
    """
    waitlist_count = serializers.SerializerMethodField()

    class Meta:
        model = Flight
        fields = [
            "id",
            "flight_number",
            "airline",
            "aircraft",
            "source_airport",
            "destination_airport",
            "departure_time",
            "arrival_time",
            "base_fare",
            "total_seats",
            "available_seats",
            "status",
            "external_id",
            "sync_source",
            "stops",
            "waitlist_count",
        ]
        read_only_fields = ["id", "waitlist_count"]

    def get_waitlist_count(self, obj) -> int:
        """
        Calculate total pending waitlisted seats for this flight.
        """
        try:
            result = obj.waitlist_entries.filter(status="PENDING").aggregate(total=Sum("seat_count"))
            return result["total"] or 0
        except Exception:
            return 0

    def validate(self, attrs: dict) -> dict:
        """
        Object-level validation to enforce airline scheduling and capacity rules.
        """
        # Retrieve values, supporting both creation and partial/full updates.
        instance = self.instance
        departure_time = attrs.get("departure_time", getattr(instance, "departure_time", None))
        arrival_time = attrs.get("arrival_time", getattr(instance, "arrival_time", None))
        
        source_airport = attrs.get("source_airport", getattr(instance, "source_airport", ""))
        destination_airport = attrs.get("destination_airport", getattr(instance, "destination_airport", ""))
        
        total_seats = attrs.get("total_seats", getattr(instance, "total_seats", None))
        available_seats = attrs.get("available_seats", getattr(instance, "available_seats", None))
        
        base_fare = attrs.get("base_fare", getattr(instance, "base_fare", None))

        # Check: Source & destination airports cannot be identical
        if source_airport and destination_airport:
            s_airport = source_airport.strip().upper()
            d_airport = destination_airport.strip().upper()
            if s_airport == d_airport:
                raise serializers.ValidationError(
                    "Source and destination airports cannot be identical."
                )

        # Check: Arrival time cannot be earlier than departure time
        if departure_time and arrival_time:
            if arrival_time <= departure_time:
                raise serializers.ValidationError(
                    "Arrival time must be later than departure time."
                )

        # Check: Seats must be non-negative and available_seats <= total_seats
        if total_seats is not None:
            if total_seats < 0:
                raise serializers.ValidationError(
                    {"total_seats": "Total seats cannot be negative."}
                )
        if available_seats is not None:
            if available_seats < 0:
                raise serializers.ValidationError(
                    {"available_seats": "Available seats cannot be negative."}
                )
        if total_seats is not None and available_seats is not None:
            if available_seats > total_seats:
                raise serializers.ValidationError(
                    "Available seats cannot exceed total seats."
                )

        # Check: Base fare cannot be negative
        if base_fare is not None:
            try:
                from decimal import Decimal
                fare_val = Decimal(base_fare)
            except (ValueError, TypeError):
                raise serializers.ValidationError(
                    {"base_fare": "Base fare must be a valid number."}
                )
            if fare_val < 0:
                raise serializers.ValidationError(
                    {"base_fare": "Base fare cannot be negative."}
                )

        return attrs