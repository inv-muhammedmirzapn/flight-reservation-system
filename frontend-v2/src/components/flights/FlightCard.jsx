import React from "react";

export default function FlightCard({ flight, onViewDetails }) {
  if (!flight) return null;

  const {
    flight_number = "SA-224",
    airline = "Skyline Airways",
    source_airport = "DEL",
    destination_airport = "HAM",
    departure_time,
    arrival_time,
    base_fare = 500,
    stops = []
  } = flight;

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

  const dep = formatDateTime(departure_time);
  const arr = formatDateTime(arrival_time);

  // Calculate Duration
  const calculateDuration = (depIso, arrIso) => {
    if (!depIso || !arrIso) return "0h 0m";
    const depMs = new Date(depIso).getTime();
    const arrMs = new Date(arrIso).getTime();
    const diffMins = Math.max(0, Math.floor((arrMs - depMs) / (1000 * 60)));
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h ${m}m`;
  };

  const durationStr = calculateDuration(departure_time, arrival_time);

  // Calculate Stops Text
  const stopCount = Array.isArray(stops) ? stops.length : typeof stops === "number" ? stops : 0;
  const stopsStr = stopCount === 0 ? "Non-stop" : `${stopCount} Stop${stopCount > 1 ? "s" : ""}`;

  return (
    <div className="w-full mx-auto plain-card rounded-3xl px-4 sm:px-5 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 shadow-2xs hover:shadow-xs transition-all mb-4 animate-fade-in">
      {/* 1. Airline & Flight Info */}
      <div className="flex flex-col items-center md:items-start min-w-[150px] py-3">
        <span className="text-xs font-semibold text-slate-500 mb-1">
          {flight_number}
        </span>
        <span className="text-xs font-semibold text-slate-800">
          {airline}
        </span>
        <span className="text-xs font-bold text-slate-950 mt-1.5">
          {source_airport} &rarr; {destination_airport}
        </span>
      </div>

      {/* 2. Departure Time & Date */}
      <div className="flex-1 flex flex-col items-center md:items-start max-w-[20%] py-3">
        <span className="text-xs font-semibold text-slate-700 mb-2">
          {dep.dateStr}
        </span>
        <span className="text-2xl sm:text-4xl font-bold text-slate-950 mt-0.5">
          {dep.timeStr}
        </span>
      </div>

      {/* 3. Arrival Time & Date */}
      <div className="flex-1 flex flex-col items-center md:items-start max-w-[20%] py-3">
        <span className="text-xs font-semibold text-slate-700 mb-2">
          {arr.dateStr}
        </span>
        <span className="text-2xl sm:text-4xl font-bold text-slate-950 mt-0.5">
          {arr.timeStr}
        </span>
      </div>

      {/* 4. White Center Box (Duration & Stops) */}
      <div className="bg-[#f3f3f3] px-3 py-5 shadow-2xs flex flex-col items-center justify-center min-w-[10%]">
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
      <div className="flex flex-col items-end gap-2 py-5 min-w-[25%]">
        <span className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-wide">
          ₹{Math.round(base_fare)}
        </span>
        <button
          type="button"
          onClick={() => onViewDetails && onViewDetails(flight)}
          className="btn-primary px-3 py-1 text-xs rounded-lg"
        >
          View Details
        </button>
      </div>
    </div>
  );
}
