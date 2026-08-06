import React from "react";
import { getAirportInfo } from "@/utils/airportHelpers";

export default function FlightItinerarySummaryCard({ flight }) {
  if (!flight) return null;

  const {
    airline = "IndiGo",
    source_airport = "COK",
    destination_airport = "DEL",
    departure_time,
    arrival_time,
    stops = [],
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

  return (
    <div className="booking-container-card animate-fade-in transition-all duration-300 relative">
      {/* Top Header Row: Route Title & Airline Badge */}
      <div className="flex items-center gap-2 mb-2">
        {/* Airline Badge */}
        <div className="inline-flex items-center bg-sky-100/70 border border-sky-200/60 rounded-xl px-3 py-1.5">
          <span className="text-xs font-bold text-slate-900">{airline}</span>
        </div>

        <h2 className="text-xl font-bold text-slate-950">
          {sourceInfo.city} &rarr; {destInfo.city}
        </h2>
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
  );
}
