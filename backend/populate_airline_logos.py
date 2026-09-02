import os
import django
from pathlib import Path

# Setup Django environment
BASE_DIR = Path(__file__).resolve().parent
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

from apps.flights.models import Airline

def populate_logos():
    media_airlines_dir = BASE_DIR / "media" / "airlines"
    
    # Mapping of IATA code to existing filenames in media/airlines/
    logo_mapping = {
        "AI": "ai_logo.jpg",
        "6E": "6e_logo.png",
        "LH": "lh_logo.png",
        "EK": "ek_logo.png",
        "BA": "ba_logo.png",
        "AA": "aa_logo.png",
        "SQ": "sq_logo.png",
        "JL": "jl_logo.png",
        "AF": "af_logo.png",
        "QF": "qf_logo.png",
        "QR": "qr_logo.png",
        "TK": "tk_logo.png",
    }

    airlines = Airline.objects.all()
    print(f"Found {airlines.count()} airlines in database.")

    for airline in airlines:
        code = (airline.iata_airline_code or "").strip().upper()
        name_lower = (airline.airline_name or "").strip().lower()

        target_file = logo_mapping.get(code)

        if target_file:
            target_path = media_airlines_dir / target_file
            if target_path.exists():
                rel_path = f"airlines/{target_file}"
                airline.logo = rel_path
                airline.save(update_fields=["logo"])
                print(f"Updated Airline [{code}] {airline.airline_name} logo -> {rel_path}")
            else:
                print(f"Warning: File {target_path} does not exist.")
        else:
            print(f"No logo mapping found for {airline.airline_name}")

if __name__ == "__main__":
    populate_logos()
