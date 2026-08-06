import csv
import io
from django.core.management.base import BaseCommand
from apps.flights.models import Country


class Command(BaseCommand):
    help = "Import or populate countries into the database via command line."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            help="Optional path to a CSV/Excel file containing country data (columns: iso_code, name)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear all existing countries before importing",
        )

    def handle(self, *args, **options):
        file_path = options.get("file")
        clear = options.get("clear")

        if clear:
            count = Country.objects.count()
            Country.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Cleared {count} existing country records."))

        created_count = 0
        updated_count = 0

        if file_path:
            self.stdout.write(f"Importing countries from file: {file_path}")
            rows = []
            if file_path.lower().endswith(".csv"):
                with open(file_path, "r", encoding="utf-8-sig") as f:
                    reader = csv.DictReader(f)
                    rows = [dict(r) for r in reader]
            elif file_path.lower().endswith((".xls", ".xlsx")):
                import pandas as pd
                df = pd.read_excel(file_path, dtype=str)
                df = df.where(df.notna(), other=None)
                rows = df.to_dict(orient="records")
            else:
                self.stderr.write(self.style.ERROR("Unsupported file format. Use .csv, .xls, or .xlsx"))
                return

            for row in rows:
                iso_code = str(row.get("iso_code") or row.get("ISO Code") or row.get("iso") or "").strip().upper()
                name = str(row.get("name") or row.get("Name") or row.get("country_name") or "").strip()
                if not iso_code or not name:
                    continue
                c, created = Country.objects.update_or_create(
                    iso_code=iso_code,
                    defaults={"name": name}
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1
        else:
            self.stdout.write("Populating standard countries using pycountry...")
            import pycountry
            for c in pycountry.countries:
                iso_code = c.alpha_2.upper()
                name = c.name
                country_obj = Country.objects.filter(iso_code=iso_code).first()
                if country_obj:
                    if country_obj.name != name:
                        country_obj.name = name
                        country_obj.save()
                        updated_count += 1
                else:
                    Country.objects.create(name=name, iso_code=iso_code)
                    created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Country import completed! Created: {created_count}, Updated: {updated_count}, Total in DB: {Country.objects.count()}"
            )
        )
