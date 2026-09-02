from rest_framework import serializers

class FareComparisonSerializer(serializers.Serializer):
    """
    Nested serializer to show the fare details for a specific cabin class.
    """
    cabin_class = serializers.CharField()
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency = serializers.CharField()
    available_seats = serializers.IntegerField()
    refund_type = serializers.CharField()
    meal_included = serializers.BooleanField()


class FlightComparisonSerializer(serializers.Serializer):
    """
    The main serializer that shapes the final comparison JSON object for a single flight.
    """
    flight_instance_id = serializers.IntegerField()
    flight_number = serializers.CharField()
    airline_name = serializers.CharField()
    airline_code = serializers.CharField()
    # airline_logo can be null if the airline doesn't have an image uploaded
    airline_logo = serializers.URLField(allow_null=True, required=False)
    
    departure_time = serializers.DateTimeField()
    arrival_time = serializers.DateTimeField()
    travel_time_minutes = serializers.IntegerField()
    number_of_stops = serializers.IntegerField()
    status = serializers.CharField()
    
    # This will be a list of FareComparisonSerializer objects
    fares = FareComparisonSerializer(many=True)
    
    # This expects a dynamic dictionary shaped like this:
    # { "ECONOMY": {"total": 150, "available": 45}, "BUSINESS": {"total": 20, "available": 8} }
    seat_availability = serializers.DictField(
        child=serializers.DictField(child=serializers.IntegerField())
    )
    
    fare_prediction_direction = serializers.CharField(required=False, allow_null=True)
    fare_prediction_confidence = serializers.IntegerField(required=False, allow_null=True)

