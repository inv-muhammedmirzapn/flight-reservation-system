from django.db.models import (
    Count, Sum, Avg, FloatField, ExpressionWrapper, F, Q
)
from django.db.models.functions import TruncMonth, ExtractHour
from django.utils import timezone
from datetime import timedelta
from dateutil.relativedelta import relativedelta

from apps.bookings.models import Booking, BookingStatus
from apps.flights.models import (
    FlightInstance, InstanceStatus, Fare, Seat,
    Airline, Aircraft, CabinClass, FlightRoute, FlightLeg
)



def _apply_booking_filters(qs, start_date=None, end_date=None,
                           airline_id=None, aircraft_id=None):
    """Apply optional date/airline/aircraft filters to a Booking queryset."""
    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)
    if airline_id:
        qs = qs.filter(flight__flight__airline_id=airline_id)
    if aircraft_id:
        qs = qs.filter(flight__aircraft_id=aircraft_id)
    return qs


def _apply_instance_filters(qs, start_date=None, end_date=None,
                             airline_id=None, aircraft_id=None):
    """Apply optional filters to a FlightInstance queryset."""
    if start_date:
        qs = qs.filter(scheduled_departure__date__gte=start_date)
    if end_date:
        qs = qs.filter(scheduled_departure__date__lte=end_date)
    if airline_id:
        qs = qs.filter(flight__airline_id=airline_id)
    if aircraft_id:
        qs = qs.filter(aircraft_id=aircraft_id)
    return qs


# ─── Summary Stats ────────────────────────────────────────────────────────────

def get_summary_stats(start_date=None, end_date=None,
                      airline_id=None, aircraft_id=None) -> dict:
    """
    Returns high-level booking and fleet statistics:
      - total_bookings
      - confirmed_bookings
      - cancelled_bookings
      - cancellation_rate  (%)
      - total_revenue      (sum of total_price for confirmed bookings)
      - total_flights      (total FlightInstance records in DB)
      - scheduled_flights  (FlightInstances with SCHEDULED status)
    Supports optional filtering by date range, airline, aircraft.
    """
    base_qs = _apply_booking_filters(
        Booking.objects.all(), start_date, end_date, airline_id, aircraft_id
    )

    total = base_qs.count()
    confirmed = base_qs.filter(status=BookingStatus.CONFIRMED).count()
    cancelled = base_qs.filter(status=BookingStatus.CANCELLED).count()
    cancellation_rate = round((cancelled / total * 100), 2) if total > 0 else 0.0

    revenue_result = (
        base_qs
        .filter(status=BookingStatus.CONFIRMED)
        .aggregate(total=Sum("total_price"))
    )
    total_revenue = float(revenue_result["total"] or 0)

    # Fleet stats from FlightInstance
    fi_qs = _apply_instance_filters(
        FlightInstance.objects.all(), start_date, end_date, airline_id, aircraft_id
    )
    total_flights = fi_qs.count()
    scheduled_flights = fi_qs.filter(status=InstanceStatus.SCHEDULED).count()

    return {
        "total_bookings": total,
        "confirmed_bookings": confirmed,
        "cancelled_bookings": cancelled,
        "cancellation_rate": cancellation_rate,
        "total_revenue": total_revenue,
        "total_flights": total_flights,
        "scheduled_flights": scheduled_flights,
    }


# ─── Monthly Revenue ──────────────────────────────────────────────────────────

def get_monthly_revenue(months: int = 12, start_date=None, end_date=None,
                        airline_id=None, aircraft_id=None) -> list:
    """
    Returns revenue grouped by calendar month for the last `months` months.
    Each item: { month: "YYYY-MM", revenue: float }
    Supports optional filtering by date range, airline, aircraft.
    """
    cutoff = timezone.now() - relativedelta(months=months)

    qs = Booking.objects.filter(status=BookingStatus.CONFIRMED, created_at__gte=cutoff)
    qs = _apply_booking_filters(qs, start_date, end_date, airline_id, aircraft_id)
    qs = (
        qs
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


# ─── Popular Routes ───────────────────────────────────────────────────────────

def get_popular_routes(top_n: int = 10, start_date=None, end_date=None,
                       airline_id=None, aircraft_id=None) -> list:
    """
    Returns the top N routes by confirmed booking count.
    Each item: { source: str, destination: str, bookings: int }
    Routes are derived from FlightInstance → FlightRoute → FlightLeg.
    Supports optional filtering.
    """
    qs = Booking.objects.filter(status=BookingStatus.CONFIRMED)
    qs = _apply_booking_filters(qs, start_date, end_date, airline_id, aircraft_id)
    qs = (
        qs
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
        try:
            fr = FlightRoute.objects.get(flight_no=flight_no)
            first_leg = fr.legs.order_by('leg_order').first()
            last_leg = fr.legs.order_by('leg_order').last()
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


# ─── Flight Occupancy ─────────────────────────────────────────────────────────

def get_flight_occupancy(top_n: int = 15, start_date=None, end_date=None,
                         airline_id=None, aircraft_id=None) -> list:
    """
    Returns per-flight occupancy stats for the top N FlightInstances by occupancy rate.
    occupancy_rate = booked_seats / total_seats * 100
    Each item: { flight_number, route, total_seats, booked_seats, occupancy_rate }
    Sorted highest occupancy first. Supports optional filtering.
    """
    pool = top_n * 4

    instances_qs = FlightInstance.objects.select_related('flight', 'flight__airline')
    instances_qs = _apply_instance_filters(instances_qs, start_date, end_date, airline_id, aircraft_id)
    instances_qs = (
        instances_qs
        .annotate(
            confirmed_bookings=Count(
                'bookings', filter=Q(bookings__status=BookingStatus.CONFIRMED)
            ),
            total_seat_count=Count('seats'),
            booked_seat_count=Count('seats', filter=Q(seats__status='BOOKED')),
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


# ─── Peak Booking Hours ───────────────────────────────────────────────────────

def get_peak_booking_hours(start_date=None, end_date=None,
                           airline_id=None, aircraft_id=None) -> list:
    """
    Returns booking counts grouped by hour-of-day (0–23).
    Each item: { hour: int, bookings: int }
    Supports optional filtering.
    """
    qs = Booking.objects.all()
    qs = _apply_booking_filters(qs, start_date, end_date, airline_id, aircraft_id)
    qs = (
        qs
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


# ─── Airline Performance ──────────────────────────────────────────────────────

def get_airline_performance(top_n: int = 10, start_date=None, end_date=None) -> list:
    """
    Returns per-airline aggregated performance stats (confirmed bookings only).
    Each item: {
        airline_id, airline_name, iata_code,
        total_revenue, total_bookings, cancellation_rate
    }
    """
    # Confirmed booking stats per airline
    confirmed_qs = Booking.objects.filter(status=BookingStatus.CONFIRMED)
    cancelled_qs = Booking.objects.filter(status=BookingStatus.CANCELLED)
    all_qs = Booking.objects.all()

    if start_date:
        confirmed_qs = confirmed_qs.filter(created_at__date__gte=start_date)
        cancelled_qs = cancelled_qs.filter(created_at__date__gte=start_date)
        all_qs = all_qs.filter(created_at__date__gte=start_date)
    if end_date:
        confirmed_qs = confirmed_qs.filter(created_at__date__lte=end_date)
        cancelled_qs = cancelled_qs.filter(created_at__date__lte=end_date)
        all_qs = all_qs.filter(created_at__date__lte=end_date)

    # Group confirmed bookings by airline
    confirmed_by_airline = (
        confirmed_qs
        .values(airline_id=F('flight__flight__airline_id'))
        .annotate(
            total_bookings=Count('id'),
            total_revenue=Sum('total_price'),
        )
        .order_by('-total_bookings')[:top_n]
    )

    # Build lookup maps for cancelled counts and all counts
    cancelled_map = {
        item['airline_id']: item['cnt']
        for item in cancelled_qs
        .values(airline_id=F('flight__flight__airline_id'))
        .annotate(cnt=Count('id'))
    }
    all_map = {
        item['airline_id']: item['cnt']
        for item in all_qs
        .values(airline_id=F('flight__flight__airline_id'))
        .annotate(cnt=Count('id'))
    }

    # Airline details lookup
    airline_objs = {a.id: a for a in Airline.objects.all()}

    results = []
    for item in confirmed_by_airline:
        aid = item['airline_id']
        if aid is None:
            continue
        airline = airline_objs.get(aid)
        if not airline:
            continue

        total_all = all_map.get(aid, 0)
        total_cancelled = cancelled_map.get(aid, 0)
        cancellation_rate = round(total_cancelled / total_all * 100, 2) if total_all > 0 else 0.0

        results.append({
            'airline_id': aid,
            'airline_name': airline.airline_name,
            'iata_code': airline.iata_airline_code,
            'total_revenue': float(item['total_revenue'] or 0),
            'total_bookings': item['total_bookings'],
            'cancellation_rate': cancellation_rate,
        })

    return results


# ─── Aircraft Utilization ─────────────────────────────────────────────────────

def get_aircraft_utilization(top_n: int = 10, start_date=None, end_date=None) -> list:
    """
    Returns per-aircraft utilization stats.
    Each item: {
        aircraft_id, registration, aircraft_model, manufacturer,
        total_flights,
        economy_fill_rate, business_fill_rate, first_fill_rate
    }
    """
    fi_qs = FlightInstance.objects.select_related(
        'aircraft', 'aircraft__aircraft_model', 'aircraft__airline'
    )
    if start_date:
        fi_qs = fi_qs.filter(scheduled_departure__date__gte=start_date)
    if end_date:
        fi_qs = fi_qs.filter(scheduled_departure__date__lte=end_date)

    # Group by aircraft to get total flights
    aircraft_flight_counts = (
        fi_qs
        .values('aircraft_id')
        .annotate(total_flights=Count('id'))
        .order_by('-total_flights')[:top_n]
    )

    aircraft_ids = [row['aircraft_id'] for row in aircraft_flight_counts]
    aircraft_objs = {a.id: a for a in Aircraft.objects.select_related('aircraft_model', 'airline').filter(id__in=aircraft_ids)}
    flight_count_map = {row['aircraft_id']: row['total_flights'] for row in aircraft_flight_counts}

    results = []
    for ac_id in aircraft_ids:
        ac = aircraft_objs.get(ac_id)
        if not ac:
            continue

        instances = fi_qs.filter(aircraft_id=ac_id).annotate(
            # Cabin-class fill rates
            eco_total=Count('seats', filter=Q(seats__seat_class=CabinClass.ECONOMY)),
            eco_booked=Count('seats', filter=Q(seats__seat_class=CabinClass.ECONOMY, seats__status='BOOKED')),
            biz_total=Count('seats', filter=Q(seats__seat_class=CabinClass.BUSINESS)),
            biz_booked=Count('seats', filter=Q(seats__seat_class=CabinClass.BUSINESS, seats__status='BOOKED')),
            first_total=Count('seats', filter=Q(seats__seat_class=CabinClass.FIRST)),
            first_booked=Count('seats', filter=Q(seats__seat_class=CabinClass.FIRST, seats__status='BOOKED')),
        )

        eco_cap = sum(fi.eco_total for fi in instances)
        eco_bkd = sum(fi.eco_booked for fi in instances)
        biz_cap = sum(fi.biz_total for fi in instances)
        biz_bkd = sum(fi.biz_booked for fi in instances)
        first_cap = sum(fi.first_total for fi in instances)
        first_bkd = sum(fi.first_booked for fi in instances)

        results.append({
            'aircraft_id': ac_id,
            'registration': ac.registration,
            'aircraft_model': str(ac.aircraft_model),
            'manufacturer': ac.aircraft_model.manufacturer,
            'airline_name': ac.airline.airline_name,
            'total_flights': flight_count_map[ac_id],
            'economy_fill_rate': round(eco_bkd / eco_cap * 100, 1) if eco_cap > 0 else 0.0,
            'business_fill_rate': round(biz_bkd / biz_cap * 100, 1) if biz_cap > 0 else 0.0,
            'first_fill_rate': round(first_bkd / first_cap * 100, 1) if first_cap > 0 else 0.0,
        })

    return results