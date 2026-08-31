from rest_framework.exceptions import ValidationError
from apps.flights.models import FlightInstance

def validate_comparison_request(flight_instance_ids):
    # It make sures we have a list of Ids and length is between 2 and 4
    if not isinstance(flight_instance_ids, list):
        raise ValidationError({"flight_instance_ids": "Must be a list of IDs."})
        
    if not (2 <= len(flight_instance_ids) <= 4):
        raise ValidationError({"flight_instance_ids": "Please provide between 2 and 4 flights to compare."})
        
    #  Duplicate checks
    # This prevents comparing the same flight against itself.
    if len(flight_instance_ids) != len(set(flight_instance_ids)):
        raise ValidationError({"flight_instance_ids": "Duplicate flight IDs are not allowed."})

    # 3. Fetch flight instances from DB (using prefetch_related for the legs)
    #prefetch_related will fetch related objects in a single query
    
    instances = list(FlightInstance.objects.filter(
        id__in=flight_instance_ids
    ).prefetch_related('flight__legs'))
    
    if len(instances) != len(flight_instance_ids):
        raise ValidationError({"flight_instance_ids": "One or more flight instances do not exist."})
        
    #  Route matching logic 
    reference_origin = None
    reference_destination = None
    
    for instance in instances:
        # Get the legs (they are automatically sorted by leg_order due to the model's Meta class)
        legs = list(instance.flight.legs.all())
        
        if not legs:
            raise ValidationError(f"Flight {instance.flight.flight_no} has no route legs defined.")
            
        first_leg = legs[0]
        last_leg = legs[-1]
        
        origin_id = first_leg.departure_airport_id
        destination_id = last_leg.arrival_airport_id
        
        # Set the reference from the first flight in the loop
        if reference_origin is None and reference_destination is None:
            reference_origin = origin_id
            reference_destination = destination_id
        else:
            # Check subsequent flights against the reference
            if origin_id != reference_origin or destination_id != reference_destination:
                raise ValidationError({
                    "flight_instance_ids": "All flights being compared must have the exact same origin and destination."
                })
                
    # Return the validated instances so we don't have to query the DB again in the service
    return instances

