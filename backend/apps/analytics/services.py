from django.db.models import (
    Count, Sum, F, Q
)
from django.db.models.functions import TruncMonth, ExtractHour
from django.utils import timezone
from dateutil.relativedelta import relativedelta

from apps.bookings.models import Booking, BookingStatus
from apps.flights.models import FlightInstance, InstanceStatus


# ─── Shared filter helpers

#The filtered QuerySet is returned.
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

    #Base booking QuerySet is created using the _apply_booking_filters helper
    base_qs = _apply_booking_filters(
        Booking.objects.all(), start_date, end_date, airline_id, aircraft_id
    )

    total = base_qs.count()
    confirmed = base_qs.filter(status=BookingStatus.CONFIRMED).count()
    cancelled = base_qs.filter(status=BookingStatus.CANCELLED).count()
    cancellation_rate = round((cancelled / total * 100), 2) if total > 0 else 0.0

    #Total revenue from confirmed bookings is calculated by filtering for confirmed bookings and summing their total_price
    revenue_result = (
        base_qs
        .filter(status=BookingStatus.CONFIRMED)
        .aggregate(total=Sum("total_price"))
    )
    #Convert revenue to float and handels the case where there is no revenue
    total_revenue = float(revenue_result["total"] or 0)

    # Fleet stats from FlightInstance
    fi_qs = _apply_instance_filters(
        FlightInstance.objects.all(), start_date, end_date, airline_id, aircraft_id
    )
    total_flights = fi_qs.count()
    scheduled_flights = fi_qs.filter(status=InstanceStatus.SCHEDULED).count()

    #Return a dictionary
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
    now = timezone.now()
    # To get exactly `months` calendar months, we go back `months - 1` months
    # and start from the first day of that month.
    cutoff = (now - relativedelta(months=months - 1)).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )

    # Initialize a dict to ensure all months in the window are present
    revenue_map = {}
    # Starts at the first month.
    curr = cutoff
    end_curr = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # strftime("%Y-%m") converts a date into: 
    #Year(4 digits)-Month(2 digits)
    # E.g. 2025-06
    #This ensures months with zero revenue are still returned
    while curr <= end_curr:
        revenue_map[curr.strftime("%Y-%m")] = 0.0
        curr += relativedelta(months=1)


    qs = Booking.objects.filter(status=BookingStatus.CONFIRMED, created_at__gte=cutoff)
    qs = _apply_booking_filters(qs, start_date, end_date, airline_id, aircraft_id)

    # calculates revenue for each month.
    qs = (
        qs
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(revenue=Sum("total_price"))
        .order_by("month")
    )
    
    # Loop through the database results
    for item in qs:
        month_str = item["month"].strftime("%Y-%m")
        revenue_map[month_str] = float(item["revenue"] or 0)

    #Convert the final result into a list of dicts
    return [
        {"month": m, "revenue": revenue_map[m]}
        for m in sorted(revenue_map.keys())
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
        .annotate(bookings=Count("id")) #Counts bookings for each flight route.
        .order_by("-bookings")[:top_n * 2]  # fetch extra to allow for leg resolution
    )

    #An empty list where final routes will go.
    results = []
    #A set to keep track of flight routes already processed
    seen_routes = set()

    #loop through the database results
    for item in qs:
        #get the flight_no from the item
        flight_no = item["flight_route"]

        #if the flight_no is already in the set, skip it
        if flight_no in seen_routes:
            continue
        seen_routes.add(flight_no)


        # Resolve source/destination from FlightLeg
        from apps.flights.models import FlightRoute, FlightLeg
        try:
            # Find the FlightRoute matching the flight number.
            fr = FlightRoute.objects.get(flight_no=flight_no)
            # Get the first and last leg of the flight route.
            first_leg = fr.legs.order_by('leg_order').first()
            last_leg = fr.legs.order_by('leg_order').last()
            # Get the source and destination airport IATA codes.
            src = first_leg.departure_airport.iata_code if first_leg else "N/A"
            dst = last_leg.arrival_airport.iata_code if last_leg else "N/A"
        
        except FlightRoute.DoesNotExist:
            src = "N/A"
            dst = "N/A"

        #Append the results to the list.
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

    #selects the FlightInstance table with related flight and airline data.
    #select_related acts like a join in sql query.
    instances_qs = FlightInstance.objects.select_related('flight', 'flight__airline')
    
    #distinct=True helps prevent duplicate counting caused by joins across related tables.
    instances_qs = _apply_instance_filters(instances_qs, start_date, end_date, airline_id, aircraft_id)
    
    # Aggregate across all instances of the same flight route
    aggregated_qs = (
        instances_qs
        .values(
            flight_number=F('flight__flight_no'),
            airline_name=F('flight__airline__airline_name'),
        )
        .annotate(
            confirmed_bookings=Count(
                'bookings', filter=Q(bookings__status=BookingStatus.CONFIRMED), distinct=True
            ),
            total_seat_count=Count('seats', distinct=True),
            booked_seat_count=Count('seats', filter=Q(seats__status='BOOKED'), distinct=True),
        )
        .filter(total_seat_count__gt=0)
        .order_by('-confirmed_bookings')[:pool]
    )

    results = []
    for item in aggregated_qs:
        flight_no = item['flight_number']
        booked = item['booked_seat_count']
        total = item['total_seat_count']
        occupancy_rate = round((booked / total) * 100, 2) if total > 0 else 0.0

        # Resolve route from legs
        from apps.flights.models import FlightRoute
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
            "flight_number": flight_no,
            "airline": item['airline_name'],
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
        total_revenue, total_bookings, cancellation_rate, avg_occupancy
    }
    """
    from apps.flights.models import Airline

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

        # Occupancy for this airline's instances
        fi_qs = FlightInstance.objects.filter(flight__airline_id=aid)
        if start_date:
            fi_qs = fi_qs.filter(scheduled_departure__date__gte=start_date)
        if end_date:
            fi_qs = fi_qs.filter(scheduled_departure__date__lte=end_date)

        fi_qs = fi_qs.annotate(
            total_seat_count=Count('seats'),
            booked_seat_count=Count('seats', filter=Q(seats__status='BOOKED')),
        ).filter(total_seat_count__gt=0)

        total_cap = sum(fi.total_seat_count for fi in fi_qs)
        total_bkd = sum(fi.booked_seat_count for fi in fi_qs)
        avg_occupancy = round(total_bkd / total_cap * 100, 1) if total_cap > 0 else 0.0

        results.append({
            'airline_id': aid,
            'airline_name': airline.airline_name,
            'iata_code': airline.iata_airline_code,
            'total_revenue': float(item['total_revenue'] or 0),
            'total_bookings': item['total_bookings'],
            'cancellation_rate': cancellation_rate,
            'avg_occupancy': avg_occupancy,
        })

    results.sort(key=lambda x: x['total_revenue'], reverse=True)
    return results


# ─── Aircraft Utilization ─────────────────────────────────────────────────────

def get_aircraft_utilization(top_n: int = 10, start_date=None, end_date=None) -> list:
    """
    Returns per-aircraft utilization stats.
    Each item: {
        aircraft_id, registration, aircraft_model, manufacturer,
        total_flights, avg_occupancy,
        economy_fill_rate, business_fill_rate, first_fill_rate
    }
    """
    from apps.flights.models import Aircraft, CabinClass

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
            total_seat_count=Count('seats'),
            booked_seat_count=Count('seats', filter=Q(seats__status='BOOKED')),
            # Cabin-class fill rates
            eco_total=Count('seats', filter=Q(seats__seat_class=CabinClass.ECONOMY)),
            eco_booked=Count('seats', filter=Q(seats__seat_class=CabinClass.ECONOMY, seats__status='BOOKED')),
            biz_total=Count('seats', filter=Q(seats__seat_class=CabinClass.BUSINESS)),
            biz_booked=Count('seats', filter=Q(seats__seat_class=CabinClass.BUSINESS, seats__status='BOOKED')),
            first_total=Count('seats', filter=Q(seats__seat_class=CabinClass.FIRST)),
            first_booked=Count('seats', filter=Q(seats__seat_class=CabinClass.FIRST, seats__status='BOOKED')),
        ).filter(total_seat_count__gt=0)

        total_cap = sum(fi.total_seat_count for fi in instances)
        total_bkd = sum(fi.booked_seat_count for fi in instances)
        avg_occupancy = round(total_bkd / total_cap * 100, 1) if total_cap > 0 else 0.0

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
            'avg_occupancy': avg_occupancy,
            'economy_fill_rate': round(eco_bkd / eco_cap * 100, 1) if eco_cap > 0 else 0.0,
            'business_fill_rate': round(biz_bkd / biz_cap * 100, 1) if biz_cap > 0 else 0.0,
            'first_fill_rate': round(first_bkd / first_cap * 100, 1) if first_cap > 0 else 0.0,
        })

    results.sort(key=lambda x: x['avg_occupancy'], reverse=True)
    return results