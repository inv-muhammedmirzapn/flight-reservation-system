from rest_framework import serializers
from apps.pricing.models import DynamicPricingConfig, HolidayEvent, DynamicPriceLog


class DynamicPricingConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = DynamicPricingConfig
        fields = "__all__"


class HolidayEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = HolidayEvent
        fields = "__all__"


class DynamicPriceLogSerializer(serializers.ModelSerializer):
    flight_no = serializers.SerializerMethodField()

    class Meta:
        model = DynamicPriceLog
        fields = "__all__"

    def get_flight_no(self, obj):
        if obj.flight_instance and obj.flight_instance.flight:
            return obj.flight_instance.flight.flight_no
        return ""