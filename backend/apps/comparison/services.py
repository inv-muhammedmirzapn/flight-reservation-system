from apps.flights.models import SeatStatus
from apps.fare_prediction.services import FarePredictionService

class ComparisonService:
    
    @staticmethod
    def build_comparison_data(instances):
        """
        Takes a list of pre-fetched FlightInstance objects and builds 
        the comparison dictionary matching the FlightComparisonSerializer.
        """
        #Create an empty result list
        comparison_data = []

        # Loop through every flight
        for instance in instances:
            flight = instance.flight
            airline = flight.airline
            
            # Initialize logo URL
            logo_url = None
            # Check whether logo exists
            if airline.logo and hasattr(airline.logo, 'url'):
                try:
                    # Get the URL of the logo
                    logo_url = airline.logo.url
                except ValueError:
                    # If logo is not found, skip it
                    pass
                    
            # 2. Compute Travel Time (in minutes)
            delta = instance.scheduled_arrival - instance.scheduled_departure
            travel_time_minutes = int(delta.total_seconds() // 60)
            
            # 3. Compute Stops
            # A direct flight has 1 leg (0 stops). 2 legs = 1 stop.
            legs = list(flight.legs.all())
            number_of_stops = max(0, len(legs) - 1)
            
            # 4. Aggregate Fares
            fares_data = []
            for fare in instance.fares.all():
                fares_data.append({
                    "cabin_class": fare.cabin_class,
                    "price": fare.price,
                    "currency": fare.currency,
                    "available_seats": fare.available_seats,
                    "refund_type": fare.refund_type,
                    "meal_included": fare.meal_included,
                })
                
            # 5. Aggregate Seat Availability
            # We group by cabin class and count the total vs available seats
            seat_availability = {}
            for seat in instance.seats.all():
                c_class = seat.seat_class
                if c_class not in seat_availability:
                    seat_availability[c_class] = {"total": 0, "available": 0}
                
                # Add one to the total number of seats for this cabin class
                seat_availability[c_class]["total"] += 1
                if seat.status == SeatStatus.AVAILABLE:
                    seat_availability[c_class]["available"] += 1

            # 6. Get Fare Prediction Direction
            try:
                prediction_data = FarePredictionService.predict_fare(instance.id, "ECONOMY")
                prediction_direction = prediction_data.get("direction", "STABLE")
                confidence_score = prediction_data.get("confidence", 0)
            except Exception:
                prediction_direction = "STABLE"
                confidence_score = 0

            # 7. Build the final dictionary for this flight
            comparison_data.append({
                "flight_instance_id": instance.id,
                "flight_number": flight.flight_no,
                "airline_name": airline.airline_name,
                "airline_code": airline.iata_airline_code,
                "airline_logo": logo_url,
                "departure_time": instance.scheduled_departure,
                "arrival_time": instance.scheduled_arrival,
                "travel_time_minutes": travel_time_minutes,
                "number_of_stops": number_of_stops,
                "status": instance.status,
                "fares": fares_data,
                "seat_availability": seat_availability,
                "fare_prediction_direction": prediction_direction,
                "fare_prediction_confidence": confidence_score
            })
            
        return comparison_data

