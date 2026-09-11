import csv
import io
import os
import requests
from django.core.management.base import BaseCommand
from apps.flights.models import Airport
from apps.flights.services import import_airports_from_csv
from apps.bulk_upload.repositories import import_airports as bulk_import_airports


class Command(BaseCommand):
    help = "Import airports into the database from OpenFlights repository or a local CSV/DAT/Excel file."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            help="Optional path to a local CSV, .dat, .xls, or .xlsx file containing airport data.",
        )
        parser.add_argument(
            "--countries",
            type=str,
            default="",
            help="Comma-separated country names to filter (e.g. --countries='India,United States' or --countries=India).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Maximum number of airport records to import.",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Overwrite existing airport records if already present.",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear all existing airport records before importing.",
        )

    def handle(self, *args, **options):
        file_path = options.get("file")
        countries_param = options.get("countries", "").strip()
        limit = options.get("limit")
        overwrite = options.get("overwrite", False)
        clear = options.get("clear", False)

        filter_countries = (
            [c.strip().lower() for c in countries_param.split(",") if c.strip()]
            if countries_param
            else None
        )

        if clear:
            count = Airport.objects.count()
            Airport.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Cleared {count} existing airport records."))

        created_count = 0
        updated_count = 0
        skipped_count = 0

        if file_path:
            if not os.path.exists(file_path):
                self.stderr.write(self.style.ERROR(f"File not found: {file_path}"))
                return

            self.stdout.write(f"Reading airport data from file: {file_path}")
            lower_path = file_path.lower()

            if lower_path.endswith((".xls", ".xlsx")):
                import pandas as pd
                df = pd.read_excel(file_path, dtype=str)
                df = df.where(df.notna(), other=None)
                rows = df.to_dict(orient="records")
                c_cnt, u_cnt, errs = bulk_import_airports(rows)
                created_count += c_cnt
                updated_count += u_cnt
                skipped_count += len(errs)
                if errs:
                    self.stderr.write(self.style.WARNING(f"{len(errs)} rows had errors during Excel import."))
            elif lower_path.endswith((".csv", ".dat", ".txt")):
                with open(file_path, "r", encoding="utf-8-sig", errors="ignore") as f:
                    first_line = f.readline()
                    f.seek(0)
                    content = f.read()

                # Detect if file is header-based CSV or raw OpenFlights positional format
                has_header = any(h in first_line.lower() for h in ["iata_code", "iata", "airport_name", "city", "country_iso"])
                if has_header and not first_line.strip().startswith(("1,", "2,", "3,")):
                    reader = csv.DictReader(io.StringIO(content))
                    rows = [dict(r) for r in reader]
                    c_cnt, u_cnt, errs = bulk_import_airports(rows)
                    created_count += c_cnt
                    updated_count += u_cnt
                    skipped_count += len(errs)
                    if errs:
                        self.stderr.write(self.style.WARNING(f"{len(errs)} rows had errors during CSV import."))
                else:
                    # Positional OpenFlights format
                    res = import_airports_from_csv(
                        csv_content=content,
                        overwrite=overwrite,
                        limit=limit,
                        filter_countries=filter_countries,
                    )
                    created_count = res["created_count"]
                    updated_count = res["updated_count"]
                    skipped_count = res["skipped_count"]
            else:
                self.stderr.write(self.style.ERROR("Unsupported file format. Please use .csv, .dat, .xls, or .xlsx"))
                return
        else:
            url = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat"
            self.stdout.write(f"Downloading OpenFlights dataset from {url} ...")
            if filter_countries:
                self.stdout.write(f"Filtering by countries: {', '.join(filter_countries)}")
            if limit:
                self.stdout.write(f"Limit: {limit} records")

            try:
                resp = requests.get(url, timeout=30)
                if resp.status_code == 200:
                    csv_content = resp.text
                else:
                    self.stderr.write(self.style.ERROR(f"Failed to download OpenFlights data: HTTP {resp.status_code}"))
                    return
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Failed to connect to OpenFlights: {str(e)}"))
                return

            res = import_airports_from_csv(
                csv_content=csv_content,
                overwrite=overwrite,
                limit=limit,
                filter_countries=filter_countries,
            )
            created_count = res["created_count"]
            updated_count = res["updated_count"]
            skipped_count = res["skipped_count"]

        total_db = Airport.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Airports import completed!\n"
                f"  Created: {created_count}\n"
                f"  Updated: {updated_count}\n"
                f"  Skipped: {skipped_count}\n"
                f"  Total airports in database: {total_db}"
            )
        )
