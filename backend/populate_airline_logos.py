import os
import shutil
import django
from pathlib import Path

# Setup Django environment
BASE_DIR = Path(__file__).resolve().parent
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

from apps.flights.models import Airline

def populate_logos():
    source_dir = BASE_DIR / "images" / "airline_logos"
    media_airlines_dir = BASE_DIR / "media" / "airlines"
    media_airlines_dir.mkdir(parents=True, exist_ok=True)

    logo_mapping = {
        "AI": "Air-India-Logo.jpg",
        "6E": "Indigo_logo.png",
        "LH": "Lufthansa-Logo.png",
        "EK": "emirates_logo.png",
    }

    # Also map by lowercase name keywords
    name_mapping = {
        "air india": "Air-India-Logo.jpg",
        "indigo": "Indigo_logo.png",
        "lufthansa": "Lufthansa-Logo.png",
        "emirates": "emirates_logo.png",
    }

    default_logo_file = "default_logo"

    airlines = Airline.objects.all()
    print(f"Found {airlines.count()} airlines in database.")

    for airline in airlines:
        code = (airline.iata_airline_code or "").strip().upper()
        name_lower = (airline.airline_name or "").strip().lower()

        target_file = None
        if code in logo_mapping:
            target_file = logo_mapping[code]
        else:
            for kw, file_name in name_mapping.items():
                if kw in name_lower:
                    target_file = file_name
                    break

        if not target_file:
            target_file = default_logo_file

        source_path = source_dir / target_file
        if source_path.exists():
            # Determine extension
            ext = source_path.suffix if source_path.suffix else ".png"
            dest_filename = f"{code.lower()}_logo{ext}"
            dest_path = media_airlines_dir / dest_filename

            shutil.copy2(source_path, dest_path)

            # Relative path saved in FileField (relative to MEDIA_ROOT)
            rel_path = f"airlines/{dest_filename}"
            airline.logo = rel_path
            airline.save(update_fields=["logo"])
            print(f"Updated Airline [{code}] {airline.airline_name} logo -> {rel_path}")
        else:
            print(f"Warning: Source file {source_path} does not exist.")

if __name__ == "__main__":
    populate_logos()
