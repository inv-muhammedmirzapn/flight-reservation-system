import logging
import uuid
from decimal import Decimal
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.conf import settings

logger = logging.getLogger(__name__)


# ─── Normalised schema ─────────────────────────────────────────────────────────

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
    logo = models.ImageField(upload_to="airlines/", null=True, blank=True)

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
    economy_layout = models.CharField(max_length=20, default="3-3")
    business_layout = models.CharField(max_length=20, default="2-2")
    first_class_layout = models.CharField(max_length=20, default="2-2")

    class Meta:
        ordering = ["registration"]
        verbose_name_plural = "Aircraft"

    def clean(self):
        import re
        layout_regex = re.compile(r'^\d+(-\d+)*$')
        if self.economy_layout:
            self.economy_layout = self.economy_layout.strip()
            if not layout_regex.match(self.economy_layout):
                raise ValidationError({"economy_layout": "Layout must be numbers separated by hyphens, e.g. 3-3"})
        if self.business_layout:
            self.business_layout = self.business_layout.strip()
            if not layout_regex.match(self.business_layout):
                raise ValidationError({"business_layout": "Layout must be numbers separated by hyphens, e.g. 2-2"})
        if self.first_class_layout:
            self.first_class_layout = self.first_class_layout.strip()
            if not layout_regex.match(self.first_class_layout):
                raise ValidationError({"first_class_layout": "Layout must be numbers separated by hyphens, e.g. 2-2"})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

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
    max_extra_baggage_kg_per_person = models.DecimalField(
        max_digits=6, decimal_places=2, default=20.00
    )
    extra_baggage_price_per_kg = models.DecimalField(
        max_digits=8, decimal_places=2, default=500.00
    )
    extra_baggage_currency = models.CharField(max_length=3, default="INR")
    operates_on_days = models.CharField(
        max_length=13, default="1,2,3,4,5,6,7", help_text="Comma-separated ISO weekdays, e.g. '1,2,3,4,5'"
    )
    valid_from = models.DateField(default=timezone.now)
    valid_until = models.DateField(null=True, blank=True)
    scheduled_departure_time = models.TimeField(null=True, blank=True, help_text="Daily departure time of the whole flight")
    scheduled_arrival_time = models.TimeField(null=True, blank=True, help_text="Daily arrival time of the whole flight")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["flight_no"]

    def clean(self):
        errors = {}
        if self.baggage_weight_allowed_per_person is not None and self.baggage_weight_allowed_per_person < 0:
            errors["baggage_weight_allowed_per_person"] = "Baggage weight cannot be negative."
        if self.handbag_weight_allowed_per_person is not None and self.handbag_weight_allowed_per_person < 0:
            errors["handbag_weight_allowed_per_person"] = "Handbag weight cannot be negative."
        if self.max_extra_baggage_kg_per_person is not None and self.max_extra_baggage_kg_per_person < 0:
            errors["max_extra_baggage_kg_per_person"] = "Max extra baggage weight cannot be negative."
        if self.extra_baggage_price_per_kg is not None and self.extra_baggage_price_per_kg < 0:
            errors["extra_baggage_price_per_kg"] = "Extra baggage price per kg cannot be negative."
        if self.scheduled_departure_time and self.scheduled_arrival_time:
            if self.scheduled_departure_time == self.scheduled_arrival_time:
                errors["scheduled_arrival_time"] = "Scheduled arrival time must differ from departure time."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def origin_airport(self):
        first_leg = self.legs.order_by("leg_order").first()
        return first_leg.departure_airport if first_leg else None

    @property
    def destination_airport(self):
        last_leg = self.legs.order_by("leg_order").last()
        return last_leg.arrival_airport if last_leg else None

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
    scheduled_departure_time = models.TimeField(null=True, blank=True, help_text="Leg scheduled departure time")
    scheduled_arrival_time = models.TimeField(null=True, blank=True, help_text="Leg scheduled arrival time")
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
    flight = models.ForeignKey(FlightRoute, on_delete=models.CASCADE, related_name="instances")
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


class RouteFareClass(models.Model):
    """
    Defines which cabin classes a route sells and their BASE price template.
    One row per cabin/fare_code per route.
    """
    route = models.ForeignKey("FlightRoute", related_name="fare_classes", on_delete=models.CASCADE)
    cabin_class = models.CharField(max_length=10, choices=CabinClass.choices)
    fare_code = models.CharField(max_length=20)
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")
    refund_type = models.CharField(max_length=20, choices=RefundType.choices, default=RefundType.NON_REFUNDABLE)
    change_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    meal_included = models.BooleanField(default=False)
    baggage_weight_allowed_kg = models.PositiveIntegerField(default=15)
    extra_baggage_price_per_kg = models.DecimalField(max_digits=8, decimal_places=2, default=500.00)

    class Meta:
        ordering = ["route", "cabin_class", "fare_code"]
        unique_together = [["route", "cabin_class", "fare_code"]]

    def clean(self):
        errors = {}
        if self.base_price is not None and self.base_price < 0:
            errors["base_price"] = "Base price cannot be negative."
        if self.change_fee is not None and self.change_fee < 0:
            errors["change_fee"] = "Change fee cannot be negative."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.fare_code} ({self.cabin_class}) – Route {self.route.flight_no}"


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
        help_text="Override flight-level checked baggage allowance (kg). Leave blank to use flight default."
    )
    handbag_allowance = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Override flight-level handbag allowance (kg). Leave blank to use flight default."
    )
    baggage_pieces_allowance = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Override flight-level free checked piece count. Leave blank to use flight default."
    )

    class Meta:
        ordering = ["flight_instance", "cabin_class", "price"]

    @property
    def effective_baggage_allowance_kg(self):
        if self.baggage_allowance is not None:
            return self.baggage_allowance
        return self.flight_instance.flight.baggage_weight_allowed_per_person

    @property
    def effective_handbag_allowance_kg(self):
        if self.handbag_allowance is not None:
            return self.handbag_allowance
        return self.flight_instance.flight.handbag_weight_allowed_per_person

    @property
    def effective_baggage_pieces(self):
        if self.baggage_pieces_allowance is not None:
            return self.baggage_pieces_allowance
        return self.flight_instance.flight.baggage_number_allowed_per_person

    def clean(self):
        errors = {}
        if self.price is not None and self.price < 0:
            errors["price"] = "Price cannot be negative."
        if self.change_fee is not None and self.change_fee < 0:
            errors["change_fee"] = "Change fee cannot be negative."
        if self.baggage_allowance is not None and self.baggage_allowance < 0:
            errors["baggage_allowance"] = "Baggage allowance cannot be negative."
        if self.handbag_allowance is not None and self.handbag_allowance < 0:
            errors["handbag_allowance"] = "Handbag allowance cannot be negative."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.fare_code} ({self.cabin_class}) – {self.flight_instance}"


class FarePriceChangeLog(models.Model):
    """
    Audit log for tracking base price and per-instance fare price changes.
    """
    route_fare = models.ForeignKey(
        RouteFareClass, related_name="price_changes", on_delete=models.CASCADE, null=True, blank=True
    )
    fare = models.ForeignKey(
        Fare, related_name="price_changes", on_delete=models.CASCADE, null=True, blank=True
    )
    old_price = models.DecimalField(max_digits=10, decimal_places=2)
    new_price = models.DecimalField(max_digits=10, decimal_places=2)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-changed_at"]

    def __str__(self):
        target = f"RouteFare #{self.route_fare_id}" if self.route_fare_id else f"Fare #{self.fare_id}"
        return f"{target}: {self.old_price} -> {self.new_price} at {self.changed_at}"


class FoodItem(models.Model):
    airline = models.ForeignKey(Airline, on_delete=models.PROTECT, related_name="food_items")
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
    price = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)

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


from apps.pricing.models import DynamicPricingConfig, HolidayEvent, DynamicPriceLog