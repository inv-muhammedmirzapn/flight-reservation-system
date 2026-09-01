from rest_framework import serializers
from django.core.exceptions import ValidationError
from apps.pricing.models import DynamicPricingConfig, HolidayEvent, DynamicPriceLog


class DynamicPricingConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = DynamicPricingConfig
        fields = "__all__"

    def validate(self, attrs):
        initial_data = self.to_representation(self.instance) if self.instance else {}
        initial_data.update(attrs)
        model_fields = {f.name for f in DynamicPricingConfig._meta.get_fields()}
        clean_data = {k: v for k, v in initial_data.items() if k in model_fields}

        instance = DynamicPricingConfig(**clean_data)
        try:
            instance.clean()
        except ValidationError as e:
            if hasattr(e, 'message_dict'):
                raise serializers.ValidationError(e.message_dict)
            raise serializers.ValidationError(str(e))
        return attrs


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