"""
bulk_upload/repositories.py
============================
Per-entity DB upsert functions (the data-access layer).
Each function accepts a list of pre-parsed row dicts and returns
(created_count, updated_count, error_list).

These functions are the only place in the bulk_upload app that
touch the database.
"""

from decimal import Decimal, InvalidOperation
from datetime import datetime, timedelta, time
import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.utils.dateparse import parse_datetime, parse_date, parse_time
from django.utils import timezone

from django.contrib.auth import get_user_model
from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightInstance, FlightLeg, FoodItem, FlightMeal, FlightMealItem,
    Fare, RouteFareClass, Seat, SeatStatus,
)
from apps.pricing.models import HolidayEvent
from apps.users.models import Profile
from apps.bookings.models import Booking, Passenger
from apps.flights.services import generate_seats_for_instance
from apps.pricing.services import generate_fares_for_instance
from .utils import strip
from .validators import (
    validate_airline_row,
    validate_airport_row,
    validate_aircraft_model_row,
    validate_aircraft_row,
    validate_flight_route_row,
    validate_flight_instance_row,
    validate_flight_leg_row,
    validate_route_fare_class_row,
    validate_food_item_row,
    validate_flight_meal_row,
    validate_flight_meal_item_row,
    validate_holiday_event_row,
    validate_country_row,
    validate_seat_row,
    validate_fare_row,
    validate_user_row,
    validate_booking_row,
)

logger = logging.getLogger(__name__)
User = get_user_model()


# ── Type-coercion helpers ──────────────────────────────────────────────────────

def _dec(val, default=0):
    if val in (None, "", "None"):
        return Decimal(default) if default is not None else None
    try:
        return Decimal(str(val))
    except Exception:
        return Decimal(default) if default is not None else None


def _int(val, default=0):
    if val in (None, "", "None"):
        return default
    try:
        return int(float(str(val)))
    except (ValueError, TypeError):
        return default


def _bool(val, default=False) -> bool:
    if val in (None, "", "None"):
        return default
    return str(val).strip().lower() in ("true", "1", "yes", "t", "y")


def _exc_msg(exc) -> dict:
    return exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}


def _parse_time(raw: str):
    if not raw or raw in ("None", ""):
        return None
    raw = str(raw).strip()
    t = parse_time(raw)
    if t is not None:
        return t
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p"):
        try:
            return datetime.strptime(raw, fmt).time()
        except ValueError:
            pass
    return None


def _parse_date(raw: str):
    if not raw or raw in ("None", ""):
        return None
    raw = str(raw).strip()
    d = parse_date(raw)
    if d is not None:
        return d
    for fmt in ("%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            pass
    return None


def _parse_dt(raw: str):
    if not raw or raw in ("None", ""):
        return None
    raw = str(raw).strip()
    dt = parse_datetime(raw)
    if dt is None:
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M", "%d-%m-%Y %H:%M"):
            try:
                dt = datetime.strptime(raw, fmt)
                break
            except ValueError:
                pass
    if dt and timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


# ── Per-entity upsert functions ────────────────────────────────────────────────

def import_countries(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_country_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        iso = strip(row.get("iso_code") or row.get("code")).upper()
        name = strip(row.get("name") or row.get("country_name"))
        try:
            _, created = Country.objects.update_or_create(
                iso_code=iso, defaults={"name": name}
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
    return created_count, updated_count, errors


def import_airlines(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_airline_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        code = strip(row.get("iata_airline_code") or row.get("IATA Code") or row.get("code")).upper()
        name = strip(row.get("airline_name") or row.get("Name") or row.get("name"))
        defaults = {"airline_name": name}
        logo = strip(row.get("logo"))
        if logo:
            defaults["logo"] = logo
        try:
            _, created = Airline.objects.update_or_create(
                iata_airline_code=code, defaults=defaults
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
    return created_count, updated_count, errors


def import_airports(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_airport_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        iata        = strip(row.get("iata_code") or row.get("IATA") or row.get("iata")).upper()
        name        = strip(row.get("airport_name") or row.get("Name") or row.get("name"))
        city        = strip(row.get("city") or row.get("City"))
        country_iso = strip(row.get("country_iso") or row.get("Country ISO") or row.get("country")).upper()
        timezone_val = strip(row.get("timezone") or row.get("Timezone")) or "UTC"
        lat         = _dec(row.get("latitude") or row.get("Latitude"), default=None)
        lon         = _dec(row.get("longitude") or row.get("Longitude"), default=None)

        country_obj = Country.objects.filter(iso_code=country_iso).first()
        if not country_obj:
            try:
                import pycountry
                c = pycountry.countries.get(alpha_2=country_iso)
                if c:
                    country_obj, _ = Country.objects.get_or_create(
                        iso_code=country_iso, defaults={"name": c.name}
                    )
            except Exception:
                pass
        if not country_obj:
            errors.append({"row": i, "data": row, "errors": {
                "country_iso": f"Country '{country_iso}' not found. Please populate countries first."
            }})
            continue
        try:
            _, created = Airport.objects.update_or_create(
                iata_code=iata,
                defaults={"airport_name": name, "city": city, "country": country_obj,
                          "timezone": timezone_val, "latitude": lat, "longitude": lon}
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
    return created_count, updated_count, errors


def import_aircraft_models(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_aircraft_model_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        manufacturer = strip(row.get("manufacturer") or row.get("Manufacturer"))
        model_name   = strip(row.get("model_name") or row.get("Model") or row.get("model"))
        try:
            _, created = AircraftModel.objects.get_or_create(
                manufacturer=manufacturer, model_name=model_name
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
    return created_count, updated_count, errors


def import_aircraft(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_aircraft_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        registration    = strip(row.get("registration") or row.get("Registration")).upper()
        airline_code    = strip(row.get("airline_code") or row.get("Airline IATA") or row.get("airline")).upper()
        manufacturer    = strip(row.get("manufacturer") or row.get("Manufacturer"))
        model_name      = strip(row.get("model_name") or row.get("Model"))
        economy         = _int(row.get("economy_capacity") or row.get("Economy Capacity"))
        business        = _int(row.get("business_capacity") or row.get("Business Capacity"))
        first           = _int(row.get("first_class_capacity") or row.get("First Class Capacity"))
        eco_layout      = strip(row.get("economy_layout") or row.get("Economy Layout")) or "3-3"
        biz_layout      = strip(row.get("business_layout") or row.get("Business Layout")) or "2-2"
        first_layout    = strip(row.get("first_class_layout") or row.get("First Class Layout")) or "2-2"

        airline_obj = Airline.objects.filter(iata_airline_code=airline_code).first()
        if not airline_obj:
            errors.append({"row": i, "data": row, "errors": {
                "airline_code": f"Airline '{airline_code}' not found."}}); continue
        model_obj = AircraftModel.objects.filter(
            manufacturer=manufacturer, model_name=model_name).first()
        if not model_obj:
            errors.append({"row": i, "data": row, "errors": {
                "model_name": f"AircraftModel '{manufacturer} {model_name}' not found."}}); continue
        try:
            _, created = Aircraft.objects.update_or_create(
                registration=registration,
                defaults={
                    "airline": airline_obj, "aircraft_model": model_obj,
                    "economy_capacity": economy, "business_capacity": business,
                    "first_class_capacity": first,
                    "economy_layout": eco_layout, "business_layout": biz_layout,
                    "first_class_layout": first_layout,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
    return created_count, updated_count, errors


def import_flight_routes(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_flight_route_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        flight_no          = strip(row.get("flight_no") or row.get("Flight No") or row.get("flight_number")).upper()
        airline_code       = strip(row.get("airline_code") or row.get("Airline IATA") or row.get("airline")).upper()
        baggage_weight     = _dec(row.get("baggage_weight_allowed_per_person")) or Decimal(20)
        handbag_weight     = _dec(row.get("handbag_weight_allowed_per_person")) or Decimal(7)
        baggage_count      = _int(row.get("baggage_number_allowed_per_person") or row.get("baggage_count"), default=None)
        max_extra_baggage  = _dec(row.get("max_extra_baggage_kg_per_person") or row.get("max_extra_baggage"), default=20)
        extra_baggage_fee  = _dec(row.get("extra_baggage_price_per_kg") or row.get("extra_baggage_price"), default=500)
        extra_bag_currency = strip(row.get("extra_baggage_currency")) or "INR"

        operates_on_days   = strip(row.get("operates_on_days") or row.get("operates_on")) or "1,2,3,4,5,6,7"
        valid_from_raw     = strip(row.get("valid_from"))
        valid_until_raw    = strip(row.get("valid_until"))
        dep_time_raw       = strip(row.get("scheduled_departure_time") or row.get("departure_time"))
        arr_time_raw       = strip(row.get("scheduled_arrival_time") or row.get("arrival_time"))
        aircraft_reg       = strip(row.get("aircraft_registration") or row.get("aircraft") or row.get("default_aircraft")).upper()
        is_active          = _bool(row.get("is_active"), default=True)

        airline_obj = Airline.objects.filter(iata_airline_code=airline_code).first()
        if not airline_obj:
            errors.append({"row": i, "data": row, "errors": {
                "airline_code": f"Airline '{airline_code}' not found."}}); continue

        aircraft_obj = None
        if aircraft_reg:
            aircraft_obj = Aircraft.objects.filter(registration=aircraft_reg).first()
            if not aircraft_obj:
                errors.append({"row": i, "data": row, "errors": {
                    "aircraft_registration": f"Aircraft '{aircraft_reg}' not found."}}); continue

        try:
            defaults = {
                "airline": airline_obj,
                "baggage_weight_allowed_per_person": baggage_weight,
                "handbag_weight_allowed_per_person": handbag_weight,
                "max_extra_baggage_kg_per_person":   max_extra_baggage,
                "extra_baggage_price_per_kg":        extra_baggage_fee,
                "extra_baggage_currency":            extra_bag_currency,
                "operates_on_days":                  operates_on_days,
                "is_active":                         is_active,
            }
            if baggage_count is not None:
                defaults["baggage_number_allowed_per_person"] = baggage_count
            if valid_from_raw:
                defaults["valid_from"] = _parse_date(valid_from_raw) or timezone.now().date()
            if valid_until_raw:
                defaults["valid_until"] = _parse_date(valid_until_raw)
            if dep_time_raw:
                defaults["scheduled_departure_time"] = _parse_time(dep_time_raw)
            if arr_time_raw:
                defaults["scheduled_arrival_time"] = _parse_time(arr_time_raw)
            if aircraft_obj:
                defaults["aircraft"] = aircraft_obj

            _, created = FlightRoute.objects.update_or_create(
                flight_no=flight_no, defaults=defaults
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": {"detail": str(exc)}})
    return created_count, updated_count, errors


def import_flight_legs(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_flight_leg_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        flight_no = strip(row.get("flight_no") or row.get("flight_number")).upper()
        leg_order = row.get("leg_order") or row.get("order")
        dep_iata  = strip(row.get("departure_airport")).upper()
        arr_iata  = strip(row.get("arrival_airport")).upper()

        dep_raw      = strip(row.get("scheduled_departure"))
        arr_raw      = strip(row.get("scheduled_arrival"))
        dep_time_raw = strip(row.get("scheduled_departure_time")) or dep_raw
        arr_time_raw = strip(row.get("scheduled_arrival_time")) or arr_raw

        flight_duration = _int(row.get("flight_duration_minutes") or row.get("duration"), default=120)
        layover_duration = _int(row.get("layover_duration_minutes") or row.get("layover"), default=0)
        dep_terminal    = strip(row.get("departure_terminal")) or ""
        arr_terminal    = strip(row.get("arrival_terminal")) or ""

        route = FlightRoute.objects.filter(flight_no=flight_no).first()
        if not route:
            errors.append({"row": i, "data": row, "errors": {
                "flight_no": f"FlightRoute '{flight_no}' not found."}}); continue
        dep_ap = Airport.objects.filter(iata_code=dep_iata).first()
        arr_ap = Airport.objects.filter(iata_code=arr_iata).first()
        if not dep_ap:
            errors.append({"row": i, "data": row, "errors": {
                "departure_airport": f"Airport '{dep_iata}' not found."}}); continue
        if not arr_ap:
            errors.append({"row": i, "data": row, "errors": {
                "arrival_airport": f"Airport '{arr_iata}' not found."}}); continue
        try:
            dep_dt = _parse_dt(dep_raw)
            arr_dt = _parse_dt(arr_raw)
            dep_time = _parse_time(dep_time_raw)
            arr_time = _parse_time(arr_time_raw)

            defaults = {
                "departure_airport":       dep_ap,
                "arrival_airport":         arr_ap,
                "flight_duration_minutes": flight_duration,
                "layover_duration_minutes": layover_duration,
                "departure_terminal":      dep_terminal,
                "arrival_terminal":        arr_terminal,
            }
            if dep_dt:
                defaults["scheduled_departure"] = dep_dt
            if arr_dt:
                defaults["scheduled_arrival"] = arr_dt
            if dep_time:
                defaults["scheduled_departure_time"] = dep_time
            if arr_time:
                defaults["scheduled_arrival_time"] = arr_time

            _, created = FlightLeg.objects.update_or_create(
                flight=route, leg_order=int(leg_order),
                defaults=defaults
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": {"detail": str(exc)}})
    return created_count, updated_count, errors


def import_flight_instances(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_flight_instance_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        flight_no  = strip(row.get("flight_no") or row.get("flight_number")).upper()
        date_raw   = strip(row.get("date"))
        reg        = strip(row.get("aircraft_registration") or row.get("registration")).upper()
        dep_raw    = strip(row.get("scheduled_departure"))
        arr_raw    = strip(row.get("scheduled_arrival"))
        status_val = strip(row.get("status") or "SCHEDULED").upper()

        dep_term   = strip(row.get("departure_terminal")) or ""
        arr_term   = strip(row.get("arrival_terminal")) or ""
        gate       = strip(row.get("boarding_gate") or row.get("gate")) or ""
        delay_min  = _int(row.get("delay_minutes"), default=0)

        route = FlightRoute.objects.filter(flight_no=flight_no).first()
        if not route:
            errors.append({"row": i, "data": row, "errors": {
                "flight_no": f"FlightRoute '{flight_no}' not found."}}); continue

        aircraft = None
        if reg:
            aircraft = Aircraft.objects.filter(registration=reg).first()
            if not aircraft:
                errors.append({"row": i, "data": row, "errors": {
                    "aircraft_registration": f"Aircraft '{reg}' not found."}}); continue
        elif route.aircraft:
            aircraft = route.aircraft
        else:
            errors.append({"row": i, "data": row, "errors": {
                "aircraft_registration": "Aircraft registration is required (route has no default aircraft)."}}); continue

        try:
            dep  = _parse_dt(dep_raw)
            arr  = _parse_dt(arr_raw)
            date_val = _parse_date(date_raw)

            defaults = {
                "aircraft":           aircraft,
                "status":             status_val,
                "scheduled_departure": dep,
                "scheduled_arrival":   arr,
                "departure_terminal": dep_term,
                "arrival_terminal":   arr_term,
                "boarding_gate":      gate,
                "delay_minutes":      delay_min,
            }

            actual_dep = _parse_dt(strip(row.get("actual_departure")))
            actual_arr = _parse_dt(strip(row.get("actual_arrival")))
            checkin    = _parse_dt(strip(row.get("checkin_open")))
            boarding   = _parse_dt(strip(row.get("boarding_time")))
            if actual_dep: defaults["actual_departure"] = actual_dep
            if actual_arr: defaults["actual_arrival"] = actual_arr
            if checkin:    defaults["checkin_open"] = checkin
            if boarding:   defaults["boarding_time"] = boarding

            instance, created = FlightInstance.objects.update_or_create(
                flight=route, date=date_val,
                defaults=defaults
            )

            if created:
                created_count += 1
                try:
                    generate_seats_for_instance(instance)
                    generate_fares_for_instance(instance)
                except Exception as gen_exc:
                    logger.warning(f"Could not auto-generate seats/fares for {instance}: {gen_exc}")
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": {"detail": str(exc)}})
    return created_count, updated_count, errors


def import_route_fare_classes(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_route_fare_class_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        flight_no    = strip(row.get("flight_no") or row.get("flight_number") or row.get("route")).upper()
        cabin_class  = strip(row.get("cabin_class") or row.get("class")).upper()
        fare_code    = strip(row.get("fare_code") or row.get("code")).upper()
        base_price   = _dec(row.get("base_price") or row.get("price"))
        currency     = strip(row.get("currency")) or "INR"
        refund_type  = strip(row.get("refund_type") or "NON_REFUNDABLE").upper()
        change_fee   = _dec(row.get("change_fee"), default=0)
        meal_inc     = _bool(row.get("meal_included"), default=False)
        baggage_kg   = _int(row.get("baggage_weight_allowed_kg") or row.get("baggage_weight"), default=15)

        route = FlightRoute.objects.filter(flight_no=flight_no).first()
        if not route:
            errors.append({"row": i, "data": row, "errors": {
                "flight_no": f"FlightRoute '{flight_no}' not found."}}); continue

        try:
            _, created = RouteFareClass.objects.update_or_create(
                route=route, cabin_class=cabin_class, fare_code=fare_code,
                defaults={
                    "base_price": base_price,
                    "currency": currency,
                    "refund_type": refund_type,
                    "change_fee": change_fee,
                    "meal_included": meal_inc,
                    "baggage_weight_allowed_kg": baggage_kg,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": {"detail": str(exc)}})
    return created_count, updated_count, errors


def import_food_items(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_food_item_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        airline_code = strip(row.get("airline_code") or row.get("airline")).upper()
        name         = strip(row.get("name") or row.get("item_name"))

        airline = Airline.objects.filter(iata_airline_code=airline_code).first()
        if not airline:
            errors.append({"row": i, "data": row, "errors": {
                "airline_code": f"Airline '{airline_code}' not found."}}); continue
        try:
            _, created = FoodItem.objects.update_or_create(
                airline=airline, name=name,
                defaults={
                    "price":    _dec(row.get("price"), default=0),
                    "currency": strip(row.get("currency")) or "INR",
                    "is_veg":   _bool(row.get("is_veg")),
                    "is_halal": _bool(row.get("is_halal")),
                    "is_vegan": _bool(row.get("is_vegan")),
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": {"detail": str(exc)}})
    return created_count, updated_count, errors


def import_flight_meals(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_flight_meal_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        airline_code = strip(row.get("airline_code") or row.get("airline")).upper()
        cabin_class  = strip(row.get("cabin_class") or row.get("class")).upper()
        meal_name    = strip(row.get("meal_name") or row.get("name"))
        meal_price   = _dec(row.get("price"), default=0)

        airline_obj = Airline.objects.filter(iata_airline_code=airline_code).first()
        if not airline_obj:
            errors.append({"row": i, "data": row, "errors": {
                "airline_code": f"Airline '{airline_code}' not found."}}); continue
        try:
            _, created = FlightMeal.objects.update_or_create(
                airline=airline_obj, cabin_class=cabin_class, name=meal_name,
                defaults={"price": meal_price}
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": {"detail": str(exc)}})
    return created_count, updated_count, errors


def import_flight_meal_items(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_flight_meal_item_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        airline_code = strip(row.get("airline_code") or row.get("airline")).upper()
        cabin_class  = strip(row.get("cabin_class") or row.get("class")).upper()
        meal_name    = strip(row.get("meal_name") or row.get("meal"))
        food_name    = strip(row.get("food_item_name") or row.get("food_item"))
        qty          = _int(row.get("quantity") or row.get("qty"), default=1)

        meal = FlightMeal.objects.filter(
            airline__iata_airline_code=airline_code,
            cabin_class=cabin_class,
            name=meal_name
        ).first()
        if not meal:
            errors.append({"row": i, "data": row, "errors": {
                "meal_name": f"FlightMeal '{meal_name}' ({cabin_class}) for airline '{airline_code}' not found."
            }})
            continue

        food = FoodItem.objects.filter(
            airline__iata_airline_code=airline_code,
            name=food_name
        ).first()
        if not food:
            errors.append({"row": i, "data": row, "errors": {
                "food_item_name": f"FoodItem '{food_name}' for airline '{airline_code}' not found."
            }})
            continue

        try:
            _, created = FlightMealItem.objects.update_or_create(
                flight_meal=meal, food_item=food,
                defaults={"quantity": qty}
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": {"detail": str(exc)}})
    return created_count, updated_count, errors


def import_fares(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_fare_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        flight_no   = strip(row.get("flight_no") or row.get("flight_number")).upper()
        date_raw    = strip(row.get("date"))
        fare_code   = strip(row.get("fare_code")).upper()
        cabin_class = strip(row.get("cabin_class") or row.get("class")).upper()

        route = FlightRoute.objects.filter(flight_no=flight_no).first()
        if not route:
            errors.append({"row": i, "data": row, "errors": {
                "flight_no": f"FlightRoute '{flight_no}' not found."}}); continue
        fi = FlightInstance.objects.filter(flight=route, date=_parse_date(date_raw)).first()
        if not fi:
            errors.append({"row": i, "data": row, "errors": {
                "date": f"No FlightInstance for {flight_no} on {date_raw}."}}); continue
        try:
            defaults = {
                "price":           _dec(row.get("price"), default=0),
                "currency":        strip(row.get("currency")) or "INR",
                "available_seats": _int(row.get("available_seats"), default=0),
                "refund_type":     strip(row.get("refund_type") or "NON_REFUNDABLE").upper(),
                "change_fee":      _dec(row.get("change_fee"), default=0),
                "meal_included":   _bool(row.get("meal_included"), default=False),
            }
            baggage = _dec(row.get("baggage_allowance"), default=None)
            handbag = _dec(row.get("handbag_allowance"), default=None)
            pieces  = _int(row.get("baggage_pieces_allowance"), default=None)
            if baggage is not None:
                defaults["baggage_allowance"] = baggage
            if handbag is not None:
                defaults["handbag_allowance"] = handbag
            if pieces is not None:
                defaults["baggage_pieces_allowance"] = pieces

            _, created = Fare.objects.update_or_create(
                flight_instance=fi, fare_code=fare_code, cabin_class=cabin_class,
                defaults=defaults
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": {"detail": str(exc)}})
    return created_count, updated_count, errors


def import_seats(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_seat_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        flight_no = strip(row.get("flight_no") or row.get("flight_number")).upper()
        date_raw  = strip(row.get("date"))
        seat_num  = strip(row.get("seat_number") or row.get("seat")).upper()
        s_class   = strip(row.get("seat_class") or row.get("cabin_class") or row.get("class")).upper()
        pos       = strip(row.get("position")).lower()
        status_v  = strip(row.get("status") or "AVAILABLE").upper()
        exit_r    = _bool(row.get("exit_row"), default=False)
        extra_leg = _bool(row.get("extra_legroom"), default=False)
        fee       = _dec(row.get("seat_fee") or row.get("fee"), default=0)
        curr      = strip(row.get("currency")) or "INR"

        route = FlightRoute.objects.filter(flight_no=flight_no).first()
        if not route:
            errors.append({"row": i, "data": row, "errors": {
                "flight_no": f"FlightRoute '{flight_no}' not found."}}); continue
        fi = FlightInstance.objects.filter(flight=route, date=_parse_date(date_raw)).first()
        if not fi:
            errors.append({"row": i, "data": row, "errors": {
                "date": f"No FlightInstance for {flight_no} on {date_raw}."}}); continue

        try:
            defaults = {
                "seat_class":    s_class,
                "status":        status_v,
                "exit_row":      exit_r,
                "extra_legroom": extra_leg,
                "seat_fee":      fee,
                "currency":      curr,
            }
            if pos:
                defaults["position"] = pos

            _, created = Seat.objects.update_or_create(
                flight_instance=fi, seat_number=seat_num,
                defaults=defaults
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": {"detail": str(exc)}})
    return created_count, updated_count, errors


def import_holiday_events(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_holiday_event_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        name        = strip(row.get("name"))
        start_date  = _parse_date(strip(row.get("start_date")))
        end_date    = _parse_date(strip(row.get("end_date")))
        surge       = _dec(row.get("surge_multiplier") or row.get("multiplier"), default="1.20")
        is_global   = _bool(row.get("is_global"), default=False)
        countries   = strip(row.get("applicable_countries") or row.get("countries"))
        is_active   = _bool(row.get("is_active"), default=True)
        desc        = strip(row.get("description")) or ""

        countries_list = []
        if countries:
            countries_list = [c.strip() for c in countries.split(",") if c.strip()]

        try:
            _, created = HolidayEvent.objects.update_or_create(
                name=name, start_date=start_date,
                defaults={
                    "end_date":             end_date,
                    "surge_multiplier":     surge,
                    "is_global":            is_global,
                    "applicable_countries": countries_list,
                    "is_active":            is_active,
                    "description":          desc,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": {"detail": str(exc)}})
    return created_count, updated_count, errors


def import_users(rows: list[dict]) -> tuple:
    """
    Import/upsert users and their profiles.
    Matches on email (username). If user exists, profile fields are updated.
    Password is only set for newly created users (set_unusable_password for imports
    without a plaintext password, or the provided password if given).
    """
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_user_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue

        email      = strip(row.get("email") or row.get("Email")).lower()
        username   = strip(row.get("username") or row.get("Username")) or email.split("@")[0]
        first_name = strip(row.get("first_name") or row.get("First Name"))
        last_name  = strip(row.get("last_name") or row.get("Last Name"))
        password   = strip(row.get("password") or row.get("Password"))
        role       = strip(row.get("role") or row.get("Role") or "CUSTOMER").upper()
        phone      = strip(row.get("phone_number") or row.get("phone") or row.get("Phone"))
        dob_raw    = strip(row.get("date_of_birth") or row.get("dob") or row.get("DOB"))
        gender     = strip(row.get("gender") or row.get("Gender")).upper()
        country    = strip(row.get("country") or row.get("Country"))
        state      = strip(row.get("state") or row.get("State"))
        city       = strip(row.get("city") or row.get("City"))

        if role not in ("ADMIN", "CUSTOMER"):
            role = "CUSTOMER"
        if gender not in ("MALE", "FEMALE", "OTHER"):
            gender = ""

        dob = _parse_date(dob_raw) if dob_raw else None

        try:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": username,
                    "first_name": first_name,
                    "last_name": last_name,
                }
            )
            if not created:
                user.first_name = first_name or user.first_name
                user.last_name  = last_name  or user.last_name
                user.save(update_fields=["first_name", "last_name"])
            else:
                if password:
                    user.set_password(password)
                else:
                    user.set_unusable_password()
                user.save()

            profile_defaults = {"role": role}
            if phone:    profile_defaults["phone_number"]  = phone
            if dob:      profile_defaults["date_of_birth"] = dob
            if gender:   profile_defaults["gender"]        = gender
            if country:  profile_defaults["country"]       = country
            if state:    profile_defaults["state"]         = state
            if city:     profile_defaults["city"]          = city

            Profile.objects.update_or_create(user=user, defaults=profile_defaults)

            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": {"detail": str(exc)}})
    return created_count, updated_count, errors


def import_bookings(rows: list[dict]) -> tuple:
    """
    Import bookings and optional passenger seat allocation.
    Matches user by email or username, and flight instance by flight_no and date.
    """
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_booking_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue

        user_ident = strip(row.get("user_email") or row.get("email") or row.get("username") or row.get("user"))
        flight_no  = strip(row.get("flight_no") or row.get("flight_number") or row.get("flight")).upper()
        date_raw   = strip(row.get("date") or row.get("flight_date"))
        cabin      = strip(row.get("cabin_class") or row.get("class") or "ECONOMY").upper()
        status_v   = strip(row.get("status") or "CONFIRMED").upper()
        total_p    = _dec(row.get("total_price") or row.get("price"), default=0)
        seat_cnt   = _int(row.get("seat_count") or row.get("seats"), default=1)
        booking_id = strip(row.get("booking_id") or row.get("id"))

        user = User.objects.filter(email__iexact=user_ident).first() or User.objects.filter(username__iexact=user_ident).first()
        if not user:
            errors.append({"row": i, "data": row, "errors": {
                "user_email": f"User '{user_ident}' not found."}})
            continue

        flight_date = _parse_date(date_raw)
        instance = FlightInstance.objects.filter(flight__flight_no=flight_no, date=flight_date).first()
        if not instance:
            route = FlightRoute.objects.filter(flight_no=flight_no).first()
            if route:
                dep_t = route.scheduled_departure_time or time(8, 0)
                arr_t = route.scheduled_arrival_time or time(11, 0)
                naive_dep = datetime.combine(flight_date, dep_t)
                if arr_t < dep_t:
                    naive_arr = datetime.combine(flight_date + timedelta(days=1), arr_t)
                else:
                    naive_arr = datetime.combine(flight_date, arr_t)
                sch_dep = timezone.make_aware(naive_dep) if timezone.is_naive(naive_dep) else naive_dep
                sch_arr = timezone.make_aware(naive_arr) if timezone.is_naive(naive_arr) else naive_arr

                route_ac = route.aircraft or Aircraft.objects.filter(airline=route.airline).first() or Aircraft.objects.first()
                if route_ac:
                    try:
                        instance, inst_created = FlightInstance.objects.get_or_create(
                            flight=route,
                            date=flight_date,
                            defaults={
                                "aircraft": route_ac,
                                "scheduled_departure": sch_dep,
                                "scheduled_arrival": sch_arr,
                                "status": "SCHEDULED",
                                "departure_terminal": "T1",
                                "arrival_terminal": "T1",
                            }
                        )
                        if inst_created:
                            try:
                                generate_seats_for_instance(instance)
                                generate_fares_for_instance(instance)
                            except Exception as e:
                                logger.warning(f"Could not auto-generate seats/fares for booking instance: {e}")
                    except Exception as e:
                        logger.warning(f"Could not auto-create FlightInstance for booking: {e}")

        if not instance:
            errors.append({"row": i, "data": row, "errors": {
                "flight_no": f"FlightInstance '{flight_no}' on {date_raw} not found."}})
            continue

        try:
            booking_defaults = {
                "user": user,
                "flight": instance,
                "status": status_v,
                "cabin_class": cabin,
                "seat_count": seat_cnt,
                "total_price": total_p,
            }

            if booking_id:
                booking, created = Booking.objects.update_or_create(
                    id=booking_id,
                    defaults=booking_defaults
                )
            else:
                booking, created = Booking.objects.update_or_create(
                    user=user, flight=instance, status=status_v,
                    defaults=booking_defaults
                )

            p_name = strip(row.get("passenger_name") or row.get("name"))
            seat_num = strip(row.get("seat_number") or row.get("seat")).upper()
            if p_name:
                p_age    = _int(row.get("passenger_age") or row.get("age"), default=30)
                p_gender = strip(row.get("passenger_gender") or row.get("gender") or "M").upper()
                p_phone  = strip(row.get("passenger_phone") or row.get("phone") or "")
                p_meal   = strip(row.get("meal_preference") or "NONE").upper()

                Passenger.objects.update_or_create(
                    booking=booking, name=p_name,
                    defaults={
                        "age": p_age,
                        "gender": p_gender if p_gender in ("M", "F", "O") else "M",
                        "phone_number": p_phone,
                        "meal_preference": p_meal if p_meal in ("VEG", "NON_VEG", "NONE") else "NONE",
                        "seat_number": seat_num or None,
                    }
                )

            if seat_num and status_v == "CONFIRMED":
                Seat.objects.filter(flight_instance=instance, seat_number=seat_num).update(status=SeatStatus.BOOKED)

            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": {"detail": str(exc)}})

    return created_count, updated_count, errors


# ── Registry ──────────────────────────────────────────────────────────────────

ENTITY_IMPORTERS: dict[str, callable] = {
    "countries":          import_countries,
    "airlines":           import_airlines,
    "airports":           import_airports,
    "aircraft_models":    import_aircraft_models,
    "aircraft":           import_aircraft,
    "flight_routes":      import_flight_routes,
    "flight_legs":        import_flight_legs,
    "route_fare_classes": import_route_fare_classes,
    "flight_instances":   import_flight_instances,
    "fares":              import_fares,
    "seats":              import_seats,
    "food_items":         import_food_items,
    "flight_meals":       import_flight_meals,
    "flight_meal_items":  import_flight_meal_items,
    "holiday_events":     import_holiday_events,
    "users":              import_users,
    "bookings":           import_bookings,
}