from rest_framework import serializers
from django.core.validators import MinValueValidator, MaxValueValidator
from .models import WaitlistEntry, WaitlistStatus


from apps.bookings.serializers import FlightSummarySerializer


class WaitlistEntrySerializer(serializers.ModelSerializer):
    queue_position = serializers.SerializerMethodField()
    username = serializers.CharField(source="user.username", read_only=True)
    flight_detail = FlightSummarySerializer(source="flight", read_only=True)

    class Meta:
        model = WaitlistEntry
        fields = [
            "id",
            "user",
            "username",
            "flight",
            "flight_detail",
            "seat_count",
            "price",
            "status",
            "booking",
            "queue_position",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "username",
            "flight_detail",
            "price",
            "status",
            "booking",
            "created_at",
            "updated_at",
        ]

    def get_queue_position(self, obj):
        if obj.status != WaitlistStatus.PENDING:
            return None
        # Count preceding pending entries for the same flight
        return (
            WaitlistEntry.objects.filter(
                flight=obj.flight,
                status=WaitlistStatus.PENDING,
                created_at__lt=obj.created_at,
            ).count()
            + 1
        )

    def validate_seat_count(self, value):
        if value < 1 or value > 9:
            raise serializers.ValidationError(
                "Seat count must be between 1 and 9 seats."
            )
        return value