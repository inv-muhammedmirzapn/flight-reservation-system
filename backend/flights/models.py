import uuid
from django.db import models
from django.core.exceptions import ValidationError

class FlightStatus(models.TextChoices):
    """Choices for the status of a flight."""
    SCHEDULED = "SCHEDULED", "Scheduled"
    DELAYED = "DELAYED", "Delayed"
    CANCELLED = "CANCELLED", "Cancelled"
    BOARDING = "BOARDING", "Boarding"
    DEPARTED = "DEPARTED", "Departed"
    ARRIVED = "ARRIVED", "Arrived"

class Flight(models.Model):
    """
    Model representing a flight in the reservation system.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    flight_number = models.CharField(max_length=20, unique=True, db_index=True)
    airline = models.CharField(max_length=100)
    aircraft = models.CharField(max_length=100)
    source_airport = models.CharField(max_length=10)
    destination_airport = models.CharField(max_length=10)
    departure_time = models.DateTimeField()
    arrival_time = models.DateTimeField()
    base_fare = models.DecimalField(max_digits=10, decimal_places=2)
    total_seats = models.IntegerField()
    available_seats = models.IntegerField()
    status = models.CharField(
        max_length=20,
        choices=FlightStatus.choices,
        default=FlightStatus.SCHEDULED
    )
    external_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        unique=True,
        db_index=True
    )
    sync_source = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(available_seats__lte=models.F("total_seats")),
                name="available_seats_lte_total"
            ),
            models.CheckConstraint(
                check=models.Q(available_seats__gte=0),
                name="available_seats_non_negative"
            ),
            models.CheckConstraint(
                check=models.Q(total_seats__gte=0),
                name="total_seats_non_negative"
            ),
            models.CheckConstraint(
                check=models.Q(arrival_time__gt=models.F("departure_time")),
                name="arrival_time_after_departure_time"
            ),
            models.CheckConstraint(
                check=~models.Q(source_airport=models.F("destination_airport")),
                name="source_dest_not_equal"
            ),
            models.CheckConstraint(
                check=models.Q(base_fare__gte=0),
                name="base_fare_non_negative"
            )
        ]

    def clean(self) -> None:
        """
        Validate flight model attributes.
        """
        super().clean()
        errors = {}

        # Normalize airport codes
        if self.source_airport:
            self.source_airport = self.source_airport.strip().upper()
        if self.destination_airport:
            self.destination_airport = self.destination_airport.strip().upper()

        if self.departure_time and self.arrival_time:
            if self.arrival_time <= self.departure_time:
                errors["arrival_time"] = "Arrival time must be later than departure time."

        if self.source_airport and self.destination_airport:
            if self.source_airport == self.destination_airport:
                errors["destination_airport"] = "Source and destination airports cannot be identical."

        if self.total_seats is not None:
            if self.total_seats < 0:
                errors["total_seats"] = "Total seats cannot be negative."

        if self.available_seats is not None:
            if self.available_seats < 0:
                errors["available_seats"] = "Available seats cannot be negative."

        if self.total_seats is not None and self.available_seats is not None:
            if self.available_seats > self.total_seats:
                errors["available_seats"] = "Available seats cannot exceed total seats."

        if self.base_fare is not None:
            if self.base_fare < 0:
                errors["base_fare"] = "Base fare cannot be negative."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs) -> None:
        """
        Overridden save method to run full clean validation.
        """
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.flight_number} ({self.source_airport} -> {self.destination_airport})"