import logging
import uuid
# trigger reload
from django.db import models
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

# ─── Legacy Flight (keep for backwards compat) ─────────────────────────────────

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
    Legacy Flight model — kept for backwards compatibility with existing
    bookings, analytics, and tests.  New schema uses FlightRoute + FlightInstance.
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
        max_length=100, null=True, blank=True, unique=True, db_index=True
    )
    sync_source = models.CharField(max_length=50, null=True, blank=True)
    stops = models.JSONField(default=list, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(available_seats__lte=models.F("total_seats")),
                name="available_seats_lte_total"
            ),
            models.CheckConstraint(
                condition=models.Q(available_seats__gte=0),
                name="available_seats_non_negative"
            ),
            models.CheckConstraint(
                condition=models.Q(total_seats__gte=0),
                name="total_seats_non_negative"
            ),
            models.CheckConstraint(
                condition=models.Q(arrival_time__gt=models.F("departure_time")),
                name="arrival_time_after_departure_time"
            ),
            models.CheckConstraint(
                condition=~models.Q(source_airport=models.F("destination_airport")),
                name="source_dest_not_equal"
            ),
            models.CheckConstraint(
                condition=models.Q(base_fare__gte=0),
                name="base_fare_non_negative"
            )
        ]

    def clean(self) -> None:
        super().clean()
        errors = {}
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
        if self.total_seats is not None and self.total_seats < 0:
            errors["total_seats"] = "Total seats cannot be negative."
        if self.available_seats is not None and self.available_seats < 0:
            errors["available_seats"] = "Available seats cannot be negative."
        if self.total_seats is not None and self.available_seats is not None:
            if self.available_seats > self.total_seats:
                errors["available_seats"] = "Available seats cannot exceed total seats."
        if self.base_fare is not None and self.base_fare < 0:
            errors["base_fare"] = "Base fare cannot be negative."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs) -> None:
        self.full_clean()
        is_new = self._state.adding
        old_status = None
        if not is_new:
            try:
                old_status = Flight.objects.only('status').get(pk=self.pk).status
            except Flight.DoesNotExist:
                pass
        super().save(*args, **kwargs)
        if old_status is not None and old_status != self.status:
            from apps.notifications.services import NotificationService
            NotificationService.send_flight_status_notification(self, old_status, self.status)

    def __str__(self) -> str:
        return f"{self.flight_number} ({self.source_airport} -> {self.destination_airport})"


# ─── New normalised schema ──────────────────────────────────────────────────────

class Country(models.Model):
    name = models.CharField(max_length=100)
    iso_code = models.CharField(max_length=3, unique=True, db_index=True)

    class Meta:
        verbose_name_plural = "Countries"
        ordering = ["id"]

    def clean(self):
        if self.iso_code:
            self.iso_code = self.iso_code.strip().upper()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.iso_code})"


class Airport(models.Model):
    iata_code = models.CharField(max_length=3, unique=True, db_index=True)
    airport_name = models.CharField(max_length=200)
    city = models.CharField(max_length=100)
    timezone = models.CharField(max_length=100, blank=True, default="UTC")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    country = models.ForeignKey(Country, on_delete=models.PROTECT, related_name="airports")
    terminals = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["iata_code"]

    def clean(self):
        if self.iata_code:
            self.iata_code = self.iata_code.strip().upper()
            if len(self.iata_code) != 3:
                raise ValidationError({"iata_code": "Airport IATA code must be exactly 3 characters."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.iata_code} – {self.airport_name}"


class Airline(models.Model):
    iata_airline_code = models.CharField(max_length=2, unique=True, db_index=True)
    airline_name = models.CharField(max_length=200)

    class Meta:
        ordering = ["airline_name"]

    def clean(self):
        if self.iata_airline_code:
            self.iata_airline_code = self.iata_airline_code.strip().upper()
            if len(self.iata_airline_code) != 2:
                raise ValidationError({"iata_airline_code": "Airline IATA code must be exactly 2 characters."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.iata_airline_code} – {self.airline_name}"


class AircraftModel(models.Model):
    manufacturer = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)

    class Meta:
        ordering = ["manufacturer", "model_name"]
        unique_together = [["manufacturer", "model_name"]]

    def __str__(self):
        return f"{self.manufacturer} {self.model_name}"


class Aircraft(models.Model):
    registration = models.CharField(max_length=20, unique=True, db_index=True)
    airline = models.ForeignKey(Airline, on_delete=models.PROTECT, related_name="aircraft")
    aircraft_model = models.ForeignKey(AircraftModel, on_delete=models.PROTECT, related_name="aircraft")
    economy_capacity = models.PositiveIntegerField(default=0)
    business_capacity = models.PositiveIntegerField(default=0)
    first_class_capacity = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["registration"]
        verbose_name_plural = "Aircraft"

    def __str__(self):
        return f"{self.registration} ({self.airline.iata_airline_code})"


class FlightRoute(models.Model):
    """
    Route template — defines the flight number, airline, baggage rules, and legs.
    Corresponds to 'flight' in the new DB schema.
    """
    flight_no = models.CharField(max_length=20, unique=True, db_index=True)
    airline = models.ForeignKey(Airline, on_delete=models.PROTECT, related_name="flight_routes")
    baggage_weight_allowed_per_person = models.DecimalField(
        max_digits=6, decimal_places=2, default=20
    )
    baggage_number_allowed_per_person = models.PositiveIntegerField(null=True, blank=True)
    handbag_weight_allowed_per_person = models.DecimalField(
        max_digits=6, decimal_places=2, default=7
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["flight_no"]

    def clean(self):
        if self.baggage_weight_allowed_per_person is not None and self.baggage_weight_allowed_per_person < 0:
            raise ValidationError({"baggage_weight_allowed_per_person": "Baggage weight cannot be negative."})
        if self.handbag_weight_allowed_per_person is not None and self.handbag_weight_allowed_per_person < 0:
            raise ValidationError({"handbag_weight_allowed_per_person": "Handbag weight cannot be negative."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.flight_no} ({self.airline.iata_airline_code})"


class FlightLeg(models.Model):
    flight = models.ForeignKey(FlightRoute, on_delete=models.CASCADE, related_name="legs")
    leg_order = models.PositiveIntegerField()
    departure_airport = models.ForeignKey(
        Airport, on_delete=models.PROTECT, related_name="departure_legs"
    )
    arrival_airport = models.ForeignKey(
        Airport, on_delete=models.PROTECT, related_name="arrival_legs"
    )
    flight_duration_minutes = models.PositiveIntegerField(default=120, help_text="Duration of flight leg in minutes")
    layover_duration_minutes = models.PositiveIntegerField(default=0, help_text="Layover duration before this leg in minutes")
    scheduled_departure = models.DateTimeField(null=True, blank=True)
    scheduled_arrival = models.DateTimeField(null=True, blank=True)
    actual_departure = models.DateTimeField(null=True, blank=True)
    actual_arrival = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["flight", "leg_order"]
        unique_together = [["flight", "leg_order"]]

    def clean(self):
        errors = {}
        if self.departure_airport_id and self.arrival_airport_id:
            if self.departure_airport_id == self.arrival_airport_id:
                errors["arrival_airport"] = "Arrival airport must differ from departure airport."
        if self.scheduled_departure and self.scheduled_arrival:
            if self.scheduled_arrival <= self.scheduled_departure:
                errors["scheduled_arrival"] = "Scheduled arrival must be after scheduled departure."
        if self.flight_duration_minutes is not None and self.flight_duration_minutes <= 0:
            errors["flight_duration_minutes"] = "Flight duration must be greater than 0 minutes."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.flight.flight_no} Leg {self.leg_order}"


class InstanceStatus(models.TextChoices):
    SCHEDULED = "SCHEDULED", "Scheduled"
    DELAYED = "DELAYED", "Delayed"
    CANCELLED = "CANCELLED", "Cancelled"
    BOARDING = "BOARDING", "Boarding"
    DEPARTED = "DEPARTED", "Departed"
    ARRIVED = "ARRIVED", "Arrived"


class FlightInstance(models.Model):
    """
    A dated occurrence of a FlightRoute operated by a specific Aircraft.
    """
    flight = models.ForeignKey(FlightRoute, on_delete=models.PROTECT, related_name="instances")
    date = models.DateField()
    aircraft = models.ForeignKey(Aircraft, on_delete=models.PROTECT, related_name="instances")
    status = models.CharField(
        max_length=20, choices=InstanceStatus.choices, default=InstanceStatus.SCHEDULED
    )
    scheduled_departure = models.DateTimeField()
    scheduled_arrival = models.DateTimeField()
    actual_departure = models.DateTimeField(null=True, blank=True)
    actual_arrival = models.DateTimeField(null=True, blank=True)
    checkin_open = models.DateTimeField(null=True, blank=True)
    boarding_time = models.DateTimeField(null=True, blank=True)
    delay_minutes = models.PositiveIntegerField(default=0, help_text="Delay in minutes (0 = no delay)")
    boarding_gate = models.CharField(max_length=10, blank=True, default="")
    departure_terminal = models.CharField(max_length=10, blank=True, default="")
    arrival_terminal = models.CharField(max_length=10, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "flight"]

    def clean(self):
        if self.scheduled_departure and self.scheduled_arrival:
            if self.scheduled_arrival <= self.scheduled_departure:
                raise ValidationError(
                    {"scheduled_arrival": "Scheduled arrival must be after scheduled departure."}
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        # Sync status to legacy Flight model for backwards compatibility with customer frontend.
        # NOTE: We must NOT call legacy_flight.save(update_fields=...) because that skips
        # Flight.save() and its notification hook.  Instead we grab the old status, do a
        # targeted UPDATE, then fire the notification service ourselves.
        try:
            legacy_flight = Flight.objects.filter(flight_number=self.flight.flight_no).first()
            if legacy_flight and legacy_flight.status != self.status:
                old_status = legacy_flight.status
                # Use queryset update to avoid triggering Flight.save()'s full_clean + notification
                # We then fire the notification manually below.
                Flight.objects.filter(pk=legacy_flight.pk).update(status=self.status)
                # Refresh local object so it reflects the new status
                legacy_flight.status = self.status
                # Fire the notification that Flight.save() would have sent
                from apps.notifications.services import NotificationService
                NotificationService.send_flight_status_notification(legacy_flight, old_status, self.status)
        except Exception:
            logger.exception("Failed to send flight status notification during FlightInstance sync")

    def __str__(self):
        return f"{self.flight.flight_no} / {self.date}"


class CabinClass(models.TextChoices):
    ECONOMY = "ECONOMY", "Economy"
    BUSINESS = "BUSINESS", "Business"
    FIRST = "FIRST", "First"


class SeatPosition(models.TextChoices):
    WINDOW = "window", "Window"
    AISLE = "aisle", "Aisle"
    MIDDLE = "middle", "Middle"


class SeatStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    HELD = "HELD", "Held"
    BOOKED = "BOOKED", "Booked"
    BLOCKED = "BLOCKED", "Blocked"


class Seat(models.Model):
    flight_instance = models.ForeignKey(
        FlightInstance, on_delete=models.CASCADE, related_name="seats"
    )
    seat_number = models.CharField(max_length=5)
    seat_class = models.CharField(max_length=10, choices=CabinClass.choices)
    position = models.CharField(
        max_length=10, choices=SeatPosition.choices, blank=True, default=""
    )
    status = models.CharField(
        max_length=10, choices=SeatStatus.choices, default=SeatStatus.AVAILABLE
    )
    exit_row = models.BooleanField(default=False)
    extra_legroom = models.BooleanField(default=False)
    seat_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="INR")
    # Tracks which attribute rule last set the price — used for conflict badge.
    last_rule_applied = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        ordering = ["seat_number"]
        unique_together = [["flight_instance", "seat_number"]]

    @property
    def attributes(self):
        """Return a list of attribute tags derived from position/flag fields."""
        attrs = []
        if self.position:
            attrs.append(self.position)   # 'window' | 'aisle' | 'middle'
        if self.exit_row:
            attrs.append('exit_row')
        if self.extra_legroom:
            attrs.append('extra_legroom')
        return attrs

    def clean(self):
        if self.seat_fee is not None and self.seat_fee < 0:
            raise ValidationError({"seat_fee": "Seat fee cannot be negative."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.seat_number} ({self.seat_class}) – {self.flight_instance}"


class SeatPriceTemplate(models.Model):
    """
    Stores a named attribute→price mapping that can be reused across
    flight instances of the same aircraft type.
    """
    aircraft_model = models.ForeignKey(
        AircraftModel, on_delete=models.CASCADE, related_name="seat_price_templates"
    )
    name = models.CharField(max_length=100)
    rules = models.JSONField(
        default=list,
        help_text=(
            'List of {"attribute": "window"|"aisle"|"middle"|"exit_row"|"extra_legroom", '
            '"price": <number>} dicts ordered by priority (last wins on conflict).'
        )
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["aircraft_model", "name"]
        unique_together = [["aircraft_model", "name"]]

    def __str__(self) -> str:
        return f"{self.name} ({self.aircraft_model})"


class RefundType(models.TextChoices):
    REFUNDABLE = "REFUNDABLE", "Refundable"
    NON_REFUNDABLE = "NON_REFUNDABLE", "Non-Refundable"
    PARTIAL = "PARTIAL", "Partial"


class Fare(models.Model):
    flight_instance = models.ForeignKey(
        FlightInstance, on_delete=models.CASCADE, related_name="fares"
    )
    fare_code = models.CharField(max_length=20)
    cabin_class = models.CharField(max_length=10, choices=CabinClass.choices)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")
    available_seats = models.IntegerField(default=0)
    refund_type = models.CharField(
        max_length=20, choices=RefundType.choices, default=RefundType.NON_REFUNDABLE
    )
    change_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    meal_included = models.BooleanField(default=False)
    baggage_allowance = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Override flight-level baggage allowance (kg). Leave blank to use flight default."
    )

    class Meta:
        ordering = ["flight_instance", "cabin_class", "price"]

    def clean(self):
        errors = {}
        if self.price is not None and self.price < 0:
            errors["price"] = "Price cannot be negative."
        if self.change_fee is not None and self.change_fee < 0:
            errors["change_fee"] = "Change fee cannot be negative."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.fare_code} ({self.cabin_class}) – {self.flight_instance}"


class FoodItem(models.Model):
    airline = models.ForeignKey(Airline, on_delete=models.CASCADE, related_name="food_items")
    name = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="INR")
    is_veg = models.BooleanField(default=False)
    is_halal = models.BooleanField(default=False)
    is_vegan = models.BooleanField(default=False)
    image = models.ImageField(upload_to="food_items/", null=True, blank=True)

    class Meta:
        ordering = ["airline", "name"]

    def clean(self):
        if self.price is not None and self.price < 0:
            raise ValidationError({"price": "Price cannot be negative."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.airline.iata_airline_code})"


class FlightMeal(models.Model):
    flight_instance = models.ForeignKey(
        FlightInstance, on_delete=models.CASCADE, related_name="meals"
    )
    name = models.CharField(max_length=200)

    class Meta:
        ordering = ["flight_instance", "name"]

    def __str__(self):
        return f"{self.name} – {self.flight_instance}"


class FlightMealItem(models.Model):
    flight_meal = models.ForeignKey(
        FlightMeal, on_delete=models.CASCADE, related_name="items"
    )
    food_item = models.ForeignKey(
        FoodItem, on_delete=models.PROTECT, related_name="meal_items"
    )
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["flight_meal", "food_item"]
        unique_together = [["flight_meal", "food_item"]]

    def __str__(self):
        return f"{self.food_item.name} x{self.quantity} in {self.flight_meal}"