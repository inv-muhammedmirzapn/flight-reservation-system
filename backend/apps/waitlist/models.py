import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.flights.models import Flight, CabinClass
from apps.bookings.models import Booking


class WaitlistStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    CONFIRMED = "CONFIRMED", "Confirmed"
    CANCELLED = "CANCELLED", "Cancelled"
    EXPIRED = "EXPIRED", "Expired"


class WaitlistEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="waitlist_entries",
    )
    flight = models.ForeignKey(
        Flight,
        on_delete=models.CASCADE,
        related_name="waitlist_entries",
    )
    seat_count = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(9)],
    )
    cabin_class = models.CharField(
        max_length=10,
        choices=CabinClass.choices,
        default=CabinClass.ECONOMY
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=WaitlistStatus.choices,
        default=WaitlistStatus.PENDING,
    )
    booking = models.ForeignKey(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="waitlist_source",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name_plural = "Waitlist Entries"

    def save(self, *args, **kwargs):
        if not self.price and self.flight:
            self.price = self.flight.base_fare * self.seat_count
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user} - {self.flight.flight_number} - {self.status}"

class WaitlistPassenger(models.Model):
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other')
    ]
    waitlist_entry = models.ForeignKey(WaitlistEntry, on_delete=models.CASCADE, related_name='passengers')
    name = models.CharField(max_length=255)
    age = models.PositiveIntegerField()
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    phone_number = models.CharField(max_length=20, null=True, blank=True)

    def __str__(self):
        return f"{self.name} - {self.waitlist_entry.flight.flight_number}"