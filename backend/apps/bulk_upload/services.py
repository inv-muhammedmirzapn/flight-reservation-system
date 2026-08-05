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
    "airlines",
    "airports",
    "aircraft_models",
    "food_items",
    "aircraft",
    "flight_routes",
    "flight_instances",
    "flight_legs",
    "fares",
    "flight_meals",
]

# Patterns used to map a ZIP filename to an entity key.
_FILENAME_PATTERNS: list[tuple[str, str]] = [
    # (substring, entity_key) — checked in this order
    ("aircraft_model", "aircraft_models"),
    ("aircraftmodel",  "aircraft_models"),
    ("food_item",      "food_items"),
    ("food",           "food_items"),
    ("flight_instance","flight_instances"),
    ("instance",       "flight_instances"),
    ("flight_leg",     "flight_legs"),
    ("leg",            "flight_legs"),
    ("flight_meal",    "flight_meals"),
    ("meal",           "flight_meals"),
    ("fare",           "fares"),
    ("route",          "flight_routes"),
    ("aircraft",       "aircraft"),
    ("airport",        "airports"),
    ("airline",        "airlines"),
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