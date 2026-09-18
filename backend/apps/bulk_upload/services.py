"""
bulk_upload/services.py
=======================
Orchestration layer — coordinates file parsing, entity dispatch,
and ZIP multi-import. Called by views; calls repositories.
"""

import io
import zipfile

from .utils import read_file, MockUploadedFile
from .repositories import ENTITY_IMPORTERS

# Entities must be imported in dependency order so FK lookups succeed.
IMPORT_ORDER = [
    "users",
    "countries",
    "airlines",
    "airports",
    "aircraft_models",
    "food_items",
    "flight_meals",
    "flight_meal_items",
    "aircraft",
    "flight_routes",
    "flight_legs",
    "route_fare_classes",
    "flight_instances",
    "fares",
    "seats",
    "bookings",
    "holiday_events",
]

# Patterns used to map a ZIP filename to an entity key.
_FILENAME_PATTERNS: list[tuple[str, str]] = [
    # (substring, entity_key) — checked in this order
    ("aircraft_models",   "aircraft_models"),
    ("aircraft_model",    "aircraft_models"),
    ("aircraftmodels",    "aircraft_models"),
    ("aircraftmodel",     "aircraft_models"),
    ("flight_meal_items", "flight_meal_items"),
    ("flight_meal_item",  "flight_meal_items"),
    ("meal_items",        "flight_meal_items"),
    ("meal_item",         "flight_meal_items"),
    ("flight_meals",      "flight_meals"),
    ("flight_meal",       "flight_meals"),
    ("meals",             "flight_meals"),
    ("meal",              "flight_meals"),
    ("food_items",        "food_items"),
    ("food_item",         "food_items"),
    ("foods",             "food_items"),
    ("food",              "food_items"),
    ("route_fare_classes","route_fare_classes"),
    ("route_fare_class",  "route_fare_classes"),
    ("route_fares",       "route_fare_classes"),
    ("route_fare",        "route_fare_classes"),
    ("holiday_events",    "holiday_events"),
    ("holiday_event",     "holiday_events"),
    ("holidays",          "holiday_events"),
    ("holiday",           "holiday_events"),
    ("flight_instances",  "flight_instances"),
    ("flight_instance",   "flight_instances"),
    ("instances",         "flight_instances"),
    ("instance",          "flight_instances"),
    ("flight_legs",       "flight_legs"),
    ("flight_leg",        "flight_legs"),
    ("legs",              "flight_legs"),
    ("leg",               "flight_legs"),
    ("seats",             "seats"),
    ("seat",              "seats"),
    ("fares",             "fares"),
    ("fare",              "fares"),
    ("flight_routes",     "flight_routes"),
    ("flight_route",      "flight_routes"),
    ("routes",            "flight_routes"),
    ("route",             "flight_routes"),
    ("aircrafts",         "aircraft"),
    ("aircraft",          "aircraft"),
    ("airports",          "airports"),
    ("airport",           "airports"),
    ("airlines",          "airlines"),
    ("airline",           "airlines"),
    ("countries",         "countries"),
    ("country",           "countries"),
    ("users",             "users"),
    ("user",              "users"),
    ("bookings",          "bookings"),
    ("booking",           "bookings"),
]


def _entity_from_filename(name: str) -> str | None:
    """Return the entity key that best matches a ZIP member filename, or None."""
    lower = name.lower()
    for substring, entity in _FILENAME_PATTERNS:
        if substring in lower:
            return entity
    return None


def _make_entity_report(entity: str, rows: list, created: int, updated: int, errors: list) -> dict:
    return {
        "entity":   entity,
        "total":    len(rows),
        "success":  created + updated,
        "created":  created,
        "updated":  updated,
        "failed":   len(errors),
        "errors":   errors,
    }


def import_single_entity(entity: str, uploaded_file) -> dict:
    """
    Parse *uploaded_file* and run the importer for *entity*.

    Returns a report dict.
    Raises ValueError for unknown entity or bad file format.
    Raises RuntimeError if the file has no data rows.
    """
    if entity not in ENTITY_IMPORTERS:
        valid = ", ".join(ENTITY_IMPORTERS.keys())
        raise ValueError(f"Unknown entity '{entity}'. Valid options: all, {valid}.")

    rows = read_file(uploaded_file)          # raises ValueError on bad format
    if not rows:
        raise RuntimeError("The uploaded file contains no data rows.")

    importer = ENTITY_IMPORTERS[entity]
    created, updated, errors = importer(rows)
    return _make_entity_report(entity, rows, created, updated, errors)


def import_from_zip(uploaded_file) -> dict:
    """
    Extract every CSV/Excel file from a ZIP archive, auto-detect its entity
    from the filename, and import them in the correct dependency order.

    Returns a combined report dict.
    Raises ValueError / zipfile.BadZipFile on invalid archives.
    """
    zip_bytes = uploaded_file.read()
    zip_buffer = io.BytesIO(zip_bytes)

    with zipfile.ZipFile(zip_buffer) as z:
        # Map entity → first matching member name inside the ZIP.
        file_mapping: dict[str, str] = {}
        for member_name in z.namelist():
            if (member_name.startswith("__MACOSX")
                    or member_name.endswith("/")
                    or member_name.startswith(".")):
                continue
            entity = _entity_from_filename(member_name)
            if entity and entity not in file_mapping:
                file_mapping[entity] = member_name

        combined: dict = {
            "entity":  "all",
            "total":   0,
            "success": 0,
            "created": 0,
            "updated": 0,
            "failed":  0,
            "errors":  [],
            "reports": [],
        }

        for entity in IMPORT_ORDER:
            if entity not in file_mapping:
                continue
            member_name = file_mapping[entity]
            with z.open(member_name) as f:
                mock = MockUploadedFile(f.read(), member_name)
                try:
                    rows = read_file(mock)
                    if not rows:
                        continue
                    importer = ENTITY_IMPORTERS[entity]
                    created, updated, errors = importer(rows)
                    combined["total"]   += len(rows)
                    combined["success"] += created + updated
                    combined["created"] += created
                    combined["updated"] += updated
                    combined["failed"]  += len(errors)
                    combined["errors"].extend(errors)
                    combined["reports"].append(
                        _make_entity_report(entity, rows, created, updated, errors)
                    )
                except Exception as exc:
                    combined["failed"] += 1
                    combined["errors"].append({
                        "row": "—",
                        "data": {},
                        "errors": {"detail": f"Error parsing {member_name}: {exc}"},
                    })

    if not combined["reports"]:
        raise ValueError(
            "No matching CSV/Excel files found in the ZIP archive. "
            "Ensure file names contain table names (e.g. 'airports.csv', 'airlines.xlsx')."
        )

    return combined


ENTITY_LABELS = {
    "users": "Users",
    "countries": "Countries",
    "airlines": "Airlines",
    "airports": "Airports",
    "aircraft_models": "Aircraft Models",
    "food_items": "Food Items",
    "flight_meals": "Flight Meals",
    "flight_meal_items": "Flight Meal Items",
    "aircraft": "Aircraft",
    "flight_routes": "Flight Routes",
    "flight_legs": "Flight Legs",
    "route_fare_classes": "Route Fare Classes",
    "flight_instances": "Flight Instances",
    "fares": "Fares",
    "seats": "Seats",
    "bookings": "Bookings",
    "holiday_events": "Holiday Events",
}


def stream_import_from_zip(uploaded_file):
    """
    Generator yielding Server-Sent Events (SSE) progress as files inside the ZIP are processed.
    """
    import json
    try:
        zip_bytes = uploaded_file.read()
        zip_buffer = io.BytesIO(zip_bytes)

        with zipfile.ZipFile(zip_buffer) as z:
            file_mapping: dict[str, str] = {}
            for member_name in z.namelist():
                if (member_name.startswith("__MACOSX")
                        or member_name.endswith("/")
                        or member_name.startswith(".")):
                    continue
                entity = _entity_from_filename(member_name)
                if entity and entity not in file_mapping:
                    file_mapping[entity] = member_name

            ordered_entities = [e for e in IMPORT_ORDER if e in file_mapping]
            total_steps = len(ordered_entities)
            if total_steps == 0:
                yield f"data: {json.dumps({'type': 'error', 'detail': 'No recognizable data files found in ZIP archive.'})}\n\n"
                return

            yield f"data: {json.dumps({'type': 'start', 'total_steps': total_steps, 'percent': 3, 'message': f'Discovered {total_steps} tables in ZIP'})}\n\n"

            combined: dict = {
                "entity":  "all",
                "total":   0,
                "success": 0,
                "created": 0,
                "updated": 0,
                "failed":  0,
                "errors":  [],
                "reports": [],
            }

            for idx, entity in enumerate(ordered_entities):
                member_name = file_mapping[entity]
                label = ENTITY_LABELS.get(entity, entity.replace("_", " ").title())
                current_percent = int(5 + (idx / total_steps) * 90)

                yield f"data: {json.dumps({'type': 'progress', 'entity': entity, 'label': label, 'step': idx + 1, 'total_steps': total_steps, 'percent': current_percent, 'status': 'importing', 'message': f'Importing {label} (Table {idx + 1} of {total_steps})...'})}\n\n"

                with z.open(member_name) as f:
                    mock = MockUploadedFile(f.read(), member_name)
                    try:
                        rows = read_file(mock)
                        if not rows:
                            continue
                        importer = ENTITY_IMPORTERS[entity]
                        created, updated, errors = importer(rows)
                        entity_report = _make_entity_report(entity, rows, created, updated, errors)

                        combined["total"]   += len(rows)
                        combined["success"] += created + updated
                        combined["created"] += created
                        combined["updated"] += updated
                        combined["failed"]  += len(errors)
                        combined["errors"].extend(errors)
                        combined["reports"].append(entity_report)

                        step_percent = int(5 + ((idx + 1) / total_steps) * 90)
                        yield f"data: {json.dumps({'type': 'entity_done', 'entity': entity, 'label': label, 'step': idx + 1, 'total_steps': total_steps, 'percent': step_percent, 'created': created, 'updated': updated, 'failed': len(errors), 'total_created': combined['created'], 'message': f'Finished {label}: {created} created, {len(errors)} failed'})}\n\n"
                    except Exception as exc:
                        logger.exception(f"Error processing {entity} from {member_name}")
                        entity_report = {
                            "entity":  entity,
                            "total":   0,
                            "success": 0,
                            "created": 0,
                            "updated": 0,
                            "failed":  1,
                            "errors":  [{"row": "—", "data": {}, "errors": {"detail": str(exc)}}],
                        }
                        combined["failed"] += 1
                        combined["errors"].append({"row": "—", "data": {}, "errors": {"detail": f"Error parsing {member_name}: {exc}"}})
                        combined["reports"].append(entity_report)

            yield f"data: {json.dumps({'type': 'done', 'percent': 100, 'report': combined, 'reports': combined['reports'], 'message': 'Import completed successfully!'})}\n\n"
    except Exception as exc:
        logger.exception("Stream ZIP processing failure")
        yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"


def stream_import_single_entity(entity: str, uploaded_file):
    """
    Generator yielding SSE progress for single file upload.
    """
    import json
    if entity not in ENTITY_IMPORTERS:
        valid = ", ".join(ENTITY_IMPORTERS.keys())
        yield f"data: {json.dumps({'type': 'error', 'detail': f'Unknown entity {entity}. Valid: {valid}'})}\n\n"
        return

    label = ENTITY_LABELS.get(entity, entity.replace("_", " ").title())
    yield f"data: {json.dumps({'type': 'start', 'total_steps': 1, 'percent': 15, 'entity': entity, 'label': label, 'message': f'Reading {label} file...'})}\n\n"

    try:
        rows = read_file(uploaded_file)
        if not rows:
            yield f"data: {json.dumps({'type': 'error', 'detail': 'The uploaded file contains no data rows.'})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'progress', 'total_steps': 1, 'percent': 50, 'entity': entity, 'label': label, 'step': 1, 'message': f'Validating and importing {len(rows)} {label} records...'})}\n\n"

        importer = ENTITY_IMPORTERS[entity]
        created, updated, errors = importer(rows)
        report = _make_entity_report(entity, rows, created, updated, errors)

        yield f"data: {json.dumps({'type': 'done', 'percent': 100, 'report': report, 'reports': [report], 'created': created, 'updated': updated, 'failed': len(errors), 'message': f'{label} import complete!'})}\n\n"
    except Exception as exc:
        logger.exception(f"Stream single entity failure: {entity}")
        yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"