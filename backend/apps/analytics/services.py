from django.db.models import (
    Count, Sum, Avg, FloatField, ExpressionWrapper, F, Q
)
from django.db.models.functions import TruncMonth, ExtractHour
from django.utils import timezone
from datetime import timedelta
from dateutil.relativedelta import relativedelta

from apps.bookings.models import Booking, BookingStatus
from apps.flights.models import FlightInstance, InstanceStatus, Fare, Seat


def get_summary_stats() -> dict:
    """
    Returns high-level booking and fleet statistics:
      - total_bookings
      - confirmed_bookings
      - cancelled_bookings
      - cancellation_rate  (%)
      - total_revenue      (sum of total_price for confirmed bookings)
      - total_flights      (total FlightInstance records in DB)
      - scheduled_flights  (FlightInstances with SCHEDULED status)
      - avg_occupancy      (average occupancy % across all instances with seats > 0)
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

    # Fleet stats from FlightInstance
    total_flights = FlightInstance.objects.count()
    scheduled_flights = FlightInstance.objects.filter(status=InstanceStatus.SCHEDULED).count()

    # Average occupancy: (booked seats / total seats) * 100
    # Use the Seat table as source of truth
    from django.db.models import Count as DCount
    instances_qs = FlightInstance.objects.annotate(
        total_seat_count=DCount('seats'),
        booked_seat_count=DCount('seats', filter=Q(seats__status='BOOKED')),
    ).filter(total_seat_count__gt=0)

    total_capacity = sum(fi.total_seat_count for fi in instances_qs)
    total_booked = sum(fi.booked_seat_count for fi in instances_qs)
    avg_occupancy = round((total_booked / total_capacity * 100), 1) if total_capacity > 0 else 0.0

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
    Routes are derived from FlightInstance → FlightRoute → FlightLeg.
    """
    # We aggregate by FlightRoute (flight__flight_no) and extract the first/last leg airports
    qs = (
        Booking.objects
        .filter(status=BookingStatus.CONFIRMED)
        .values(flight_route=F("flight__flight__flight_no"))
        .annotate(bookings=Count("id"))
        .order_by("-bookings")[:top_n * 2]  # fetch extra to allow for leg resolution
    )

    results = []
    seen_routes = set()
    for item in qs:
        flight_no = item["flight_route"]
        if flight_no in seen_routes:
            continue
        seen_routes.add(flight_no)

        # Resolve source/destination from FlightLeg
        from apps.flights.models import FlightRoute, FlightLeg
        try:
            route = FlightRoute.objects.get(flight_no=flight_no)
            first_leg = route.legs.order_by('leg_order').first()
            last_leg = route.legs.order_by('leg_order').last()
            src = first_leg.departure_airport.iata_code if first_leg else "N/A"
            dst = last_leg.arrival_airport.iata_code if last_leg else "N/A"
        except FlightRoute.DoesNotExist:
            src = "N/A"
            dst = "N/A"

        results.append({
            "source": src,
            "destination": dst,
            "bookings": item["bookings"],
            "route": f"{src} → {dst}",
        })

        if len(results) >= top_n:
            break

    return results


def get_flight_occupancy(top_n: int = 15) -> list:
    """
    Returns per-flight occupancy stats for the top N FlightInstances by occupancy rate.
    occupancy_rate = booked_seats / total_seats * 100
    Each item: { flight_number, route, total_seats, booked_seats, occupancy_rate }
    Sorted highest occupancy first.
    """
    pool = top_n * 4
    from django.db.models import Count as DCount

    instances_qs = (
        FlightInstance.objects
        .select_related('flight', 'flight__airline')
        .annotate(
            confirmed_bookings=DCount(
                'bookings', filter=Q(bookings__status=BookingStatus.CONFIRMED)
            ),
            total_seat_count=DCount('seats'),
            booked_seat_count=DCount('seats', filter=Q(seats__status='BOOKED')),
        )
        .filter(total_seat_count__gt=0)
        .order_by('-confirmed_bookings')[:pool]
    )

    results = []
    for fi in instances_qs:
        booked = fi.booked_seat_count
        total = fi.total_seat_count
        occupancy_rate = round((booked / total) * 100, 2) if total > 0 else 0.0

        # Resolve route from legs
        first_leg = fi.flight.legs.order_by('leg_order').first()
        last_leg = fi.flight.legs.order_by('leg_order').last()
        src = first_leg.departure_airport.iata_code if first_leg else "N/A"
        dst = last_leg.arrival_airport.iata_code if last_leg else "N/A"

        results.append({
            "flight_number": fi.flight.flight_no,
            "airline": fi.flight.airline.airline_name,
            "route": f"{src} → {dst}",
            "total_seats": total,
            "booked_seats": booked,
            "available_seats": total - booked,
            "occupancy_rate": occupancy_rate,
        })

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

    hour_map = {item["hour"]: item["bookings"] for item in qs}
    return [
        {"hour": h, "bookings": hour_map.get(h, 0)}
        for h in range(24)
    ]