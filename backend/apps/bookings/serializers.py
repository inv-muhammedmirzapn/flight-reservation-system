from rest_framework import serializers
from .models import Booking

class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['id', 'user', 'flight', 'seat_count', 'total_price', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'total_price', 'status', 'created_at', 'updated_at']