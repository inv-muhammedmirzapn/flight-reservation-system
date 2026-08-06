"""
bulk_upload/validators.py
=========================
Per-entity row-level validation functions.
Each function receives a raw row dict and returns an error dict
(empty means valid).  No DB calls, no side effects.
"""

from .utils import strip


def validate_airline_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("iata_airline_code") or row.get("IATA Code") or row.get("code")):
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
    if not strip(row.get("airline_code") or row.get("Airline IATA") or row.get("airline")):
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
    if not strip(row.get("airline_code") or row.get("Airline IATA") or row.get("airline")):
        errors["airline_code"] = "Required (2-letter IATA code)."
    return errors


def validate_flight_instance_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("flight_no") or row.get("flight_number")):
        errors["flight_no"] = "Required."
    if not strip(row.get("date")):
        errors["date"] = "Required (YYYY-MM-DD)."
    if not strip(row.get("aircraft_registration") or row.get("registration")):
        errors["aircraft_registration"] = "Required."
    if not strip(row.get("scheduled_departure")):
        errors["scheduled_departure"] = "Required (YYYY-MM-DD HH:MM)."
    if not strip(row.get("scheduled_arrival")):
        errors["scheduled_arrival"] = "Required (YYYY-MM-DD HH:MM)."
    return errors


def validate_flight_leg_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("flight_no") or row.get("flight_number")):
        errors["flight_no"] = "Required."
    if not (row.get("leg_order") or row.get("order")):
        errors["leg_order"] = "Required (integer)."
    if not strip(row.get("departure_airport")):
        errors["departure_airport"] = "Required (IATA code)."
    if not strip(row.get("arrival_airport")):
        errors["arrival_airport"] = "Required (IATA code)."
    if not strip(row.get("scheduled_departure")):
        errors["scheduled_departure"] = "Required."
    if not strip(row.get("scheduled_arrival")):
        errors["scheduled_arrival"] = "Required."
    return errors


def validate_food_item_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("airline_code") or row.get("airline")):
        errors["airline_code"] = "Required."
    if not strip(row.get("name") or row.get("item_name")):
        errors["name"] = "Required."
    return errors


def validate_flight_meal_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("flight_no") or row.get("flight_number")):
        errors["flight_no"] = "Required."
    if not strip(row.get("date")):
        errors["date"] = "Required (YYYY-MM-DD)."
    if not strip(row.get("meal_name") or row.get("name")):
        errors["meal_name"] = "Required."
    return errors


def validate_fare_row(row: dict) -> dict:
    errors = {}
    if not strip(row.get("flight_no") or row.get("flight_number")):
        errors["flight_no"] = "Required."
    if not strip(row.get("date")):
        errors["date"] = "Required (YYYY-MM-DD)."
    if not strip(row.get("fare_code")):
        errors["fare_code"] = "Required."
    cabin = strip(row.get("cabin_class") or row.get("class")).upper()
    if cabin not in ("ECONOMY", "BUSINESS", "FIRST"):
        errors["cabin_class"] = "Must be ECONOMY, BUSINESS, or FIRST."
    return errors