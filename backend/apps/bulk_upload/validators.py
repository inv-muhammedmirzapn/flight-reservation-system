"""
bulk_upload/validators.py
=========================
Per-entity row-level validation functions.
Each function receives a raw row dict and returns an error dict
(empty means valid). No DB calls, no side effects.
"""

from decimal import Decimal, InvalidOperation
from django.utils.dateparse import parse_date
from .utils import strip


def validate_airline_row(row: dict) -> dict:
    errors = {}
    code = strip(row.get("iata_airline_code") or row.get("IATA Code") or row.get("code"))
    if not code or len(code) != 2:
        errors["iata_airline_code"] = "Required (2-letter IATA code)."
    if not strip(row.get("airline_name") or row.get("Name") or row.get("name")):
        errors["airline_name"] = "Required."
    return errors


def validate_airport_row(row: dict) -> dict:
    errors = {}
    iata = strip(row.get("iata_code") or row.get("IATA") or row.get("iata")).upper()
    if not iata or len(iata) != 3:
        errors["iata_code"] = "Required: exactly 3-letter IATA code."
    if not strip(row.get("airport_name") or row.get("Name") or row.get("name")):
        errors["airport_name"] = "Required."
    if not strip(row.get("city") or row.get("City")):
        errors["city"] = "Required."
    if not strip(row.get("country_iso") or row.get("Country ISO") or row.get("country")):
        errors["country_iso"] = "Required: 2-letter country ISO code."
    return errors


def validate_aircraft_model_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("manufacturer") or row.get("Manufacturer")):
        errors["manufacturer"] = "Required."
    if not strip(row.get("model_name") or row.get("Model") or row.get("model")):
        errors["model_name"] = "Required."
    return errors


def validate_aircraft_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("registration") or row.get("Registration")):
        errors["registration"] = "Required."
    airline = strip(row.get("airline_code") or row.get("Airline IATA") or row.get("airline"))
    if not airline or len(airline) != 2:
        errors["airline_code"] = "Required (2-letter IATA airline code)."
    if not strip(row.get("manufacturer") or row.get("Manufacturer")):
        errors["manufacturer"] = "Required."
    if not strip(row.get("model_name") or row.get("Model")):
        errors["model_name"] = "Required."
    return errors


def validate_flight_route_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("flight_no") or row.get("Flight No") or row.get("flight_number")):
        errors["flight_no"] = "Required."
    airline = strip(row.get("airline_code") or row.get("Airline IATA") or row.get("airline"))
    if not airline or len(airline) != 2:
        errors["airline_code"] = "Required (2-letter IATA code)."

    operates = strip(row.get("operates_on_days") or row.get("operates_on"))
    if operates:
        days = [p.strip() for p in operates.split(",") if p.strip()]
        for d in days:
            if not d.isdigit() or int(d) < 1 or int(d) > 7:
                errors["operates_on_days"] = "Must be comma-separated integers between 1 and 7 (e.g. '1,2,3,4,5')."
                break

    valid_from = strip(row.get("valid_from"))
    valid_until = strip(row.get("valid_until"))
    if valid_from and not parse_date(valid_from):
        errors["valid_from"] = "Must be a valid date (YYYY-MM-DD)."
    if valid_until and not parse_date(valid_until):
        errors["valid_until"] = "Must be a valid date (YYYY-MM-DD)."
    if valid_from and valid_until and parse_date(valid_from) and parse_date(valid_until):
        if parse_date(valid_until) < parse_date(valid_from):
            errors["valid_until"] = "valid_until cannot be earlier than valid_from."

    return errors


def validate_flight_instance_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("flight_no") or row.get("flight_number")):
        errors["flight_no"] = "Required."
    date_val = strip(row.get("date"))
    if not date_val:
        errors["date"] = "Required (YYYY-MM-DD)."
    elif not parse_date(date_val):
        errors["date"] = "Invalid date format (expected YYYY-MM-DD)."

    if not strip(row.get("scheduled_departure")):
        errors["scheduled_departure"] = "Required (YYYY-MM-DD HH:MM)."
    if not strip(row.get("scheduled_arrival")):
        errors["scheduled_arrival"] = "Required (YYYY-MM-DD HH:MM)."

    status_val = strip(row.get("status")).upper()
    valid_statuses = ("SCHEDULED", "DELAYED", "CANCELLED", "BOARDING", "DEPARTED", "ARRIVED")
    if status_val and status_val not in valid_statuses:
        errors["status"] = f"Invalid status. Must be one of: {', '.join(valid_statuses)}."

    return errors


def validate_flight_leg_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("flight_no") or row.get("flight_number")):
        errors["flight_no"] = "Required."
    order = row.get("leg_order") or row.get("order")
    if not order:
        errors["leg_order"] = "Required (positive integer)."
    else:
        try:
            if int(order) <= 0:
                errors["leg_order"] = "Must be greater than 0."
        except (ValueError, TypeError):
            errors["leg_order"] = "Must be an integer."

    dep = strip(row.get("departure_airport")).upper()
    arr = strip(row.get("arrival_airport")).upper()
    if not dep or len(dep) != 3:
        errors["departure_airport"] = "Required (3-letter IATA code)."
    if not arr or len(arr) != 3:
        errors["arrival_airport"] = "Required (3-letter IATA code)."
    if dep and arr and dep == arr:
        errors["arrival_airport"] = "Arrival airport must differ from departure airport."

    has_dep = strip(row.get("scheduled_departure") or row.get("scheduled_departure_time"))
    has_arr = strip(row.get("scheduled_arrival") or row.get("scheduled_arrival_time"))
    if not has_dep:
        errors["scheduled_departure"] = "Required (time e.g. '06:00' or datetime)."
    if not has_arr:
        errors["scheduled_arrival"] = "Required (time e.g. '09:00' or datetime)."

    duration = row.get("flight_duration_minutes") or row.get("duration")
    if duration not in (None, ""):
        try:
            if int(duration) <= 0:
                errors["flight_duration_minutes"] = "Must be greater than 0."
        except (ValueError, TypeError):
            errors["flight_duration_minutes"] = "Must be a valid integer."

    layover = row.get("layover_duration_minutes") or row.get("layover")
    if layover not in (None, ""):
        try:
            if int(layover) < 0:
                errors["layover_duration_minutes"] = "Cannot be negative."
        except (ValueError, TypeError):
            errors["layover_duration_minutes"] = "Must be a valid integer."

    return errors


def validate_route_fare_class_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("flight_no") or row.get("flight_number") or row.get("route")):
        errors["flight_no"] = "Required."
    cabin = strip(row.get("cabin_class") or row.get("class")).upper()
    if cabin not in ("ECONOMY", "BUSINESS", "FIRST"):
        errors["cabin_class"] = "Must be ECONOMY, BUSINESS, or FIRST."
    if not strip(row.get("fare_code") or row.get("code")):
        errors["fare_code"] = "Required (e.g. 'ECO-SAVER')."

    price = row.get("base_price") or row.get("price")
    if price in (None, ""):
        errors["base_price"] = "Required (non-negative number)."
    else:
        try:
            d = Decimal(str(price))
            if d < 0:
                errors["base_price"] = "Cannot be negative."
        except (InvalidOperation, ValueError, TypeError):
            errors["base_price"] = "Must be a valid decimal number."

    refund = strip(row.get("refund_type")).upper()
    if refund and refund not in ("REFUNDABLE", "NON_REFUNDABLE", "PARTIAL"):
        errors["refund_type"] = "Must be REFUNDABLE, NON_REFUNDABLE, or PARTIAL."

    return errors


def validate_fare_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("flight_no") or row.get("flight_number")):
        errors["flight_no"] = "Required."
    date_val = strip(row.get("date"))
    if not date_val:
        errors["date"] = "Required (YYYY-MM-DD)."
    elif not parse_date(date_val):
        errors["date"] = "Invalid date format (expected YYYY-MM-DD)."
    if not strip(row.get("fare_code")):
        errors["fare_code"] = "Required."
    cabin = strip(row.get("cabin_class") or row.get("class")).upper()
    if cabin not in ("ECONOMY", "BUSINESS", "FIRST"):
        errors["cabin_class"] = "Must be ECONOMY, BUSINESS, or FIRST."

    price = row.get("price")
    if price not in (None, ""):
        try:
            if Decimal(str(price)) < 0:
                errors["price"] = "Price cannot be negative."
        except (InvalidOperation, ValueError, TypeError):
            errors["price"] = "Must be a valid decimal number."

    refund = strip(row.get("refund_type")).upper()
    if refund and refund not in ("REFUNDABLE", "NON_REFUNDABLE", "PARTIAL"):
        errors["refund_type"] = "Must be REFUNDABLE, NON_REFUNDABLE, or PARTIAL."

    return errors


def validate_flight_meal_row(row: dict) -> dict:
    errors = {}
    airline = strip(row.get("airline_code") or row.get("airline"))
    if not airline or len(airline) != 2:
        errors["airline_code"] = "Required (2-letter IATA code)."
    cabin = strip(row.get("cabin_class") or row.get("class")).upper()
    if cabin not in ("ECONOMY", "BUSINESS", "FIRST"):
        errors["cabin_class"] = "Must be ECONOMY, BUSINESS, or FIRST."
    if not strip(row.get("meal_name") or row.get("name")):
        errors["meal_name"] = "Required."

    price = row.get("price")
    if price not in (None, ""):
        try:
            if Decimal(str(price)) < 0:
                errors["price"] = "Price cannot be negative."
        except (InvalidOperation, ValueError, TypeError):
            errors["price"] = "Must be a valid decimal number."
    return errors


def validate_food_item_row(row: dict) -> dict:
    errors = {}
    airline = strip(row.get("airline_code") or row.get("airline"))
    if not airline or len(airline) != 2:
        errors["airline_code"] = "Required (2-letter IATA code)."
    if not strip(row.get("name") or row.get("item_name")):
        errors["name"] = "Required."

    price = row.get("price")
    if price not in (None, ""):
        try:
            if Decimal(str(price)) < 0:
                errors["price"] = "Price cannot be negative."
        except (InvalidOperation, ValueError, TypeError):
            errors["price"] = "Must be a valid decimal number."
    return errors


def validate_flight_meal_item_row(row: dict) -> dict:
    errors = {}
    airline = strip(row.get("airline_code") or row.get("airline"))
    if not airline or len(airline) != 2:
        errors["airline_code"] = "Required (2-letter IATA code)."
    cabin = strip(row.get("cabin_class") or row.get("class")).upper()
    if cabin not in ("ECONOMY", "BUSINESS", "FIRST"):
        errors["cabin_class"] = "Must be ECONOMY, BUSINESS, or FIRST."
    if not strip(row.get("meal_name") or row.get("meal")):
        errors["meal_name"] = "Required."
    if not strip(row.get("food_item_name") or row.get("food_item")):
        errors["food_item_name"] = "Required."

    qty = row.get("quantity") or row.get("qty")
    if qty not in (None, ""):
        try:
            if int(qty) <= 0:
                errors["quantity"] = "Must be a positive integer."
        except (ValueError, TypeError):
            errors["quantity"] = "Must be an integer."
    return errors


def validate_holiday_event_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("name")):
        errors["name"] = "Required."
    start = strip(row.get("start_date"))
    end = strip(row.get("end_date"))
    if not start or not parse_date(start):
        errors["start_date"] = "Required valid date (YYYY-MM-DD)."
    if not end or not parse_date(end):
        errors["end_date"] = "Required valid date (YYYY-MM-DD)."
    if start and end and parse_date(start) and parse_date(end):
        if parse_date(end) < parse_date(start):
            errors["end_date"] = "end_date cannot be earlier than start_date."

    surge = row.get("surge_multiplier") or row.get("multiplier")
    if surge not in (None, ""):
        try:
            if Decimal(str(surge)) < Decimal("1.00"):
                errors["surge_multiplier"] = "Surge multiplier cannot be less than 1.00."
        except (InvalidOperation, ValueError, TypeError):
            errors["surge_multiplier"] = "Must be a valid decimal number."
    return errors


def validate_country_row(row: dict) -> dict:
    errors = {}
    iso = strip(row.get("iso_code") or row.get("code")).upper()
    if not iso or len(iso) != 2:
        errors["iso_code"] = "Required (2-letter ISO code, e.g. 'IN')."
    if not strip(row.get("name") or row.get("country_name")):
        errors["name"] = "Required."
    return errors


def validate_seat_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("flight_no") or row.get("flight_number")):
        errors["flight_no"] = "Required."
    date_val = strip(row.get("date"))
    if not date_val:
        errors["date"] = "Required (YYYY-MM-DD)."
    elif not parse_date(date_val):
        errors["date"] = "Invalid date format (expected YYYY-MM-DD)."
    if not strip(row.get("seat_number") or row.get("seat")):
        errors["seat_number"] = "Required (e.g. '12A')."

    seat_class = strip(row.get("seat_class") or row.get("cabin_class") or row.get("class")).upper()
    if seat_class and seat_class not in ("ECONOMY", "BUSINESS", "FIRST"):
        errors["seat_class"] = "Must be ECONOMY, BUSINESS, or FIRST."

    pos = strip(row.get("position")).lower()
    if pos and pos not in ("window", "aisle", "middle"):
        errors["position"] = "Must be window, aisle, or middle."

    status_val = strip(row.get("status")).upper()
    if status_val and status_val not in ("AVAILABLE", "HELD", "BOOKED", "BLOCKED"):
        errors["status"] = "Must be AVAILABLE, HELD, BOOKED, or BLOCKED."

    fee = row.get("seat_fee") or row.get("fee")
    if fee not in (None, ""):
        try:
            if Decimal(str(fee)) < 0:
                errors["seat_fee"] = "Seat fee cannot be negative."
        except (InvalidOperation, ValueError, TypeError):
            errors["seat_fee"] = "Must be a valid decimal number."
    return errors


def validate_user_row(row: dict) -> dict:
    errors = {}
    email = strip(row.get("email") or row.get("Email"))
    if not email:
        errors["email"] = "Required."
    elif "@" not in email:
        errors["email"] = "Must be a valid email address."
    return errors


def validate_booking_row(row: dict) -> dict:
    errors = {}
    user_ident = strip(row.get("user_email") or row.get("email") or row.get("username") or row.get("user"))
    if not user_ident:
        errors["user_email"] = "Required (user email or username)."

    flight_no = strip(row.get("flight_no") or row.get("flight_number") or row.get("flight"))
    if not flight_no:
        errors["flight_no"] = "Required."

    date_val = strip(row.get("date") or row.get("flight_date"))
    if not date_val:
        errors["date"] = "Required (YYYY-MM-DD)."
    elif not parse_date(date_val):
        errors["date"] = "Invalid date format (expected YYYY-MM-DD)."

    cabin = strip(row.get("cabin_class") or row.get("class")).upper()
    if cabin and cabin not in ("ECONOMY", "BUSINESS", "FIRST"):
        errors["cabin_class"] = "Must be ECONOMY, BUSINESS, or FIRST."

    status_val = strip(row.get("status")).upper()
    if status_val and status_val not in ("CONFIRMED", "CANCELLED"):
        errors["status"] = "Must be CONFIRMED or CANCELLED."

    price = row.get("total_price") or row.get("price")
    if price not in (None, ""):
        try:
            if Decimal(str(price)) < 0:
                errors["total_price"] = "Total price cannot be negative."
        except (InvalidOperation, ValueError, TypeError):
            errors["total_price"] = "Must be a valid decimal number."

    seats = row.get("seat_count") or row.get("seats")
    if seats not in (None, ""):
        try:
            if int(seats) <= 0:
                errors["seat_count"] = "Seat count must be at least 1."
        except (ValueError, TypeError):
            errors["seat_count"] = "Must be a valid integer."

    gender = strip(row.get("passenger_gender") or row.get("gender")).upper()
    if gender and gender not in ("M", "F", "O"):
        errors["passenger_gender"] = "Must be M, F, or O."

    return errors