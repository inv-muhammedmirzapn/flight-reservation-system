"""
Bulk Import API
POST /api/bulk-upload/import/

Accepts a multipart form with:
  - entity: one of 'countries', 'airports', 'airlines', 'aircraft_models', 'aircraft', 'flight_routes'
  - file: .csv, .xls, or .xlsx

Returns an import report:
  {
    "total": N,
    "success": N,
    "created": N,
    "updated": N,
    "failed": N,
    "errors": [
      { "row": 2, "data": {...}, "errors": {...} },
      ...
    ]
  }
"""

import csv
import io

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from apps.flights.permissions import IsAdminOrSuperuser
from apps.flights.models import (
    Country, Airport, Airline, AircraftModel, Aircraft,
    FlightRoute, FlightInstance, FlightLeg, FoodItem, FlightMeal, Fare,
)


def _read_file(uploaded_file):
    """Parse CSV / XLS / XLSX into a list-of-dicts. Raises ValueError on bad format."""
    name = uploaded_file.name.lower()
    if name.endswith(".csv"):
        text = uploaded_file.read().decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows = [dict(r) for r in reader]
    elif name.endswith((".xls", ".xlsx")):
        import pandas as pd
        df = pd.read_excel(uploaded_file, dtype=str)
        df = df.where(df.notna(), other=None)
        rows = df.to_dict(orient="records")
    else:
        raise ValueError("Unsupported file format. Please upload a .csv, .xls, or .xlsx file.")
    return rows


def _strip(val, default=""):
    if val is None:
        return default
    return str(val).strip()


# ── Per-entity processors ─────────────────────────────────────────────────────
# All processors use update_or_create so that re-uploading a CSV with changed
# field values will UPDATE the existing record rather than silently skipping it.

def _import_countries(rows):
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        name     = _strip(row.get("name") or row.get("Name"))
        iso_code = _strip(row.get("iso_code") or row.get("ISO Code") or row.get("iso")).upper()
        row_errors = {}
        if not name:     row_errors["name"] = "Required."
        if not iso_code: row_errors["iso_code"] = "Required."
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors}); continue
        try:
            _, created = Country.objects.update_or_create(
                iso_code=iso_code, defaults={"name": name}
            )
            if created: created_count += 1
            else:        updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}
            errors.append({"row": i, "data": row, "errors": msg})
    return created_count, updated_count, errors


def _import_airlines(rows):
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        code = _strip(row.get("iata_airline_code") or row.get("IATA Code") or row.get("code")).upper()
        name = _strip(row.get("airline_name") or row.get("Name") or row.get("name"))
        row_errors = {}
        if not code: row_errors["iata_airline_code"] = "Required (2-letter IATA code)."
        if not name: row_errors["airline_name"] = "Required."
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors}); continue
        try:
            _, created = Airline.objects.update_or_create(
                iata_airline_code=code, defaults={"airline_name": name}
            )
            if created: created_count += 1
            else:        updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}
            errors.append({"row": i, "data": row, "errors": msg})
    return created_count, updated_count, errors


def _import_airports(rows):
    from decimal import Decimal, InvalidOperation
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        iata        = _strip(row.get("iata_code") or row.get("IATA") or row.get("iata")).upper()
        name        = _strip(row.get("airport_name") or row.get("Name") or row.get("name"))
        city        = _strip(row.get("city") or row.get("City"))
        country_iso = _strip(row.get("country_iso") or row.get("Country ISO") or row.get("country")).upper()
        timezone    = _strip(row.get("timezone") or row.get("Timezone")) or "UTC"
        row_errors = {}
        if not iata or len(iata) != 3: row_errors["iata_code"] = "Required: exactly 3-letter IATA code."
        if not name:        row_errors["airport_name"] = "Required."
        if not city:        row_errors["city"] = "Required."
        if not country_iso: row_errors["country_iso"] = "Required: 2-letter country ISO code."
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors}); continue
        country_obj = Country.objects.filter(iso_code=country_iso).first()
        if not country_obj:
            errors.append({"row": i, "data": row, "errors": {
                "country_iso": f"Country '{country_iso}' not found. Import countries first."
            }}); continue
        def _dec(raw):
            try: return Decimal(str(raw)) if raw not in (None, "", "None") else None
            except InvalidOperation: return None
        lat = _dec(row.get("latitude") or row.get("Latitude"))
        lon = _dec(row.get("longitude") or row.get("Longitude"))
        try:
            _, created = Airport.objects.update_or_create(
                iata_code=iata,
                defaults={"airport_name": name, "city": city, "country": country_obj,
                          "timezone": timezone, "latitude": lat, "longitude": lon}
            )
            if created: created_count += 1
            else:        updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}
            errors.append({"row": i, "data": row, "errors": msg})
    return created_count, updated_count, errors


def _import_aircraft_models(rows):
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        manufacturer = _strip(row.get("manufacturer") or row.get("Manufacturer"))
        model_name   = _strip(row.get("model_name") or row.get("Model") or row.get("model"))
        row_errors = {}
        if not manufacturer: row_errors["manufacturer"] = "Required."
        if not model_name:   row_errors["model_name"] = "Required."
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors}); continue
        try:
            # Both fields are the unique key; just ensure the record exists.
            _, created = AircraftModel.objects.get_or_create(
                manufacturer=manufacturer, model_name=model_name
            )
            if created: created_count += 1
            else:        updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}
            errors.append({"row": i, "data": row, "errors": msg})
    return created_count, updated_count, errors


def _import_aircraft(rows):
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        registration = _strip(row.get("registration") or row.get("Registration")).upper()
        airline_code = _strip(row.get("airline_code") or row.get("Airline IATA") or row.get("airline")).upper()
        manufacturer = _strip(row.get("manufacturer") or row.get("Manufacturer"))
        model_name   = _strip(row.get("model_name") or row.get("Model"))
        def _int(key, alt=0):
            v = row.get(key) or row.get(key.replace("_", " ").title())
            try: return int(float(str(v))) if v not in (None, "", "None") else alt
            except (ValueError, TypeError): return alt
        economy  = _int("economy_capacity")
        business = _int("business_capacity")
        first    = _int("first_class_capacity")
        row_errors = {}
        if not registration: row_errors["registration"] = "Required."
        if not airline_code: row_errors["airline_code"] = "Required (2-letter IATA airline code)."
        if not manufacturer: row_errors["manufacturer"] = "Required."
        if not model_name:   row_errors["model_name"] = "Required."
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors}); continue
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
            if created: created_count += 1
            else:        updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}
            errors.append({"row": i, "data": row, "errors": msg})
    return created_count, updated_count, errors


def _import_flight_routes(rows):
    from decimal import Decimal
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        flight_no    = _strip(row.get("flight_no") or row.get("Flight No") or row.get("flight_number")).upper()
        airline_code = _strip(row.get("airline_code") or row.get("Airline IATA") or row.get("airline")).upper()
        def _dec(key, default=None):
            v = row.get(key) or row.get(key.replace("_", " ").title())
            try: return Decimal(str(v)) if v not in (None, "", "None") else default
            except Exception: return default
        baggage_weight = _dec("baggage_weight_allowed_per_person") or 20
        handbag_weight = _dec("handbag_weight_allowed_per_person") or 7
        row_errors = {}
        if not flight_no:    row_errors["flight_no"] = "Required."
        if not airline_code: row_errors["airline_code"] = "Required (2-letter IATA code)."
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors}); continue
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
            if created: created_count += 1
            else:        updated_count += 1
        except (DjangoValidationError, IntegrityError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}
            errors.append({"row": i, "data": row, "errors": msg})
    return created_count, updated_count, errors


def _import_flight_instances(rows):
    from datetime import datetime
    from django.utils.dateparse import parse_datetime, parse_date
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        flight_no  = _strip(row.get("flight_no") or row.get("flight_number")).upper()
        date_raw   = _strip(row.get("date"))
        reg        = _strip(row.get("aircraft_registration") or row.get("registration")).upper()
        dep_raw    = _strip(row.get("scheduled_departure"))
        arr_raw    = _strip(row.get("scheduled_arrival"))
        status_val = _strip(row.get("status") or "SCHEDULED").upper()
        row_errors = {}
        if not flight_no: row_errors["flight_no"] = "Required."
        if not date_raw:  row_errors["date"] = "Required (YYYY-MM-DD)."
        if not reg:       row_errors["aircraft_registration"] = "Required."
        if not dep_raw:   row_errors["scheduled_departure"] = "Required (YYYY-MM-DD HH:MM)."
        if not arr_raw:   row_errors["scheduled_arrival"] = "Required (YYYY-MM-DD HH:MM)."
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors}); continue
        route = FlightRoute.objects.filter(flight_no=flight_no).first()
        if not route:
            errors.append({"row": i, "data": row, "errors": {
                "flight_no": f"FlightRoute '{flight_no}' not found."}}); continue
        aircraft = Aircraft.objects.filter(registration=reg).first()
        if not aircraft:
            errors.append({"row": i, "data": row, "errors": {
                "aircraft_registration": f"Aircraft '{reg}' not found."}}); continue
        try:
            dep  = parse_datetime(dep_raw) or datetime.strptime(dep_raw, "%Y-%m-%d %H:%M")
            arr  = parse_datetime(arr_raw) or datetime.strptime(arr_raw, "%Y-%m-%d %H:%M")
            date = parse_date(date_raw)
            _, created = FlightInstance.objects.update_or_create(
                flight=route, date=date,
                defaults={"aircraft": aircraft, "status": status_val,
                          "scheduled_departure": dep, "scheduled_arrival": arr}
            )
            if created: created_count += 1
            else:        updated_count += 1
        except (DjangoValidationError, IntegrityError, Exception) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}
            errors.append({"row": i, "data": row, "errors": msg})
    return created_count, updated_count, errors


def _import_flight_legs(rows):
    from datetime import datetime
    from django.utils.dateparse import parse_datetime
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        flight_no = _strip(row.get("flight_no") or row.get("flight_number")).upper()
        leg_order = row.get("leg_order") or row.get("order")
        dep_iata  = _strip(row.get("departure_airport")).upper()
        arr_iata  = _strip(row.get("arrival_airport")).upper()
        dep_raw   = _strip(row.get("scheduled_departure"))
        arr_raw   = _strip(row.get("scheduled_arrival"))
        row_errors = {}
        if not flight_no: row_errors["flight_no"] = "Required."
        if not leg_order: row_errors["leg_order"] = "Required (integer)."
        if not dep_iata:  row_errors["departure_airport"] = "Required (IATA code)."
        if not arr_iata:  row_errors["arrival_airport"] = "Required (IATA code)."
        if not dep_raw:   row_errors["scheduled_departure"] = "Required."
        if not arr_raw:   row_errors["scheduled_arrival"] = "Required."
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors}); continue
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
            dep = parse_datetime(dep_raw) or datetime.strptime(dep_raw, "%Y-%m-%d %H:%M")
            arr = parse_datetime(arr_raw) or datetime.strptime(arr_raw, "%Y-%m-%d %H:%M")
            _, created = FlightLeg.objects.update_or_create(
                flight=route, leg_order=int(leg_order),
                defaults={"departure_airport": dep_ap, "arrival_airport": arr_ap,
                          "scheduled_departure": dep, "scheduled_arrival": arr}
            )
            if created: created_count += 1
            else:        updated_count += 1
        except (DjangoValidationError, IntegrityError, Exception) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}
            errors.append({"row": i, "data": row, "errors": msg})
    return created_count, updated_count, errors


def _import_food_items(rows):
    from decimal import Decimal
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        airline_code = _strip(row.get("airline_code") or row.get("airline")).upper()
        name         = _strip(row.get("name") or row.get("item_name"))
        row_errors = {}
        if not airline_code: row_errors["airline_code"] = "Required."
        if not name:         row_errors["name"] = "Required."
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors}); continue
        airline = Airline.objects.filter(iata_airline_code=airline_code).first()
        if not airline:
            errors.append({"row": i, "data": row, "errors": {
                "airline_code": f"Airline '{airline_code}' not found."}}); continue
        try:
            def _dec(k, d=0):
                v = row.get(k)
                try: return Decimal(str(v)) if v not in (None, "", "None") else Decimal(d)
                except: return Decimal(d)
            def _bool(k): return str(row.get(k, "false")).strip().lower() in ("true", "1", "yes")
            _, created = FoodItem.objects.update_or_create(
                airline=airline, name=name,
                defaults={"price": _dec("price"), "currency": _strip(row.get("currency")) or "INR",
                          "is_veg": _bool("is_veg"), "is_halal": _bool("is_halal"),
                          "is_vegan": _bool("is_vegan")}
            )
            if created: created_count += 1
            else:        updated_count += 1
        except (DjangoValidationError, IntegrityError, Exception) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}
            errors.append({"row": i, "data": row, "errors": msg})
    return created_count, updated_count, errors


def _import_flight_meals(rows):
    from django.utils.dateparse import parse_date
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        flight_no = _strip(row.get("flight_no") or row.get("flight_number")).upper()
        date_raw  = _strip(row.get("date"))
        meal_name = _strip(row.get("meal_name") or row.get("name"))
        row_errors = {}
        if not flight_no: row_errors["flight_no"] = "Required."
        if not date_raw:  row_errors["date"] = "Required (YYYY-MM-DD)."
        if not meal_name: row_errors["meal_name"] = "Required."
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors}); continue
        route = FlightRoute.objects.filter(flight_no=flight_no).first()
        if not route:
            errors.append({"row": i, "data": row, "errors": {
                "flight_no": f"FlightRoute '{flight_no}' not found."}}); continue
        fi = FlightInstance.objects.filter(flight=route, date=parse_date(date_raw)).first()
        if not fi:
            errors.append({"row": i, "data": row, "errors": {
                "date": f"No FlightInstance for {flight_no} on {date_raw}."}}); continue
        try:
            # name is the lookup key alongside flight_instance; nothing else to update
            _, created = FlightMeal.objects.get_or_create(flight_instance=fi, name=meal_name)
            if created: created_count += 1
            else:        updated_count += 1
        except (DjangoValidationError, IntegrityError, Exception) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}
            errors.append({"row": i, "data": row, "errors": msg})
    return created_count, updated_count, errors


def _import_fares(rows):
    from django.utils.dateparse import parse_date
    from decimal import Decimal
    created_count, updated_count, errors = 0, 0, []
    for i, row in enumerate(rows, start=2):
        flight_no   = _strip(row.get("flight_no") or row.get("flight_number")).upper()
        date_raw    = _strip(row.get("date"))
        fare_code   = _strip(row.get("fare_code")).upper()
        cabin_class = _strip(row.get("cabin_class") or row.get("class")).upper()
        row_errors = {}
        if not flight_no:  row_errors["flight_no"] = "Required."
        if not date_raw:   row_errors["date"] = "Required (YYYY-MM-DD)."
        if not fare_code:  row_errors["fare_code"] = "Required."
        if cabin_class not in ("ECONOMY", "BUSINESS", "FIRST"):
            row_errors["cabin_class"] = "Must be ECONOMY, BUSINESS, or FIRST."
        if row_errors:
            errors.append({"row": i, "data": row, "errors": row_errors}); continue
        route = FlightRoute.objects.filter(flight_no=flight_no).first()
        if not route:
            errors.append({"row": i, "data": row, "errors": {
                "flight_no": f"FlightRoute '{flight_no}' not found."}}); continue
        fi = FlightInstance.objects.filter(flight=route, date=parse_date(date_raw)).first()
        if not fi:
            errors.append({"row": i, "data": row, "errors": {
                "date": f"No FlightInstance for {flight_no} on {date_raw}."}}); continue
        try:
            def _dec(k, d=0):
                v = row.get(k)
                try: return Decimal(str(v)) if v not in (None, "", "None") else Decimal(d)
                except: return Decimal(d)
            def _int(k, d=0):
                v = row.get(k)
                try: return int(float(str(v))) if v not in (None, "", "None") else d
                except: return d
            _, created = Fare.objects.update_or_create(
                flight_instance=fi, fare_code=fare_code, cabin_class=cabin_class,
                defaults={
                    "price": _dec("price"),
                    "currency": _strip(row.get("currency")) or "INR",
                    "available_seats": _int("available_seats"),
                    "refund_type": _strip(row.get("refund_type") or "NON_REFUNDABLE").upper(),
                    "change_fee": _dec("change_fee"),
                    "meal_included": str(row.get("meal_included", "false")).lower() in ("true", "1", "yes"),
                }
            )
            if created: created_count += 1
            else:        updated_count += 1
        except (DjangoValidationError, IntegrityError, Exception) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else {"detail": str(exc)}
            errors.append({"row": i, "data": row, "errors": msg})
    return created_count, updated_count, errors


# ── Entity registry ───────────────────────────────────────────────────────────

ENTITY_PROCESSORS = {
    "countries":        _import_countries,
    "airlines":         _import_airlines,
    "airports":         _import_airports,
    "aircraft_models":  _import_aircraft_models,
    "aircraft":         _import_aircraft,
    "flight_routes":    _import_flight_routes,
    "flight_instances": _import_flight_instances,
    "flight_legs":      _import_flight_legs,
    "food_items":       _import_food_items,
    "flight_meals":     _import_flight_meals,
    "fares":            _import_fares,
}

class BulkImportView(APIView):
    """
    POST /api/bulk-upload/import/
    Multipart form fields:
      - entity  (string): one of ENTITY_PROCESSORS keys, or "all"
      - file    (file):   .csv / .xls / .xlsx or .zip (if entity is "all")
    """
    permission_classes = [IsAdminOrSuperuser]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        entity = request.data.get("entity", "").strip().lower()
        uploaded_file = request.FILES.get("file")

        if not entity:
            return Response({"detail": "The 'entity' field is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        if not uploaded_file:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        # ── Handle ZIP for All Tables import ──────────────────────────────────
        if entity == "all":
            if not uploaded_file.name.lower().endswith(".zip"):
                return Response(
                    {"detail": "To import all tables, please upload a single .zip file containing your CSV/Excel files."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            import zipfile
            try:
                zip_buffer = io.BytesIO(uploaded_file.read())
                with zipfile.ZipFile(zip_buffer) as z:
                    namelist = z.namelist()
                    file_mapping = {}
                    for name in namelist:
                        if name.startswith("__MACOSX") or name.endswith("/") or name.startswith("."):
                            continue
                        
                        lower_name = name.lower()
                        matched_entity = None
                        if "country" in lower_name or "countries" in lower_name:
                            matched_entity = "countries"
                        elif "airline" in lower_name or "airlines" in lower_name:
                            matched_entity = "airlines"
                        elif "airport" in lower_name or "airports" in lower_name:
                            matched_entity = "airports"
                        elif "aircraft_model" in lower_name or "aircraftmodel" in lower_name or "model" in lower_name:
                            matched_entity = "aircraft_models"
                        elif "food" in lower_name or "food_item" in lower_name:
                            matched_entity = "food_items"
                        elif "aircraft" in lower_name:
                            matched_entity = "aircraft"
                        elif "route" in lower_name:
                            matched_entity = "flight_routes"
                        elif "instance" in lower_name or "flight_instance" in lower_name:
                            matched_entity = "flight_instances"
                        elif "leg" in lower_name or "flight_leg" in lower_name:
                            matched_entity = "flight_legs"
                        elif "meal" in lower_name or "flight_meal" in lower_name:
                            matched_entity = "flight_meals"
                        elif "fare" in lower_name:
                            matched_entity = "fares"
                        
                        if matched_entity:
                            file_mapping[matched_entity] = name
                    
                    import_order = ["countries", "airlines", "airports", "aircraft_models", "food_items", "aircraft", "flight_routes", "flight_instances", "flight_legs", "fares", "flight_meals"]
                    combined_report = {
                        "entity": "all",
                        "total": 0,
                        "success": 0,
                        "failed": 0,
                        "errors": [],
                        "reports": []
                    }
                    
                    # Custom class to mock uploaded file behavior
                    class MockUploadedFile:
                        def __init__(self, content, name):
                            self.content = content
                            self.name = name
                        def read(self):
                            return self.content

                    for ent_id in import_order:
                        if ent_id in file_mapping:
                            filename = file_mapping[ent_id]
                            with z.open(filename) as f:
                                mock_file = MockUploadedFile(f.read(), filename)
                                try:
                                    rows = _read_file(mock_file)
                                    if rows:
                                        created_count, updated_count, error_list = ENTITY_PROCESSORS[ent_id](rows)
                                        combined_report["total"] += len(rows)
                                        combined_report["success"] += created_count + updated_count
                                        combined_report.setdefault("created", 0)
                                        combined_report["created"] += created_count
                                        combined_report.setdefault("updated", 0)
                                        combined_report["updated"] += updated_count
                                        combined_report["failed"] += len(error_list)
                                        combined_report["errors"].extend(error_list)
                                        combined_report["reports"].append({
                                            "entity": ent_id,
                                            "total": len(rows),
                                            "success": created_count + updated_count,
                                            "created": created_count,
                                            "updated": updated_count,
                                            "failed": len(error_list),
                                            "errors": error_list
                                        })
                                except Exception as e:
                                    combined_report["failed"] += 1
                                    combined_report["errors"].append({
                                        "row": "—",
                                        "data": {},
                                        "errors": {"detail": f"Error parsing {filename}: {str(e)}"}
                                    })
                    
                    if not combined_report["reports"]:
                        return Response(
                            {"detail": "No matching CSV/Excel files found in the ZIP archive. Ensure file names contain table names (e.g., 'countries.csv', 'airlines.xlsx')."},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    return Response(combined_report, status=status.HTTP_200_OK)
            except Exception as exc:
                return Response({"detail": f"Failed to parse ZIP archive: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

        # ── Handle Single Entity ──────────────────────────────────────────────
        if entity not in ENTITY_PROCESSORS:
            return Response(
                {"detail": f"Unknown entity '{entity}'. Valid options: all, {', '.join(ENTITY_PROCESSORS.keys())}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Parse file
        try:
            rows = _read_file(uploaded_file)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({"detail": f"Failed to parse file: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            return Response({"detail": "The uploaded file contains no data rows."}, status=status.HTTP_400_BAD_REQUEST)

        processor = ENTITY_PROCESSORS[entity]
        created_count, updated_count, error_list = processor(rows)

        return Response({
            "entity": entity,
            "total": len(rows),
            "success": created_count + updated_count,
            "created": created_count,
            "updated": updated_count,
            "failed": len(error_list),
            "errors": error_list,
            "reports": [{
                "entity": entity,
                "total": len(rows),
                "success": created_count + updated_count,
                "created": created_count,
                "updated": updated_count,
                "failed": len(error_list),
                "errors": error_list
            }]
        }, status=status.HTTP_200_OK)