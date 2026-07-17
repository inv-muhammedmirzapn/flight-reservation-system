from rest_framework import serializers
from .models import WaitlistEntry, WaitlistStatus
from apps.flights.models import Flight

class WaitlistEntrySerializer(serializers.ModelSerializer):
    flight_number = serializers.CharField(source="flight.flight_number", read_only=True)

    class Meta:
        model = WaitlistEntry
        fields = [
            "id",
            "flight",
            "flight_number",
            "joined_at",
            "status"
        ]
        read_only_fields = ["id", "joined_at", "status"]

    def validate(self, attrs):
        flight = attrs.get("flight")
        user = self.context["request"].user

        if flight.available_seats > 0:
            raise serializers.ValidationError({"flight": "Cannot join waitlist. The flight still has available seats."})
        
        # Check if user already has a pending waitlist entry for this flight
        if WaitlistEntry.objects.filter(user=user, flight=flight, status=WaitlistStatus.PENDING).exists():
            raise serializers.ValidationError({"flight": "You are already on the waitlist for this flight."})
            
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["user"] = user
        return super().create(validated_data)