import { getAirportInfo } from "@/utils/airportHelpers";
import BaggageAndMealsInfoCards from "@/components/flights/BaggageAndMealsInfoCards";

export default function FlightItinerarySummaryCard({ flight, selectedCabinClass = "ECONOMY" }) {
  if (!flight) return null;

  const {
    airline = "IndiGo",
    airline_logo,
    source_airport = "COK",
    destination_airport = "DEL",
    departure_time,
    arrival_time,
    stops = [],
    fares,
    baggage_weight_allowed_per_person,
    handbag_weight_allowed_per_person,
  } = flight;

  const sourceInfo = getAirportInfo(source_airport);
  const destInfo = getAirportInfo(destination_airport);

  const depTime = departure_time || flight.scheduled_departure;
  const arrTime = arrival_time || flight.scheduled_arrival;

  // Date and Time formatting matching FlightItineraryCard
  const formatDateTime = (isoString) => {
    if (!isoString) return { dateStr: "-", timeStr: "--:--", fullDateStr: "-" };
    const d = new Date(isoString);
    const fullDateStr = d.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return { fullDateStr };
  };

  const dep = formatDateTime(depTime);

  // Duration calculation matching FlightItineraryCard
  const calculateDuration = (depIso, arrIso) => {
    if (!depIso || !arrIso) return "0h 0m";
    const depMs = new Date(depIso).getTime();
    const arrMs = new Date(arrIso).getTime();
    const diffMins = Math.max(0, Math.floor((arrMs - depMs) / (1000 * 60)));
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h ${m}m`;
  };

  const durationStr = calculateDuration(depTime, arrTime);
  const stopCount = Array.isArray(stops) ? stops.length : typeof stops === "number" ? stops : 0;
  const stopsStr = stopCount === 0 ? "Non-stop" : `${stopCount} Stop${stopCount > 1 ? "s" : ""}`;

  const getLogoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `http://127.0.0.1:8000${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const logoSrc = getLogoUrl(airline_logo);

  // Resolve fare for cabin class to get effective allowances & meal inclusion
  const getActiveFare = () => {
    if (!fares) return null;
    const norm = (selectedCabinClass || "ECONOMY").toUpperCase().replace(/\s+/g, "_");
    if (fares[norm]) return fares[norm];
    if (norm.includes("BUSINESS") && fares["BUSINESS"]) return fares["BUSINESS"];
    if (norm.includes("FIRST") && fares["FIRST"]) return fares["FIRST"];
    if (fares["ECONOMY"]) return fares["ECONOMY"];
    const firstKey = Object.keys(fares)[0];
    return firstKey ? fares[firstKey] : null;
  };

  const activeFare = getActiveFare();

  const baggageKg =
    activeFare?.effective_baggage_allowance_kg ??
    activeFare?.baggage_allowance ??
    baggage_weight_allowed_per_person ??
    20;

  const handbagKg =
    activeFare?.effective_handbag_allowance_kg ??
    activeFare?.handbag_allowance ??
    handbag_weight_allowed_per_person ??
    7;

  const isMealInc = Boolean(
    activeFare?.meal_included ??
      flight.meal_included ??
      Object.values(fares || {}).some((f) => f?.meal_included)
  );

  return (
    <div className="booking-container-card animate-fade-in transition-all duration-300 relative flex flex-col sm:flex-row justify-between gap-4">
      {/* Top Header Row: Route Title & Airline Logo */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {logoSrc && (
              <img
                src={logoSrc}
                alt={airline}
                className="h-8 object-contain shadow-2xs"
              />
            )}
            <h2 className="text-xl font-bold text-slate-950">
              {sourceInfo.city} &rarr; {destInfo.city}
            </h2>
          </div>
        </div>

        {/* Flight Meta Info */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
          <span>{dep.fullDateStr}</span>
          <span>&bull;</span>
          <span>{stopsStr}</span>
          <span>&bull;</span>
          <span>{durationStr}</span>
        </div>
      </div>

      {/* Baggage & In-Flight Services Section */}
      <BaggageAndMealsInfoCards
        checkedBaggageKg={baggageKg}
        handbagKg={handbagKg}
        mealIncluded={isMealInc}
        summary={true}
        title="Baggage & In-Flight Services"
        className="pt-4 border-t border-slate-200/80"
      />
    </div>
  );
}
