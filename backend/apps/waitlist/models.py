import uuid
from django.db import models
from django.conf import settings
from apps.flights.models import Flight

class WaitlistStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    ALLOCATED = "ALLOCATED", "Allocated"
    CANCELLED = "CANCELLED", "Cancelled"

class WaitlistEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="waitlist_entries"
    )
    flight = models.ForeignKey(
        Flight,
        on_delete=models.CASCADE,
        related_name="waitlist_entries"
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=WaitlistStatus.choices,
        default=WaitlistStatus.PENDING
    )

    class Meta:
        ordering = ["joined_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "flight"],
                condition=models.Q(status="PENDING"),
                name="unique_pending_waitlist_per_user_flight"
            )
        ]

    def __str__(self):
        return f"{self.user} - {self.flight.flight_number} - {self.status}"