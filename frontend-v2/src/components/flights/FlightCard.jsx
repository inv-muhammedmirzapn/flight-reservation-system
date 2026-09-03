import { useDispatch, useSelector } from "react-redux";
import { addToComparison, removeFromComparison } from "@/store/comparisonSlice";
import FlightBaggageMealIndicators from "./FlightBaggageMealIndicators";
import { formatCurrency as fmtCurr } from "@/utils/formatters";


export default function FlightCard({ flight, selectedCabinClass = "Economy", onViewDetails, optimizationBadge = null, isHighlighted = false, compareMode = false }) {
  const dispatch = useDispatch();
  const selectedIds = useSelector((state) => state.comparison.selectedIds);
  const isSelectedForCompare = selectedIds.includes(flight?.id);

  if (!flight) return null;

  const {
    flight_number = "SA-224",
    airline = "Skyline Airways",
    airline_logo,
    source_airport = "DEL",
    destination_airport = "HAM",
    departure_time,
    arrival_time,
    base_fare = 500,
    available_seats = 0,
    stops = [],
    fares,
    status,
    delay_minutes = 0,
    delayed_departure_time,
    delayed_arrival_time,
    booking_cutoff_passed = false,
  } = flight;

  const isDelayed = status === "DELAYED" && delay_minutes > 0;

  const getFareForCabin = (cabin) => {
    if (!fares) return null;
    const norm = (cabin || "Economy").toUpperCase().replace(/\s+/g, "_");
    if (fares[norm]) return fares[norm];
    if (norm.includes("BUSINESS") && fares["BUSINESS"]) return fares["BUSINESS"];
    if (norm.includes("FIRST") && fares["FIRST"]) return fares["FIRST"];
    if (norm.includes("ECONOMY") && fares["ECONOMY"]) return fares["ECONOMY"];
    return null;
  };

  const activeFare = getFareForCabin(selectedCabinClass);

  if (!activeFare && fares && Object.keys(fares).length > 0) {
    return null;
  }

  const displayPrice = activeFare ? (activeFare.display_price || activeFare.price) : base_fare;
  const displayCurrency = activeFare?.display_currency || "INR";
  const activeSeats = activeFare ? activeFare.available_seats : available_seats;
  const isWaitlisted = activeSeats === 0;

  const formatCurrency = (amount) => fmtCurr(amount, displayCurrency);

  const checkedBaggageKg =
    activeFare?.effective_baggage_allowance_kg ??
    activeFare?.baggage_allowance ??
    flight.baggage_weight_allowed_per_person ??
    20;

  const handbagKg =
    activeFare?.effective_handbag_allowance_kg ??
    activeFare?.handbag_allowance ??
    flight.handbag_weight_allowed_per_person ??
    7;

  const isMealIncluded = Boolean(
    activeFare?.meal_included ??
      flight.meal_included ??
      Object.values(fares || {}).some((f) => f?.meal_included)
  );

  const formatDateTime = (isoString) => {
    if (!isoString) return { dateStr: "-", timeStr: "--:--" };
    const d = new Date(isoString);
    const day = d.getDate();
    const monthLong = d.toLocaleString("en-US", { month: "short" });
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return { dateStr: `${day} ${monthLong}`, timeStr: `${hours}:${minutes}` };
  };

  const depIso = departure_time || flight.scheduled_departure;
  const arrIso = arrival_time || flight.scheduled_arrival;

  const dep = formatDateTime(depIso);
  const arr = formatDateTime(arrIso);
  const delayedDep = isDelayed && delayed_departure_time ? formatDateTime(delayed_departure_time) : null;
  const delayedArr = isDelayed && delayed_arrival_time ? formatDateTime(delayed_arrival_time) : null;

  const calculateDuration = (dIso, aIso) => {
    if (!dIso || !aIso) return "0h 0m";
    const diffMins = Math.max(0, Math.floor((new Date(aIso) - new Date(dIso)) / 60000));
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
  };

  const durationStr = calculateDuration(depIso, arrIso);
  const stopCount = Array.isArray(stops) ? stops.length : typeof stops === "number" ? stops : 0;
  const stopsStr = stopCount === 0 ? "Non-stop" : `${stopCount} Stop${stopCount > 1 ? "s" : ""}`;

  const cardClass = isWaitlisted
    ? `bg-amber-50/80 border border-amber-200/80 shadow-sm hover:shadow${isHighlighted ? " ring-2 ring-slate-900" : ""}`
    : `plain-card shadow-sm hover:shadow${isHighlighted ? " ring-2 ring-slate-900" : ""}`;

  const getLogoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `http://127.0.0.1:8000${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const logoSrc = getLogoUrl(airline_logo);

  return (
    <div className={`w-full mx-auto rounded-2xl md:rounded-3xl p-4 sm:p-5 transition-all mb-4 animate-fade-in ${cardClass}`}>

      {/* ── DESKTOP & TABLET LAYOUT (visible on md: grid) ────────────────────────── */}
      <div className="hidden md:grid md:grid-cols-12 items-center gap-4">

        {/* 1. Airline & Flight Info */}
        <div className="col-span-2 flex flex-col justify-center gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500">{flight_number}</span>
            {isDelayed && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
                Delayed · +{delay_minutes}m
              </span>
            )}
            {!isDelayed && isWaitlisted && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">Waitlist</span>
            )}
            {optimizationBadge && (() => {
              const badges = optimizationBadge === "Cheapest+Fastest"
                ? [["Cheapest", "sell"], ["Fastest", "bolt"]]
                : [[optimizationBadge, {
                    "Cheapest": "sell",
                    "Fastest": "bolt",
                    "Direct": "flight_takeoff",
                    "Fewest Stops": "commit",
                    "Shortest": "route",
                    "Shortest Distance": "route",
                  }[optimizationBadge] || "star"]];
              return (
                <span className="inline-flex items-center gap-1">
                  {badges.map(([label, icon]) => (
                    <span key={label} className="inline-flex items-center gap-1 text-[9px] font-extrabold text-slate-900 bg-white border border-slate-200 px-2 py-1 rounded-lg tracking-wide shadow-sm">
                      <span className="material-symbols-outlined" style={{ fontSize: "11px", lineHeight: 1, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                      {label}
                    </span>
                  ))}
                </span>
              );
            })()}
          </div>
          <div className="flex items-center gap-2">
            {logoSrc && (
              <img
                src={logoSrc}
                alt={airline}
                className="h-4 max-w-[80px] object-contain"
              />
            )}
            <span className="text-xs font-semibold text-slate-800 truncate">{airline}</span>
          </div>
          <span className="text-xs font-extrabold text-slate-950">
            {source_airport} &rarr; {destination_airport}
          </span>
        </div>

        {/* 2. Departure */}
        <div className="col-span-2 flex flex-col items-start">
          <span className="text-xs font-semibold text-slate-500 mb-0.5">
            {isDelayed && delayedDep ? delayedDep.dateStr : dep.dateStr}
          </span>
          {isDelayed && delayedDep ? (
            <div className="flex flex-col items-start leading-none">
              <span className="text-xs font-medium text-slate-400 line-through">{dep.timeStr}</span>
              <span className="text-2xl lg:text-3xl font-bold text-amber-700 mt-0.5">{delayedDep.timeStr}</span>
            </div>
          ) : (
            <span className="text-2xl lg:text-3xl font-bold text-slate-950">{dep.timeStr}</span>
          )}
        </div>

        {/* 3. Arrival */}
        <div className="col-span-2 flex flex-col items-start">
          <span className="text-xs font-semibold text-slate-500 mb-0.5">
            {isDelayed && delayedArr ? delayedArr.dateStr : arr.dateStr}
          </span>
          {isDelayed && delayedArr ? (
            <div className="flex flex-col items-start leading-none">
              <span className="text-xs font-medium text-slate-400 line-through">{arr.timeStr}</span>
              <span className="text-2xl lg:text-3xl font-bold text-amber-700 mt-0.5">{delayedArr.timeStr}</span>
            </div>
          ) : (
            <span className="text-2xl lg:text-3xl font-bold text-slate-950">{arr.timeStr}</span>
          )}
        </div>

        {/* 4. Duration & Stops */}
        <div className="col-span-2 flex flex-col items-center justify-center p-3 rounded-2xl bg-black/5 text-center">
          <span className="material-symbols-outlined text-slate-700 text-lg select-none">schedule</span>
          <span className="text-xs font-bold text-slate-900 mt-0.5 tracking-wide">{durationStr}</span>
          <span className="text-[10px] font-semibold text-slate-500">{stopsStr}</span>
        </div>

        {/* 5. Baggage & Meal Indicators (Flex Column to the right of Duration & Stops) */}
        <div className="col-span-2 flex flex-col justify-center items-start border-l border-slate-200/60 pl-3 md:pl-4">
          <FlightBaggageMealIndicators
            checkedBaggageKg={checkedBaggageKg}
            handbagKg={handbagKg}
            isMealIncluded={isMealIncluded}
            vertical={true}
          />
        </div>

        {/* 6. Price & CTA */}
        <div className="col-span-2 flex flex-col items-end justify-center gap-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{selectedCabinClass}</span>
          <span className="text-2xl lg:text-3xl font-extrabold text-slate-950 tracking-wide">
            {formatCurrency(Math.round(displayPrice))}
          </span>
          {booking_cutoff_passed ? (
            <span className="text-xs font-semibold text-rose-600 border border-rose-200 bg-rose-50 px-3 py-1 rounded-lg">
              Booking Closed
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onViewDetails && onViewDetails(flight)}
              className="px-4 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer btn-primary mt-0.5 shadow-sm"
            >
              View Details
            </button>
          )}

          {/* Compare Button — only visible in compare mode and if booking is open */}
          {compareMode && !booking_cutoff_passed && (
            <button
              type="button"
              onClick={() => {
                if (isSelectedForCompare) {
                  dispatch(removeFromComparison(flight.id));
                } else {
                  dispatch(addToComparison(flight.id));
                }
              }}
              disabled={!isSelectedForCompare && selectedIds.length >= 4}
              className={`w-full px-3 py-1 text-[10px] rounded-xl font-bold transition-all cursor-pointer border mt-1
                ${isSelectedForCompare
                  ? "bg-slate-900 text-white border-slate-900"
                  : selectedIds.length >= 4
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    : "bg-white text-slate-700 border-slate-300 hover:border-slate-900 hover:bg-slate-50"
                }`}
            >
              {isSelectedForCompare ? "✓ Added" : "+ Compare"}
            </button>
          )}
        </div>

      </div>


      {/* ── MOBILE LAYOUT (visible on small screens, hidden on md:) ────────────── */}
      <div className="flex md:hidden flex-col gap-3">

        {/* Top Bar: Airline info & Status Badges */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {logoSrc && (
              <img
                src={logoSrc}
                alt={airline}
                className="h-4 max-w-[60px] object-contain shrink-0"
              />
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-900 truncate">{airline}</span>
              <span className="text-[10px] font-semibold text-slate-500">{flight_number}</span>
              {optimizationBadge && (() => {
                const badges = optimizationBadge === "Cheapest+Fastest"
                  ? [["Cheapest", "sell"], ["Fastest", "bolt"]]
                  : [[optimizationBadge, {
                      "Cheapest": "sell",
                      "Fastest": "bolt",
                      "Direct": "flight_takeoff",
                      "Fewest Stops": "commit",
                      "Shortest": "route",
                      "Shortest Distance": "route",
                    }[optimizationBadge] || "star"]];
                return (
                  <span className="inline-flex items-center gap-1 mt-1 self-start">
                    {badges.map(([label, icon]) => (
                      <span key={label} className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-slate-900 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md tracking-wide shadow-sm">
                        <span className="material-symbols-outlined" style={{ fontSize: "9px", lineHeight: 1, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                        {label}
                      </span>
                    ))}
                  </span>
                );
              })()}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md uppercase">
              {selectedCabinClass}
            </span>
            {isDelayed && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
                +{delay_minutes}m
              </span>
            )}
            {!isDelayed && isWaitlisted && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">Waitlist</span>
            )}
          </div>
        </div>

        {/* Flight Schedule & Route Line */}
        <div className="flex items-center justify-between gap-2 py-1">
          {/* Departure */}
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-slate-400">{source_airport}</span>
            <span className="text-xl font-bold text-slate-900 leading-tight">
              {isDelayed && delayedDep ? delayedDep.timeStr : dep.timeStr}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
              {isDelayed && delayedDep ? delayedDep.dateStr : dep.dateStr}
            </span>
          </div>

          {/* Center Graphic / Duration */}
          <div className="flex-1 flex flex-col items-center px-2">
            <span className="text-[10px] font-bold text-slate-600">{durationStr}</span>
            <div className="w-full flex items-center gap-1 my-1">
              <div className="h-[2px] flex-1 bg-slate-200" />
              <span className="material-symbols-outlined text-slate-400 text-xs select-none rotate-90">flight</span>
              <div className="h-[2px] flex-1 bg-slate-200" />
            </div>
            <span className="text-[9px] font-semibold text-slate-400">{stopsStr}</span>
          </div>

          {/* Arrival */}
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-bold text-slate-400">{destination_airport}</span>
            <span className="text-xl font-bold text-slate-900 leading-tight">
              {isDelayed && delayedArr ? delayedArr.timeStr : arr.timeStr}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
              {isDelayed && delayedArr ? delayedArr.dateStr : arr.dateStr}
            </span>
          </div>
        </div>

        {/* Mobile Subtle Indicators */}
        <FlightBaggageMealIndicators
          checkedBaggageKg={checkedBaggageKg}
          handbagKg={handbagKg}
          isMealIncluded={isMealIncluded}
          compact={true}
          className="justify-start py-0.5"
        />

        {/* Bottom Bar: Price & CTA */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block select-none">Total Fare</span>
            <span className="text-xl font-extrabold text-slate-950">{formatCurrency(Math.round(displayPrice))}</span>
          </div>

          {booking_cutoff_passed ? (
            <span className="text-xs font-semibold text-rose-600 border border-rose-200 bg-rose-50 px-3 py-1 rounded-lg">
              Booking Closed
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onViewDetails && onViewDetails(flight)}
              className="px-4 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer btn-primary shadow-sm"
            >
              View Details
            </button>
          )}
        </div>

        {/* Compare Button — mobile, only visible in compare mode and if booking is open */}
        {compareMode && !booking_cutoff_passed && (
          <button
            type="button"
            onClick={() => {
              if (isSelectedForCompare) {
                dispatch(removeFromComparison(flight.id));
              } else {
                dispatch(addToComparison(flight.id));
              }
            }}
            disabled={!isSelectedForCompare && selectedIds.length >= 4}
            className={`w-full px-3 py-1.5 text-[10px] rounded-xl font-bold transition-all cursor-pointer border
              ${isSelectedForCompare
                ? "bg-slate-900 text-white border-slate-900"
                : selectedIds.length >= 4
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-white text-slate-700 border-slate-300 hover:border-slate-900 hover:bg-slate-50"
              }`}
          >
            {isSelectedForCompare ? "✓ Added to Compare" : "+ Compare"}
          </button>
        )}

      </div>

    </div>
  );
}
