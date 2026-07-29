from django.db.models import (
    Count, Sum, Avg, FloatField, ExpressionWrapper, F, Q
)
from django.db.models.functions import TruncMonth, ExtractHour
from django.utils import timezone
from datetime import timedelta
from dateutil.relativedelta import relativedelta

from apps.bookings.models import Booking, BookingStatus
from apps.flights.models import FlightInstance, InstanceStatus, Seat, SeatStatus, FlightRoute


def get_summary_stats() -> dict:
    """
    Returns high-level booking and fleet statistics:
      - total_bookings
      - confirmed_bookings
      - cancelled_bookings
      - cancellation_rate  (%)
      - total_revenue      (sum of base_fare for confirmed bookings)
      - total_flights      (total flight records in DB)
      - scheduled_flights  (flights with SCHEDULED status)
      - avg_occupancy      (average occupancy % across all flights with seats > 0)
    """
    total = Booking.objects.count()
    confirmed = Booking.objects.filter(status=BookingStatus.CONFIRMED).count()
    cancelled = Booking.objects.filter(status=BookingStatus.CANCELLED).count()

    cancellation_rate = round((cancelled / total * 100), 2) if total > 0 else 0.0

    revenue_result = (
        Booking.objects
        .filter(status=BookingStatus.CONFIRMED)
        .aggregate(total=Sum("total_price"))
    )
    total_revenue = float(revenue_result["total"] or 0)

    # Fleet stats
    total_flights = FlightInstance.objects.count()
    scheduled_flights = FlightInstance.objects.filter(status=InstanceStatus.SCHEDULED).count()

    # Average occupancy across all flights that have at least one seat
    total_capacity = Seat.objects.count()
    total_booked_seats = Seat.objects.filter(status=SeatStatus.BOOKED).count()
    avg_occupancy = round((total_booked_seats / total_capacity * 100), 1) if total_capacity > 0 else 0.0

    return {
        "total_bookings": total,
        "confirmed_bookings": confirmed,
        "cancelled_bookings": cancelled,
        "cancellation_rate": cancellation_rate,
        "total_revenue": total_revenue,
        "total_flights": total_flights,
        "scheduled_flights": scheduled_flights,
        "avg_occupancy": avg_occupancy,
    }


def get_monthly_revenue(months: int = 12) -> list:
    """
    Returns revenue grouped by calendar month for the last `months` months.
    Each item: { month: "YYYY-MM", revenue: float }
    """
    cutoff = timezone.now() - relativedelta(months=months)

    qs = (
        Booking.objects
        .filter(status=BookingStatus.CONFIRMED, created_at__gte=cutoff)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(revenue=Sum("total_price"))
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
        .values(route_id=F("flight__flight"))
        .annotate(bookings=Count("id"))
        .order_by("-bookings")[:top_n]
    )

    route_ids = [item["route_id"] for item in qs]
    routes = FlightRoute.objects.filter(id__in=route_ids).prefetch_related('legs__departure_airport', 'legs__arrival_airport')
    route_map = {}
    for r in routes:
        first_leg = r.legs.order_by('leg_order').first()
        last_leg = r.legs.order_by('leg_order').last()
        route_map[r.id] = {
            "source": first_leg.departure_airport.iata_code if first_leg else "N/A",
            "destination": last_leg.arrival_airport.iata_code if last_leg else "N/A"
        }

    return [
        {
            "source": route_map[item["route_id"]]["source"],
            "destination": route_map[item["route_id"]]["destination"],
            "bookings": item["bookings"],
            "route": f"{route_map[item['route_id']]['source']} → {route_map[item['route_id']]['destination']}",
        }
        for item in qs
    ]


def get_flight_occupancy(top_n: int = 15) -> list:
    """
    Returns per-flight occupancy stats for the top N flights by occupancy rate.
    occupancy_rate = (total_seats - available_seats) / total_seats * 100
    Each item: { flight_number, route, total_seats, booked_seats, occupancy_rate }
    Sorted highest occupancy first so the chart renders in a meaningful order.
    """
    # Fetch a wider pool (top_n * 4) by booking count, then re-rank by occupancy_rate
    pool = top_n * 4
    qs = (
        FlightInstance.objects
        .annotate(
            booking_count=Count("bookings", filter=Q(bookings__status=BookingStatus.CONFIRMED)),
            total_seats_annotated=Count("seats"),
            booked_seats_annotated=Count("seats", filter=Q(seats__status=SeatStatus.BOOKED))
        )
        .filter(total_seats_annotated__gt=0)
        .order_by("-booking_count")[:pool]
    )

    results = []
    for flight in qs:
        occupancy_rate = round((flight.booked_seats_annotated / flight.total_seats_annotated) * 100, 2)
        
        first_leg = flight.flight.legs.order_by('leg_order').first()
        last_leg = flight.flight.legs.order_by('leg_order').last()
        source = first_leg.departure_airport.iata_code if first_leg else "N/A"
        dest = last_leg.arrival_airport.iata_code if last_leg else "N/A"

        results.append({
            "flight_number": flight.flight.flight_no,
            "airline": flight.flight.airline.airline_name,
            "route": f"{source} → {dest}",
            "total_seats": flight.total_seats_annotated,
            "booked_seats": flight.booked_seats_annotated,
            "available_seats": flight.total_seats_annotated - flight.booked_seats_annotated,
            "occupancy_rate": occupancy_rate,
        })

    # Sort by occupancy_rate descending, then return top_n
    results.sort(key=lambda x: x["occupancy_rate"], reverse=True)
    return results[:top_n]


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