from rest_framework import serializers
from .models import Booking

class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['id', 'flight', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']