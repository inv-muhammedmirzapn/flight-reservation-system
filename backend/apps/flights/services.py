import logging
import csv
import io
from decimal import Decimal

from django.db import transaction
from django.db.models import F

from .models import (
    Country, Airport,
    FlightInstance, Seat, SeatStatus, CabinClass, Fare,
    Flight,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Airport import
# ---------------------------------------------------------------------------

def import_airports_from_csv(
    csv_content: str,
    overwrite: bool = False,
    limit: int | None = None,
    filter_countries: list[str] | None = None,
) -> dict:
    """
    Parse an OpenFlights-format CSV string and upsert Country / Airport rows.

    Args:
        csv_content:      Raw CSV text (comma-separated, no header).
        overwrite:        If True, update existing airports; otherwise skip them.
        limit:            Stop after this many created+updated rows (None = unlimited).
        filter_countries: If provided, only import airports from these country names
                          (lowercase). Empty list / None = import all.

    Returns:
        {"created_count": int, "updated_count": int, "skipped_count": int}
    """
    try:
        import pycountry
    except ImportError:
        pycountry = None  # type: ignore[assignment]

    reader = csv.reader(io.StringIO(csv_content))
    created_count = updated_count = skipped_count = 0

    # Pre-load country caches to avoid per-row DB hits.
    country_cache: dict[str, Country] = {c.name.lower(): c for c in Country.objects.all()}
    country_iso_cache: dict[str, Country] = {c.iso_code.upper(): c for c in Country.objects.all()}

    for row in reader:
        if not row or len(row) < 8:
            continue

        if limit and (created_count + updated_count) >= limit:
            break

        iata_code = row[4].strip().upper()
        if not iata_code or len(iata_code) != 3 or iata_code == r"\N":
            skipped_count += 1
            continue

        airport_name = row[1].strip()[:200] or "Unknown Airport"
        if airport_name == r"\N":
            airport_name = "Unknown Airport"

        city = row[2].strip()[:100] or "Unknown"
        if city == r"\N":
            city = "Unknown"

        country_name = row[3].strip()

        if filter_countries and country_name.lower() not in filter_countries:
            continue

        country_obj = _resolve_country(
            country_name, country_cache, country_iso_cache, pycountry
        )
        if country_obj is None:
            skipped_count += 1
            continue

        try:
            latitude = round(Decimal(row[6].strip()), 6)
        except Exception:
            logger.exception(f"Error parsing latitude for {iata_code}")
            latitude = None
        try:
            longitude = round(Decimal(row[7].strip()), 6)
        except Exception:
            logger.exception(f"Error parsing longitude for {iata_code}")
            longitude = None

        timezone_str = row[11].strip()
        if not timezone_str or timezone_str == r"\N":
            timezone_str = "UTC"

        try:
            existing = Airport.objects.filter(iata_code=iata_code).first()
            if existing:
                if overwrite:
                    existing.airport_name = airport_name
                    existing.city = city
                    existing.timezone = timezone_str
                    existing.latitude = latitude
                    existing.longitude = longitude
                    existing.country = country_obj
                    existing.save()
                    updated_count += 1
                else:
                    skipped_count += 1
            else:
                Airport.objects.create(
                    iata_code=iata_code,
                    airport_name=airport_name,
                    city=city,
                    timezone=timezone_str,
                    latitude=latitude,
                    longitude=longitude,
                    country=country_obj,
                    terminals=["T1", "T2", "T3"],
                )
                created_count += 1
        except Exception:
            logger.exception(f"Error saving airport {iata_code}")
            skipped_count += 1

    return {
        "created_count": created_count,
        "updated_count": updated_count,
        "skipped_count": skipped_count,
    }


def _resolve_country(
    country_name: str,
    country_cache: dict,
    country_iso_cache: dict,
    pycountry,
) -> Country | None:
    """
    Find or create a Country for *country_name*.
    Updates both caches in place.
    Returns None if creation fails completely.
    """
    obj = country_cache.get(country_name.lower())
    if obj:
        return obj

    # Try pycountry fuzzy match.
    if pycountry:
        try:
            results = pycountry.countries.search_fuzzy(country_name)
            if results:
                iso_2 = results[0].alpha_2.upper()
                obj = country_iso_cache.get(iso_2)
                if not obj:
                    obj = Country.objects.create(name=results[0].name, iso_code=iso_2)
                country_cache[country_name.lower()] = obj
                country_iso_cache[iso_2] = obj
                return obj
        except Exception:
            logger.exception(f"Pycountry fuzzy search failed for {country_name}")

    # Fallback: derive a unique 2-3 char ISO code from the country name.
    try:
        fallback_iso = country_name[:2].upper()
        suffix = 1
        while (
            Country.objects.filter(iso_code=fallback_iso).exists()
            or fallback_iso in country_iso_cache
        ):
            fallback_iso = f"{country_name[:2].upper()}{suffix}"[:3]
            suffix += 1
        obj = Country.objects.create(name=country_name, iso_code=fallback_iso)
        country_cache[country_name.lower()] = obj
        country_iso_cache[fallback_iso] = obj
        return obj
    except Exception:
        logger.exception(f"Failed to generate fallback ISO code for {country_name}")
        return None


# ---------------------------------------------------------------------------
# Seat generation
# ---------------------------------------------------------------------------

def generate_seats_for_instance(instance: FlightInstance) -> int:
    """
    Auto-generate Seat rows for *instance* based on its aircraft capacities.
    Skips silently if seats already exist.

    Returns the number of seats created (0 if already existed or no aircraft).
    """
    if instance.seats.exists():
        return 0
    aircraft = instance.aircraft
    if not aircraft:
        return 0

    seats = []
    fc = aircraft.first_class_capacity
    seats += _make_cabin_seats(instance, fc, CabinClass.FIRST, "F", 4 if fc > 2 else max(fc, 2))
    bc = aircraft.business_capacity
    seats += _make_cabin_seats(instance, bc, CabinClass.BUSINESS, "B", 4 if bc > 2 else max(bc, 2))
    ec = aircraft.economy_capacity
    seats += _make_cabin_seats(instance, ec, CabinClass.ECONOMY, "E", 6 if ec > 3 else max(ec, 3))

    Seat.objects.bulk_create(seats)
    return len(seats)


def _seat_position(col_index: int, block_width: int, is_left_block: bool) -> str:
    if block_width == 1:
        return "window"
    if is_left_block:
        if col_index == 0:
            return "window"
        if col_index == block_width - 1:
            return "aisle"
        return "middle"
    else:
        if col_index == 0:
            return "aisle"
        if col_index == block_width - 1:
            return "window"
        return "middle"


def _make_cabin_seats(
    instance: FlightInstance,
    capacity: int,
    cabin_class: str,
    prefix: str,
    cols_per_row: int,
) -> list:
    if capacity <= 0:
        return []
    rows_needed = -(-capacity // cols_per_row)  # ceiling division
    col_letters = [chr(ord("A") + i) for i in range(cols_per_row)]
    left_block = cols_per_row // 2
    right_block = cols_per_row - left_block

    seats, remaining = [], capacity
    for row_num in range(1, rows_needed + 1):
        for col_idx, letter in enumerate(col_letters):
            if remaining <= 0:
                break
            is_left = col_idx < left_block
            pos = _seat_position(
                col_idx if is_left else col_idx - left_block,
                left_block if is_left else right_block,
                is_left,
            )
            seats.append(
                Seat(
                    flight_instance=instance,
                    seat_number=f"{prefix}{row_num}{letter}",
                    seat_class=cabin_class,
                    position=pos,
                    status=SeatStatus.AVAILABLE,
                )
            )
            remaining -= 1
    return seats


# ---------------------------------------------------------------------------
# Premium / bulk pricing
# ---------------------------------------------------------------------------

def apply_premium_pricing(
    instance: FlightInstance,
    window_fee: float | None,
    legroom_fee: float | None,
) -> int:
    """
    Add *window_fee* to all window seats and *legroom_fee* to all exit-row seats
    belonging to *instance*.

    Returns the number of seats updated.
    """
    seats = instance.seats.all()
    updated = []
    for seat in seats:
        changed = False
        fee = float(seat.seat_fee)
        if window_fee is not None and seat.position == "window":
            fee += window_fee
            changed = True
        if legroom_fee is not None and seat.exit_row:
            fee += legroom_fee
            changed = True
        if changed:
            seat.seat_fee = fee
            updated.append(seat)

    if updated:
        Seat.objects.bulk_update(updated, ["seat_fee"])
    return len(updated)


def bulk_price_seats(
    seat_ids: list[int],
    price: float,
    rule_label: str = "",
) -> dict:
    """
    Set seat_fee = *price* and last_rule_applied = *rule_label* for all seats
    in *seat_ids*.

    Returns:
        {
            "updated_count": int,
            "conflict_seat_ids": [int, ...],   # seats that had a different rule
        }
    """
    seats = Seat.objects.filter(id__in=seat_ids)
    conflict_ids = []
    to_update = []
    for seat in seats:
        if seat.last_rule_applied and seat.last_rule_applied != rule_label:
            conflict_ids.append(seat.id)
        seat.seat_fee = price
        seat.last_rule_applied = rule_label
        to_update.append(seat)

    Seat.objects.bulk_update(to_update, ["seat_fee", "last_rule_applied"])
    return {"updated_count": len(to_update), "conflict_seat_ids": conflict_ids}


# ---------------------------------------------------------------------------
# Seat availability sync  (shared by SeatViewSet.perform_update / perform_destroy
#                          and FlightUpdateView)
# ---------------------------------------------------------------------------

def sync_seat_availability_on_status_change(
    seat: Seat,
    old_status: str,
    new_status: str,
) -> None:
    """
    When a seat's status flips, keep Fare.available_seats and the legacy
    Flight.available_seats in sync, and trigger waitlist allocation when a
    seat becomes available again.
    """
    if old_status == new_status:
        return

    fare = Fare.objects.filter(
        flight_instance=seat.flight_instance,
        cabin_class=seat.seat_class,
    ).first()

    flight_no = seat.flight_instance.flight.flight_no
    legacy_flight = Flight.objects.filter(flight_number=flight_no).first()

    if new_status == SeatStatus.AVAILABLE and old_status != SeatStatus.AVAILABLE:
        # Seat freed — increment counters
        if fare:
            total_physical = seat.flight_instance.seats.filter(
                seat_class=seat.seat_class
            ).count()
            fare.available_seats = min(fare.available_seats + 1, total_physical)
            fare.save(update_fields=["available_seats"])
        if legacy_flight:
            legacy_flight.available_seats = min(
                legacy_flight.available_seats + 1, legacy_flight.total_seats
            )
            legacy_flight.save(update_fields=["available_seats"])
            _trigger_waitlist(legacy_flight, seat.seat_class)

    elif old_status == SeatStatus.AVAILABLE and new_status != SeatStatus.AVAILABLE:
        # Seat taken — decrement counters
        if fare:
            fare.available_seats = max(fare.available_seats - 1, 0)
            fare.save(update_fields=["available_seats"])
        if legacy_flight:
            legacy_flight.available_seats = max(legacy_flight.available_seats - 1, 0)
            legacy_flight.save(update_fields=["available_seats"])


def sync_seat_availability_on_destroy(seat: Seat) -> None:
    """
    Called before a seat is hard-deleted. Decrements availability counters
    if the seat was AVAILABLE.
    """
    if seat.status != SeatStatus.AVAILABLE:
        return

    fare = Fare.objects.filter(
        flight_instance=seat.flight_instance,
        cabin_class=seat.seat_class,
    ).first()
    if fare:
        fare.available_seats = max(fare.available_seats - 1, 0)
        fare.save(update_fields=["available_seats"])

    flight_no = seat.flight_instance.flight.flight_no
    legacy_flight = Flight.objects.filter(flight_number=flight_no).first()
    if legacy_flight:
        legacy_flight.available_seats = max(legacy_flight.available_seats - 1, 0)
        legacy_flight.save(update_fields=["available_seats"])


def trigger_waitlist_if_seats_freed(flight: Flight, old_available: int) -> None:
    """
    Compare *old_available* with the flight's current available_seats.
    If seats were freed (count went up), trigger waitlist allocation.
    Called from FlightUpdateView after a PATCH/PUT.
    """
    flight.refresh_from_db()
    if flight.available_seats > old_available:
        _trigger_waitlist(flight)


def _trigger_waitlist(flight: Flight, cabin_class: str | None = None) -> None:
    """Fire waitlist auto-allocation, swallowing all errors."""
    try:
        from apps.waitlist.services import process_waitlist_allocations
        kwargs = {"cancelled_cabin_class": cabin_class} if cabin_class else {}
        process_waitlist_allocations(flight, **kwargs)
    except Exception:
        logger.exception("Failed to trigger waitlist auto-allocation")