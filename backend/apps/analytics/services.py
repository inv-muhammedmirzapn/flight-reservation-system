"""
Analytics services — aggregation logic for the M7 admin dashboard.
All functions query the existing Booking and Flight models at run-time.
No additional database tables are required.
"""
from django.db.models import (
    Count, Sum, Avg, FloatField, ExpressionWrapper, F, Q
)
from django.db.models.functions import TruncMonth, ExtractHour
from django.utils import timezone
from datetime import timedelta

from apps.bookings.models import Booking, BookingStatus
from apps.flights.models import Flight


def get_summary_stats() -> dict:
    """
    Returns high-level booking statistics:
      - total_bookings
      - confirmed_bookings
      - cancelled_bookings
      - cancellation_rate  (%)
      - total_revenue      (sum of base_fare for confirmed bookings)
    """
    total = Booking.objects.count()
    confirmed = Booking.objects.filter(status=BookingStatus.CONFIRMED).count()
    cancelled = Booking.objects.filter(status=BookingStatus.CANCELLED).count()

    cancellation_rate = round((cancelled / total * 100), 2) if total > 0 else 0.0

    revenue_result = (
        Booking.objects
        .filter(status=BookingStatus.CONFIRMED)
        .aggregate(total=Sum("flight__base_fare"))
    )
    total_revenue = float(revenue_result["total"] or 0)

    return {
        "total_bookings": total,
        "confirmed_bookings": confirmed,
        "cancelled_bookings": cancelled,
        "cancellation_rate": cancellation_rate,
        "total_revenue": total_revenue,
    }


def get_monthly_revenue(months: int = 12) -> list:
    """
    Returns revenue grouped by calendar month for the last `months` months.
    Each item: { month: "YYYY-MM", revenue: float }
    """
    cutoff = timezone.now() - timedelta(days=months * 30)

    qs = (
        Booking.objects
        .filter(status=BookingStatus.CONFIRMED, created_at__gte=cutoff)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(revenue=Sum("flight__base_fare"))
        .order_by("month")
    )

    return [
        {
            "month": item["month"].strftime("%Y-%m"),
            "revenue": float(item["revenue"] or 0),
        }
        for item in qs
    ]


def get_popular_routes(top_n: int = 10) -> list:
    """
    Returns the top N routes by confirmed booking count.
    Each item: { source: str, destination: str, bookings: int }
    """
    qs = (
        Booking.objects
        .filter(status=BookingStatus.CONFIRMED)
        .values(
            source=F("flight__source_airport"),
            destination=F("flight__destination_airport"),
        )
        .annotate(bookings=Count("id"))
        .order_by("-bookings")[:top_n]
    )

    return [
        {
            "source": item["source"],
            "destination": item["destination"],
            "bookings": item["bookings"],
            "route": f"{item['source']} → {item['destination']}",
        }
        for item in qs
    ]


def get_flight_occupancy(top_n: int = 20) -> list:
    """
    Returns per-flight occupancy stats for the top N most booked flights.
    occupancy_rate = (total_seats - available_seats) / total_seats * 100
    Each item: { flight_number, route, total_seats, booked_seats, occupancy_rate }
    """
    qs = (
        Flight.objects
        .annotate(booking_count=Count("bookings", filter=Q(bookings__status=BookingStatus.CONFIRMED)))
        .filter(total_seats__gt=0)
        .order_by("-booking_count")[:top_n]
    )

    results = []
    for flight in qs:
        booked_seats = flight.total_seats - flight.available_seats
        occupancy_rate = round((booked_seats / flight.total_seats) * 100, 2)
        results.append({
            "flight_number": flight.flight_number,
            "airline": flight.airline,
            "route": f"{flight.source_airport} → {flight.destination_airport}",
            "total_seats": flight.total_seats,
            "booked_seats": booked_seats,
            "available_seats": flight.available_seats,
            "occupancy_rate": occupancy_rate,
        })

    return results


def get_peak_booking_hours() -> list:
    """
    Returns booking counts grouped by hour-of-day (0–23).
    Each item: { hour: int, bookings: int }
    """
    qs = (
        Booking.objects
        .annotate(hour=ExtractHour("created_at"))
        .values("hour")
        .annotate(bookings=Count("id"))
        .order_by("hour")
    )

    # Build a full 0–23 list filling missing hours with 0
    hour_map = {item["hour"]: item["bookings"] for item in qs}
    return [
        {"hour": h, "bookings": hour_map.get(h, 0)}
        for h in range(24)
    ]