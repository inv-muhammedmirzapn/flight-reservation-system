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


class AirlinePerformanceSerializer(serializers.Serializer):
    airline_id = serializers.IntegerField(help_text="Primary key of the Airline")
    airline_name = serializers.CharField(help_text="Full airline name")
    iata_code = serializers.CharField(help_text="2-letter IATA airline code")
    total_revenue = serializers.FloatField(
        help_text="Total revenue from confirmed bookings for this airline"
    )
    total_bookings = serializers.IntegerField(
        help_text="Number of confirmed bookings for this airline"
    )
    cancellation_rate = serializers.FloatField(
        help_text="Percentage of total bookings that were cancelled"
    )


class AircraftUtilizationSerializer(serializers.Serializer):
    aircraft_id = serializers.IntegerField(help_text="Primary key of the Aircraft")
    registration = serializers.CharField(help_text="Aircraft tail/registration number")
    aircraft_model = serializers.CharField(help_text="Manufacturer + model name, e.g. Boeing 737-800")
    manufacturer = serializers.CharField(help_text="Aircraft manufacturer name")
    airline_name = serializers.CharField(help_text="Owning airline name")
    total_flights = serializers.IntegerField(
        help_text="Total number of flight instances operated by this aircraft"
    )

    economy_fill_rate = serializers.FloatField(
        help_text="Economy cabin fill rate (booked / total economy seats) %"
    )
    business_fill_rate = serializers.FloatField(
        help_text="Business cabin fill rate %"
    )
    first_fill_rate = serializers.FloatField(
        help_text="First-class cabin fill rate %"
    )