from django.db import models
from django.conf import settings

class NotificationType(models.TextChoices):
    BOOKING_CONFIRMED = 'BOOKING_CONFIRMED', 'Booking Confirmed'
    BOOKING_CANCELLED = 'BOOKING_CANCELLED', 'Booking Cancelled'
    WAITLIST_ALLOCATED = 'WAITLIST_ALLOCATED', 'Waitlist Allocated'
    FLIGHT_DELAYED = 'FLIGHT_DELAYED', 'Flight Delayed'
    FLIGHT_CANCELLED = 'FLIGHT_CANCELLED', 'Flight Cancelled'
    FLIGHT_BOARDING = 'FLIGHT_BOARDING', 'Flight Boarding'
    FLIGHT_DEPARTED = 'FLIGHT_DEPARTED', 'Flight Departed'
    FLIGHT_ARRIVED = 'FLIGHT_ARRIVED', 'Flight Arrived'

class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, choices=NotificationType.choices)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.notification_type}] {self.title} - {self.user.email}"