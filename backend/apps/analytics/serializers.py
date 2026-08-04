from rest_framework import serializers


class SummaryStatsSerializer(serializers.Serializer):
    total_bookings = serializers.IntegerField()
    confirmed_bookings = serializers.IntegerField()
    cancelled_bookings = serializers.IntegerField()
    cancellation_rate = serializers.FloatField(
        help_text="Percentage of bookings that were cancelled"
    )
    total_revenue = serializers.FloatField(
        help_text="Total revenue from confirmed bookings (sum of base fares)"
    )
    total_flights = serializers.IntegerField(
        help_text="Total number of flight records in the system"
    )
    scheduled_flights = serializers.IntegerField(
        help_text="Number of flights currently in SCHEDULED status"
    )
    avg_occupancy = serializers.FloatField(
        help_text="Average occupancy percentage across all flights"
    )


class MonthlyRevenueSerializer(serializers.Serializer):
    month = serializers.CharField(help_text="Calendar month in YYYY-MM format")
    revenue = serializers.FloatField()


class PopularRouteSerializer(serializers.Serializer):
    source = serializers.CharField()
    destination = serializers.CharField()
    route = serializers.CharField(help_text="Human-readable route label, e.g. JFK → LAX")
    bookings = serializers.IntegerField()


class FlightOccupancySerializer(serializers.Serializer):
    flight_number = serializers.CharField()
    airline = serializers.CharField()
    route = serializers.CharField()
    total_seats = serializers.IntegerField()
    booked_seats = serializers.IntegerField()
    available_seats = serializers.IntegerField()
    occupancy_rate = serializers.FloatField(
        help_text="Percentage of seats that are booked (0–100)"
    )


class PeakBookingHourSerializer(serializers.Serializer):
    hour = serializers.IntegerField(help_text="Hour of day (0–23, UTC)")
    bookings = serializers.IntegerField()