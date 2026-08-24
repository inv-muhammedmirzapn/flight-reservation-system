from rest_framework import serializers
from django.core.validators import MinValueValidator, MaxValueValidator
from drf_spectacular.utils import extend_schema_field
from .models import WaitlistEntry, WaitlistStatus, WaitlistPassenger

from apps.bookings.serializers import FlightInstanceSummarySerializer as FlightSummarySerializer
from apps.flights.services_currency import CurrencyService

class WaitlistPassengerSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaitlistPassenger
        fields = ['id', 'name', 'age', 'gender', 'phone_number']

class WaitlistEntrySerializer(serializers.ModelSerializer):
    queue_position = serializers.SerializerMethodField()
    username = serializers.CharField(source="user.username", read_only=True)
    flight_detail = FlightSummarySerializer(source="flight", read_only=True)
    passengers = WaitlistPassengerSerializer(many=True, read_only=True)

    class Meta:
        model = WaitlistEntry
        fields = [
            "id",
            "user",
            "username",
            "flight",
            "flight_detail",
            "seat_count",
            "cabin_class",
            "price",
            "display_total_price",
            "display_currency",
            "status",
            "booking",
            "queue_position",
            "passengers",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "username",
            "flight_detail",
            "price",
            "display_total_price",
            "display_currency",
            "status",
            "booking",
            "created_at",
            "updated_at",
        ]

    @extend_schema_field(serializers.IntegerField(allow_null=True))
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

    display_total_price = serializers.SerializerMethodField()
    display_currency = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField())
    def get_display_currency(self, obj):
        request = self.context.get('request')
        return CurrencyService.get_user_currency(request.user if request else None)

    @extend_schema_field(serializers.FloatField())
    def get_display_total_price(self, obj):
        request = self.context.get('request')
        target_currency = CurrencyService.get_user_currency(request.user if request else None)
        return float(CurrencyService.convert_amount(obj.price, "INR", target_currency))