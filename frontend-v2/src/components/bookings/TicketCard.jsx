import React from "react";
import { useNavigate } from "react-router-dom";

export default function TicketCard({ item, isPastView = false }) {
  const navigate = useNavigate();

  if (!item) return null;

  const isWaitlist = item.itemType === "WAITLIST" || Boolean(item.queue_position !== undefined && item.queue_position !== null);
  const flight = item.flight_detail || item.flight || {};

  // Formats timestamp for black top header: e.g. 08:57 on 10th July, 2026
  const formatHeaderTimestamp = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    const day = d.getDate();
    
    const getOrdinal = (n) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    
    const month = d.toLocaleString("en-US", { month: "long" });
    const year = d.getFullYear();
    return `${hours}:${mins} on ${getOrdinal(day)} ${month}, ${year}`;
  };

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

  const calculateDuration = (depIso, arrIso) => {
    if (!depIso || !arrIso) return "0h 0m";
    const depMs = new Date(depIso).getTime();
    const arrMs = new Date(arrIso).getTime();
    const diffMins = Math.max(0, Math.floor((arrMs - depMs) / (1000 * 60)));
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h ${m}m`;
  };

  const shortId = item.id ? String(item.id).slice(0, 8).toUpperCase() : "523A6FE6";
  const headerTime = formatHeaderTimestamp(item.created_at);

  const dep = formatDateTime(flight.departure_time);
  const arr = formatDateTime(flight.arrival_time);

  const durationStr = calculateDuration(flight.departure_time, flight.arrival_time);

  const stops = flight.stops;
  const stopCount = Array.isArray(stops) ? stops.length : typeof stops === "number" ? stops : 0;
  const stopsStr = stopCount === 0 ? "Non-stop" : `${stopCount} Stop${stopCount > 1 ? "s" : ""}`;

  const passengerCount = item.passengers?.length || item.seat_count || 1;

  // Flight Status Badge
  const flightStatus = (flight.status || "SCHEDULED").toUpperCase();
  const getFlightStatusBadge = () => {
    if (flightStatus === "DELAYED") {
      return (
        <span className="bg-amber-400 text-amber-950 px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5">
          Delayed
          <span className="material-symbols-outlined text-sm">schedule</span>
        </span>
      );
    }
    if (flightStatus === "CANCELLED") {
      return (
        <span className="bg-rose-400 text-rose-950 px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5">
          Cancelled
          <span className="material-symbols-outlined text-sm">cancel</span>
        </span>
      );
    }
    // Default: On time / Scheduled
    return (
      <span className="bg-[#7ce47a] text-slate-950 px-2 py-1 rounded-xl text-[10px] font-semibold flex items-center gap-1.5">
        On time
        <span className="material-symbols-outlined text-sm">flight</span>
      </span>
    );
  };

  // Ticket Status Badge
  const ticketStatus = (item.status || "CONFIRMED").toUpperCase();
  const getTicketStatusBadge = () => {
    if (ticketStatus === "EXPIRED") {
      return (
        <span className="bg-slate-200 text-slate-700 border border-slate-300 px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5">
          Expired
          <span className="material-symbols-outlined text-sm">hourglass_disabled</span>
        </span>
      );
    }

    if (ticketStatus === "CANCELLED") {
      return (
        <span className="bg-rose-100 text-rose-950 border border-rose-300 px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5">
          Cancelled
          <span className="material-symbols-outlined text-sm">cancel</span>
        </span>
      );
    }

    if (isWaitlist) {
      return (
        <span className="bg-amber-100 text-amber-950 border border-amber-300 px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5">
          {item.queue_position ? `WL #${item.queue_position}` : "Waitlisted"}
          <span className="material-symbols-outlined text-sm">hourglass_top</span>
        </span>
      );
    }

    // Confirmed
    return (
      <span className="bg-white text-slate-950 border border-slate-300/80 px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5">
        Confirmed
        <span className="material-symbols-outlined text-sm">check_circle</span>
      </span>
    );
  };

  const handleCardClick = () => {
    if (isWaitlist) {
      navigate(`/my-bookings/ticket/waitlist/${item.id}`, {
        state: { waitlist: item, flight, showPastBookings: isPastView }
      });
    } else {
      navigate(`/my-bookings/ticket/${item.id}`, {
        state: { booking: item, flight, showPastBookings: isPastView }
      });
    }
  };

  return (
    <div className="group animate-fade-in shadow-2xs hover:shadow-xs">
      {/* Top Black Header Bar */}
      <div className="rounded-t-3xl mx-auto bg-slate-950 text-white px-5 pt-2 pb-7 flex items-center justify-between text-[10px] font-semibold tracking-wide">
        <span className="text-slate-200">
          {isWaitlist ? "Waitlist ID" : "Booking ID"} #{shortId}
        </span>
        <span className="text-slate-300 font-medium">Booked at {headerTime}</span>
      </div>

      <div
        onClick={handleCardClick}
        className={`w-full rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer -mt-5 ${
          isWaitlist
            ? "bg-amber-50 border border-amber-200/80 hover:border-amber-300/90"
            : "plain-card border border-slate-200/70"
        }`}
      >
        {/* Main Card Content (Styled like FlightCard.jsx) */}
        <div className="px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
          {/* 1. Airline & Flight Info */}
          <div className="flex flex-col items-center md:items-start min-w-[120px]">
            <span className="text-xs font-semibold text-slate-500 mb-0.5">
              {flight.flight_number || "SA-224"}
            </span>
            <span className="text-xs font-semibold text-slate-800 truncate">
              {flight.airline || "Skyline Airways"}
            </span>
            <span className="text-xs font-bold text-slate-950 mt-1.5">
              {flight.source_airport} &rarr; {flight.destination_airport}
            </span>
          </div>

          {/* 2. Departure Time & Date */}
          <div className="flex-1 flex flex-col items-center md:items-start max-w-[20%]">
            <span className="text-xs font-semibold text-slate-700 mb-1">
              {dep.dateStr}
            </span>
            <span className="text-2xl sm:text-4xl font-bold text-slate-950">
              {dep.timeStr}
            </span>
          </div>

          {/* 3. Arrival Time & Date */}
          <div className="flex-1 flex flex-col items-center md:items-start max-w-[20%]">
            <span className="text-xs font-semibold text-slate-700 mb-1">
              {arr.dateStr}
            </span>
            <span className="text-2xl sm:text-4xl font-bold text-slate-950">
              {arr.timeStr}
            </span>
          </div>

          {/* 4. Center Box (Duration & Stops) */}
          <div
            className={`px-4 py-3 sm:py-4 shadow-2xs flex flex-col items-center justify-center min-w-[12%] ${
              isWaitlist ? "bg-amber-100/70" : "bg-[#f3f3f3]"
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

          {/* 5. Passenger Count & Double Status Badges */}
          <div className="flex items-center justify-between md:justify-end gap-5 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-200/80">
            {/* Passenger count */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <span className="material-symbols-outlined text-base text-slate-700">person</span>
              <span>{passengerCount}</span>
            </div>

            {/* Double Badges */}
            <div className="flex flex-col items-end gap-1.5">
              {getFlightStatusBadge()}
              {getTicketStatusBadge()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
