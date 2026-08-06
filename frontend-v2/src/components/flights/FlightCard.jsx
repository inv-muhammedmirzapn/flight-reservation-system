import React from "react";

export default function FlightCard({ flight, selectedCabinClass = "Economy", onViewDetails }) {
  if (!flight) return null;

  const {
    flight_number = "SA-224",
    airline = "Skyline Airways",
    source_airport = "DEL",
    destination_airport = "HAM",
    departure_time,
    arrival_time,
    base_fare = 500,
    available_seats = 0,
    stops = [],
    fares
  } = flight;

  // Determine active fare and availability for the selected cabin class
  const getFareForCabin = (cabin) => {
    if (!fares) return null;
    const norm = (cabin || "Economy").toUpperCase().replace(/\s+/g, "_");
    if (fares[norm]) return fares[norm];
    if (norm.includes("BUSINESS") && fares["BUSINESS"]) return fares["BUSINESS"];
    if (norm.includes("FIRST") && fares["FIRST"]) return fares["FIRST"];
    if (fares["ECONOMY"]) return fares["ECONOMY"];
    return null;
  };

  const activeFare = getFareForCabin(selectedCabinClass);
  const displayPrice = activeFare ? activeFare.price : base_fare;
  const activeSeats = activeFare ? activeFare.available_seats : available_seats;
  const isWaitlisted = activeSeats === 0;

  // Format Departure & Arrival Date and Time
  const formatDateTime = (isoString) => {
    if (!isoString) return { dateStr: "-", timeStr: "--:--" };
    const d = new Date(isoString);
    const day = d.getDate();
    const monthLong = d.toLocaleString("en-US", { month: "long" });
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return {
      dateStr: `${day} ${monthLong}`,
      timeStr: `${hours}:${minutes}`
    };
  };

  const depIso = departure_time || flight.scheduled_departure;
  const arrIso = arrival_time || flight.scheduled_arrival;

  const dep = formatDateTime(depIso);
  const arr = formatDateTime(arrIso);

  // Calculate Duration
  const calculateDuration = (dIso, aIso) => {
    if (!dIso || !aIso) return "0h 0m";
    const depMs = new Date(dIso).getTime();
    const arrMs = new Date(aIso).getTime();
    const diffMins = Math.max(0, Math.floor((arrMs - depMs) / (1000 * 60)));
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h ${m}m`;
  };

  const durationStr = calculateDuration(depIso, arrIso);

  // Calculate Stops Text
  const stopCount = Array.isArray(stops) ? stops.length : typeof stops === "number" ? stops : 0;
  const stopsStr = stopCount === 0 ? "Non-stop" : `${stopCount} Stop${stopCount > 1 ? "s" : ""}`;

  return (
    <div
      className={`w-full mx-auto rounded-3xl px-4 sm:px-5 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 transition-all mb-4 animate-fade-in ${
        isWaitlisted
          ? "bg-amber-50/80 border border-amber-200/80 shadow-2xs hover:shadow-xs hover:border-amber-300/90"
          : "plain-card shadow-2xs hover:shadow-xs"
      }`}
    >
      {/* 1. Airline & Flight Info */}
      <div className="flex flex-col items-center md:items-start min-w-[150px]">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold text-slate-500">
            {flight_number}
          </span>
          {isWaitlisted && (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
              Waitlist Only
            </span>
          )}
        </div>
        <span className="text-xs font-semibold text-slate-800">
          {airline}
        </span>
        <span className="text-xs font-bold text-slate-950 mt-1.5">
          {source_airport} &rarr; {destination_airport}
        </span>
      </div>

      {/* 2. Departure Time & Date */}
      <div className="flex-1 flex flex-col items-center md:items-start max-w-[20%]">
        <span className="text-xs font-semibold text-slate-700 mb-2">
          {dep.dateStr}
        </span>
        <span className="text-2xl sm:text-4xl font-bold text-slate-950 mt-0.5">
          {dep.timeStr}
        </span>
      </div>

      {/* 3. Arrival Time & Date */}
      <div className="flex-1 flex flex-col items-center md:items-start max-w-[20%]">
        <span className="text-xs font-semibold text-slate-700 mb-2">
          {arr.dateStr}
        </span>
        <span className="text-2xl sm:text-4xl font-bold text-slate-950 mt-0.5">
          {arr.timeStr}
        </span>
      </div>

      {/* 4. Center Box (Duration & Stops) */}
      <div
        className={`px-3 py-5 shadow-2xs flex flex-col items-center justify-center min-w-[10%] ${
          isWaitlisted ? "bg-amber-100/70" : "bg-[#f3f3f3]"
        }`}
      >
        <span className="material-symbols-outlined text-slate-900 text-lg select-none font-semibold">
          schedule
        </span>
        <span className="text-xs font-bold text-slate-950 mt-1 tracking-wide">
          {durationStr}
        </span>
        <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
          {stopsStr}
        </span>
      </div>

      {/* 5. Price & View Details Action */}
      <div className="flex flex-col items-end gap-1.5 min-w-[25%]">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          {selectedCabinClass}
        </span>
        <span className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-wide">
          ₹{Math.round(displayPrice)}
        </span>
        <button
          type="button"
          onClick={() => onViewDetails && onViewDetails(flight)}
          className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer btn-primary mt-0.5`}
        >
          View Details
        </button>
      </div>
    </div>
  );
}
