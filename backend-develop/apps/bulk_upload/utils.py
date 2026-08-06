"""
bulk_upload/utils.py
====================
Low-level file-parsing helpers. No Django models, no business logic.
"""

import csv
import io

import pandas as pd


def read_file(uploaded_file) -> list[dict]:
    """
    Parse a .csv, .xls, or .xlsx uploaded file into a list of row dicts.
    Raises ValueError for unsupported formats.
    """
    name = uploaded_file.name.lower()
    if name.endswith(".csv"):
        text = uploaded_file.read().decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        return [dict(r) for r in reader]
    elif name.endswith((".xls", ".xlsx")):
        df = pd.read_excel(uploaded_file, dtype=str)
        df = df.where(df.notna(), other=None)
        return df.to_dict(orient="records")
    else:
        raise ValueError("Unsupported file format. Please upload a .csv, .xls, or .xlsx file.")


def strip(val, default="") -> str:
    """Return a stripped string from *val*, or *default* if val is None."""
    if val is None:
        return default
    return str(val).strip()


class MockUploadedFile:
    """Minimal file-like object used when extracting entries from a ZIP archive."""

    def __init__(self, content: bytes, name: str):
        self.content = content
        self.name = name

    def read(self) -> bytes:
        return self.content