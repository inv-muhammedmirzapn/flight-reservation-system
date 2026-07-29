import React from "react";
import { getAirportInfo } from "@/utils/airportHelpers";

export default function FlightItineraryCard({ flight }) {
  if (!flight) return null;

  const {
    flight_number = "6E-2382",
    airline = "IndiGo",
    aircraft = "Airbus A320",
    source_airport = "COK",
    destination_airport = "DEL",
    departure_time,
    arrival_time,
    available_seats = 0,
    waitlist_count = 0,
    stops = []
  } = flight;

  const isWaitlisted = Number(available_seats) === 0;
  const queueCount = waitlist_count;

  const sourceInfo = getAirportInfo(source_airport);
  const destInfo = getAirportInfo(destination_airport);

  // Date and Time formatting
  const formatDateTime = (isoString) => {
    if (!isoString) return { dateStr: "-", timeStr: "--:--", fullDateStr: "-" };
    const d = new Date(isoString);
    const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    const dayNum = d.getDate();
    const monthShort = d.toLocaleString("en-US", { month: "short" });
    const dateStr = `${dayNum} ${monthShort}`;
    const fullDateStr = d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return { dateStr, timeStr, fullDateStr };
  };

  const dep = formatDateTime(departure_time);
  const arr = formatDateTime(arrival_time);

  // Duration calculation
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
  const stopCount = Array.isArray(stops) ? stops.length : typeof stops === "number" ? stops : 0;
  const stopsStr = stopCount === 0 ? "Non-stop" : `${stopCount} Stop${stopCount > 1 ? "s" : ""}`;

  return (
    <div className="booking-container-card animate-fade-in transition-all duration-300 relative">
      {/* Top Header Row: Route Title & Seat/Waitlist Status Badge */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <h2 className="text-xl font-bold text-slate-950">
          {sourceInfo.city} &rarr; {destInfo.city}
        </h2>

        {/* Status Badge on Top Right */}
        {isWaitlisted ? (
          <div className="absolute right-5 w-24 h-16 flex flex-col items-center gap-1.5 bg-amber-100/90 border border-amber-300/90 text-amber-950 px-3.5 py-1.5 rounded-2xl shadow-2xs font-bold text-xs">
            <span>Waitlist</span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-lg text-amber-800 font-bold select-none">
                people
              </span>
              <span className="font-bold text-lg">{queueCount}</span>
            </span>
          </div>
        ) : (
          <div className="absolute right-5 w-24 h-16 flex flex-col items-center gap-1.5 bg-emerald-100/90 border border-emerald-300/90 text-emerald-950 px-3.5 py-1.5 rounded-2xl shadow-2xs font-bold text-xs">
            <span>Available</span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-lg text-emerald-800 font-bold select-none">
                event_seat
              </span>
              <span className="font-bold text-lg">{available_seats}</span>
            </span>
          </div>
        )}
      </div>

      {/* Flight Meta Info */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 mb-5">
        <span>{dep.fullDateStr}</span>
        <span>&bull;</span>
        <span>{stopsStr}</span>
        <span>&bull;</span>
        <span>{durationStr}</span>
      </div>

      {/* Airline Badge */}
      <div className="inline-flex items-center gap-10 bg-sky-100/70 border border-sky-200/60 rounded-xl p-2 mb-8">
        <span className="text-xs font-bold text-slate-900">{airline}</span>
        <span className="inline-flex items-center gap-3">
          <span className="text-xs font-medium text-slate-600">
            {flight_number}
          </span>
          <span className="text-xs font-medium text-slate-600">
            {aircraft}
          </span>
        </span>
      </div>

      {/* Vertical Timeline Route Details Container */}
      <div className="relative space-y-4">
        {/* Departure Timeline Box */}
        <div className="timeline-card flex justify-between relative z-10 transition-all duration-300">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <span className="text-lg -mt-5 font-bold tracking-wide text-center text-slate-950 min-w-[60px]">
              {dep.timeStr}
            </span>

            {/* Yellow Circle Connector Node */}
            <div className="w-4 h-4 -mt-5 rounded-full bg-[#ffeb00] border border-slate-950 flex-shrink-0 relative z-20" />

            <div className="min-w-0 space-y-1">
              <h4 className="text-lg font-bold text-slate-950 truncate">
                {sourceInfo.city}
              </h4>
              <p className="text-xs text-slate-500 font-medium truncate">
                {source_airport}, {sourceInfo.name}
              </p>
            </div>
          </div>

          <span className="text-xs font-medium text-slate-950 whitespace-nowrap ml-2">
            {dep.dateStr}
          </span>
        </div>

        {/* Connecting Vertical Timeline Line */}
        <div className="absolute left-[78px] sm:left-[108px] top-[20px] bottom-[32px] w-[2px] bg-slate-300 z-0" />

        {/* Arrival Timeline Box */}
        <div className="timeline-card flex justify-between relative z-10 transition-all duration-300">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <span className="text-lg -mt-5 font-bold tracking-wide text-center text-slate-950 min-w-[60px]">
              {arr.timeStr}
            </span>

            {/* Yellow Circle Connector Node */}
            <div className="w-4 h-4 -mt-5 rounded-full bg-[#ffeb00] border border-slate-950 flex-shrink-0 relative z-20" />

            <div className="min-w-0 space-y-1">
              <h4 className="text-lg font-bold text-slate-950 truncate">
                {destInfo.city}
              </h4>
              <p className="text-xs text-slate-500 font-medium truncate">
                {destination_airport}, {destInfo.name}
              </p>
            </div>
          </div>

          <span className="text-xs font-medium text-slate-950 whitespace-nowrap ml-2">
            {arr.dateStr}
          </span>
        </div>
      </div>
    </div>
  );
}
