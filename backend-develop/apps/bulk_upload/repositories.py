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

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.utils.dateparse import parse_datetime, parse_date

from datetime import datetime

from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightInstance, FlightLeg, FoodItem, FlightMeal, Fare,
)
from .utils import strip
from .validators import (
    validate_airline_row,
    validate_airport_row,
    validate_aircraft_model_row,
    validate_aircraft_row,
    validate_flight_route_row,
    validate_flight_instance_row,
    validate_flight_leg_row,
    validate_food_item_row,
    validate_flight_meal_row,
    validate_fare_row,
)

# ── Type-coercion helpers ──────────────────────────────────────────────────────

def _dec(val, default=0) -> Decimal:
    try:
        return Decimal(str(val)) if val not in (None, "", "None") else Decimal(default)
    except (InvalidOperation, Exception):
        return Decimal(default)


def _int(val, default=0) -> int:
    try:
        return int(float(str(val))) if val not in (None, "", "None") else default
    except (ValueError, TypeError):
        return default


def _bool(val) -> bool:
    return str(val).strip().lower() in ("true", "1", "yes")


def _exc_msg(exc) -> dict:
    return exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}


def _parse_dt(raw: str):
    return parse_datetime(raw) or datetime.strptime(raw, "%Y-%m-%d %H:%M")


# ── Per-entity upsert functions ────────────────────────────────────────────────

def import_airlines(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_airline_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        code = strip(row.get("iata_airline_code") or row.get("IATA Code") or row.get("code")).upper()
        name = strip(row.get("airline_name") or row.get("Name") or row.get("name"))
        try:
            _, created = Airline.objects.update_or_create(
                iata_airline_code=code, defaults={"airline_name": name}
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
        timezone    = strip(row.get("timezone") or row.get("Timezone")) or "UTC"
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
                          "timezone": timezone, "latitude": lat, "longitude": lon}
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
        registration = strip(row.get("registration") or row.get("Registration")).upper()
        airline_code = strip(row.get("airline_code") or row.get("Airline IATA") or row.get("airline")).upper()
        manufacturer = strip(row.get("manufacturer") or row.get("Manufacturer"))
        model_name   = strip(row.get("model_name") or row.get("Model"))
        economy      = _int(row.get("economy_capacity") or row.get("Economy Capacity"))
        business     = _int(row.get("business_capacity") or row.get("Business Capacity"))
        first        = _int(row.get("first_class_capacity") or row.get("First Class Capacity"))

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
                defaults={"airline": airline_obj, "aircraft_model": model_obj,
                          "economy_capacity": economy, "business_capacity": business,
                          "first_class_capacity": first}
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
        flight_no      = strip(row.get("flight_no") or row.get("Flight No") or row.get("flight_number")).upper()
        airline_code   = strip(row.get("airline_code") or row.get("Airline IATA") or row.get("airline")).upper()
        baggage_weight = _dec(row.get("baggage_weight_allowed_per_person")) or Decimal(20)
        handbag_weight = _dec(row.get("handbag_weight_allowed_per_person")) or Decimal(7)

        airline_obj = Airline.objects.filter(iata_airline_code=airline_code).first()
        if not airline_obj:
            errors.append({"row": i, "data": row, "errors": {
                "airline_code": f"Airline '{airline_code}' not found."}}); continue
        try:
            _, created = FlightRoute.objects.update_or_create(
                flight_no=flight_no,
                defaults={"airline": airline_obj,
                          "baggage_weight_allowed_per_person": baggage_weight,
                          "handbag_weight_allowed_per_person": handbag_weight}
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
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

        route = FlightRoute.objects.filter(flight_no=flight_no).first()
        if not route:
            errors.append({"row": i, "data": row, "errors": {
                "flight_no": f"FlightRoute '{flight_no}' not found."}}); continue
        aircraft = Aircraft.objects.filter(registration=reg).first()
        if not aircraft:
            errors.append({"row": i, "data": row, "errors": {
                "aircraft_registration": f"Aircraft '{reg}' not found."}}); continue
        try:
            dep  = _parse_dt(dep_raw)
            arr  = _parse_dt(arr_raw)
            date = parse_date(date_raw)
            _, created = FlightInstance.objects.update_or_create(
                flight=route, date=date,
                defaults={"aircraft": aircraft, "status": status_val,
                          "scheduled_departure": dep, "scheduled_arrival": arr}
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
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
        dep_raw   = strip(row.get("scheduled_departure"))
        arr_raw   = strip(row.get("scheduled_arrival"))

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
            dep = _parse_dt(dep_raw)
            arr = _parse_dt(arr_raw)
            _, created = FlightLeg.objects.update_or_create(
                flight=route, leg_order=int(leg_order),
                defaults={"departure_airport": dep_ap, "arrival_airport": arr_ap,
                          "scheduled_departure": dep, "scheduled_arrival": arr}
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
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
                    "price":    _dec(row.get("price")),
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
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
    return created_count, updated_count, errors


def import_flight_meals(rows: list[dict]) -> tuple:
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        row_errors = validate_flight_meal_row(row)
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors})
            continue
        flight_no = strip(row.get("flight_no") or row.get("flight_number")).upper()
        date_raw  = strip(row.get("date"))
        meal_name = strip(row.get("meal_name") or row.get("name"))

        route = FlightRoute.objects.filter(flight_no=flight_no).first()
        if not route:
            errors.append({"row": i, "data": row, "errors": {
                "flight_no": f"FlightRoute '{flight_no}' not found."}}); continue
        fi = FlightInstance.objects.filter(flight=route, date=parse_date(date_raw)).first()
        if not fi:
            errors.append({"row": i, "data": row, "errors": {
                "date": f"No FlightInstance for {flight_no} on {date_raw}."}}); continue
        try:
            _, created = FlightMeal.objects.get_or_create(flight_instance=fi, name=meal_name)
            if created:
                created_count += 1
            else:
                updated_count += 1
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
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
        fi = FlightInstance.objects.filter(flight=route, date=parse_date(date_raw)).first()
        if not fi:
            errors.append({"row": i, "data": row, "errors": {
                "date": f"No FlightInstance for {flight_no} on {date_raw}."}}); continue
        try:
            _, created = Fare.objects.update_or_create(
                flight_instance=fi, fare_code=fare_code, cabin_class=cabin_class,
                defaults={
                    "price":           _dec(row.get("price")),
                    "currency":        strip(row.get("currency")) or "INR",
                    "available_seats": _int(row.get("available_seats")),
                    "refund_type":     strip(row.get("refund_type") or "NON_REFUNDABLE").upper(),
                    "change_fee":      _dec(row.get("change_fee")),
                    "meal_included":   _bool(row.get("meal_included", "false")),
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except Exception as exc:
            errors.append({"row": i, "data": row, "errors": _exc_msg(exc)})
    return created_count, updated_count, errors


# ── Registry ──────────────────────────────────────────────────────────────────

ENTITY_IMPORTERS: dict[str, callable] = {
    "airlines":         import_airlines,
    "airports":         import_airports,
    "aircraft_models":  import_aircraft_models,
    "aircraft":         import_aircraft,
    "flight_routes":    import_flight_routes,
    "flight_instances": import_flight_instances,
    "flight_legs":      import_flight_legs,
    "food_items":       import_food_items,
    "flight_meals":     import_flight_meals,
    "fares":            import_fares,
}