import uuid
from datetime import timedelta
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.flights.models import FlightInstance, CabinClass, FoodItem, FlightMeal, FlightLeg, Seat


class BookingStatus(models.TextChoices):
    CONFIRMED = "CONFIRMED", "Confirmed"
    CANCELLED = "CANCELLED", "Cancelled"


class Booking(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bookings"
    )
    flight = models.ForeignKey(
        FlightInstance,
        on_delete=models.PROTECT,
        related_name="bookings"
    )
    status = models.CharField(
        max_length=20,
        choices=BookingStatus.choices,
        default=BookingStatus.CONFIRMED
    )
    cabin_class = models.CharField(
        max_length=10,
        choices=CabinClass.choices,
        null=True,
        blank=True
    )
    seat_count = models.PositiveIntegerField(default=1)
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} - {self.flight.flight.flight_no} ({self.flight.date}) - {self.status}"


class Passenger(models.Model):
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other')
    ]
    MEAL_PREF_CHOICES = [
        ('VEG', 'Vegetarian'),
        ('NON_VEG', 'Non-Vegetarian'),
        ('NONE', 'No Preference')
    ]
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='passengers')
    name = models.CharField(max_length=255)
    age = models.PositiveIntegerField()
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    meal_preference = models.CharField(
        max_length=10,
        choices=MEAL_PREF_CHOICES,
        default='NONE',
        help_text="Complimentary in-flight meal preference"
    )
    seat_number = models.CharField(max_length=10, null=True, blank=True, help_text="Allocated seat number (e.g. 12A)")
    extra_baggage_kg = models.DecimalField(
        max_digits=6, decimal_places=2, default=0.00, help_text="Purchased extra baggage in kg"
    )
    extra_baggage_cost = models.DecimalField(
        max_digits=10, decimal_places=2, default=0.00, help_text="Total cost for extra baggage in booking currency"
    )

    def __str__(self):
        return f"{self.name} - {self.booking.flight.flight.flight_no}"


class PassengerMeal(models.Model):
    passenger = models.ForeignKey(Passenger, on_delete=models.CASCADE, related_name='selected_meals')
    flight_leg = models.ForeignKey(FlightLeg, on_delete=models.PROTECT, null=True, blank=True, help_text="Specific leg for multi-leg flights")
    food_item = models.ForeignKey(FoodItem, on_delete=models.PROTECT, null=True, blank=True)
    flight_meal = models.ForeignKey(FlightMeal, on_delete=models.PROTECT, null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price snapshot at booking time")

    def clean(self):
        from django.core.exceptions import ValidationError
        if not self.food_item and not self.flight_meal:
            raise ValidationError("Either a FoodItem or a FlightMeal must be specified.")
        if self.food_item and self.flight_meal:
            raise ValidationError("Cannot specify both FoodItem and FlightMeal in a single PassengerMeal entry.")
        if self.quantity <= 0:
            raise ValidationError("Quantity must be greater than zero.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        item_name = self.food_item.name if self.food_item else self.flight_meal.name
        leg_info = f" (Leg {self.flight_leg.leg_order})" if self.flight_leg else ""
        return f"{self.passenger.name} - {item_name} x{self.quantity}{leg_info}"


SEAT_HOLD_MINUTES = 10


class SeatHold(models.Model):
    """
    Represents a temporary 10-minute hold on a seat for a user.
    When expires_at < now(), the hold is stale and will be lazily cleaned up
    on the next read request (seat map fetch or booking attempt).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seat = models.OneToOneField(
        Seat,
        on_delete=models.CASCADE,
        related_name="hold",
    )
    flight_instance = models.ForeignKey(
        FlightInstance,
        on_delete=models.CASCADE,
        related_name="seat_holds",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="seat_holds",
    )
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["expires_at"]

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=SEAT_HOLD_MINUTES)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def seconds_remaining(self):
        delta = self.expires_at - timezone.now()
        return max(0, int(delta.total_seconds()))

    def __str__(self):
        return f"Hold({self.seat.seat_number} / {self.flight_instance} / {self.user})"