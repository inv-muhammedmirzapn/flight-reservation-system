import uuid
from django.db import models
from django.conf import settings
from apps.flights.models import FlightInstance, CabinClass


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
        on_delete=models.CASCADE,
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
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='passengers')
    name = models.CharField(max_length=255)
    age = models.PositiveIntegerField()
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    seat_number = models.CharField(max_length=10, null=True, blank=True, help_text="Allocated seat number (e.g. 12A)")

    def __str__(self):
        return f"{self.name} - {self.booking.flight.flight.flight_no}"