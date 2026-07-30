import React from "react";
import FlightItineraryCard from "@/components/flights/FlightItineraryCard";

export default function TicketInvoice({ detailData, isWaitlist = false, locationStateFlight = null, locationStatePassengers = null }) {
  if (!detailData) return null;

  const flight = detailData?.flight_detail || detailData?.flight || locationStateFlight || {};
  const passengers = detailData?.passengers || locationStatePassengers || [];

  const unitFare = Number(flight.base_fare) || 0;
  const seatCount = detailData?.seat_count || passengers.length || 1;
  const totalBaseFare = Math.round(unitFare * seatCount);
  const taxesAndOther = Math.round(totalBaseFare * 0.12);
  const grandTotal = detailData?.total_price || detailData?.price || (totalBaseFare + taxesAndOther);

  const ticketStatus = (detailData?.status || "CONFIRMED").toUpperCase();

  const getTicketStatusBadge = () => {
    if (ticketStatus === "EXPIRED") {
      return (
        <span className="bg-slate-200 border border-slate-300 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
          Expired
          <span className="material-symbols-outlined text-sm">hourglass_disabled</span>
        </span>
      );
    }

    if (ticketStatus === "CANCELLED") {
      return (
        <span className="bg-rose-100 border border-rose-300 text-rose-950 px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
          Cancelled
          <span className="material-symbols-outlined text-sm">cancel</span>
        </span>
      );
    }

    if (isWaitlist) {
      return (
        <span className="bg-amber-100 border border-amber-300 text-amber-950 px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
          {detailData?.queue_position ? `Waitlisted #${detailData.queue_position}` : "Waitlisted"}
          <span className="material-symbols-outlined text-sm">hourglass_top</span>
        </span>
      );
    }

    return (
      <span className="bg-emerald-100 border border-emerald-300 text-emerald-950 px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
        Confirmed
        <span className="material-symbols-outlined text-sm">check_circle</span>
      </span>
    );
  };

  return (
    <div className="booking-container-card w-full space-y-6 shadow-xs text-slate-900 animate-fade-in">
      {/* Invoice Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mx-5 border-b border-slate-300/80">
        <div>
          <span className="text-xs font-bold text-slate-500 tracking-wide block">
            {isWaitlist ? "Waitlist ID" : "Booking ID"}
          </span>
          <span className="text-xs font-bold text-slate-950">
            #{detailData?.id ? String(detailData.id).slice(0, 8).toUpperCase() : "BK-893041"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {getTicketStatusBadge()}
        </div>
      </div>

      {/* Reused Flight Itinerary Card */}
      <FlightItineraryCard flight={flight} showBadge={false} />

      {/* Passenger List Box (Reuses timeline-card) */}
      <div className="px-5 pb-5 space-y-3">
        <h4 className="text-xs font-bold text-slate-500 tracking-wide mb-5">
          Passenger Details ({passengers.length || seatCount})
        </h4>
        <div className="flex flex-col gap-3">
          {passengers.length > 0 ? (
            passengers.map((p, idx) => (
              <div key={idx} className="timeline-card flex items-top gap-5 font-medium">
                <span className="material-symbols-outlined text-slate-400 -mt-1 text-lg">
                  person
                </span>
                <div>
                  <p className="font-bold text-slate-950 text-sm">{p.name || `Passenger ${idx + 1}`}</p>
                  <p className="text-slate-500 text-[10px] mt-2">{p.gender}, {p.age} yrs</p>
                </div>
              </div>
            ))
          ) : (
            <div className="timeline-card p-3 text-xs font-medium text-slate-600">
              {seatCount} Passenger(s)
            </div>
          )}
        </div>
      </div>

      {/* Fare Summary Breakdown (Reuses timeline-card) */}
      <div className="px-5 pb-5 space-y-3">
        <h4 className="text-xs font-bold text-slate-500 tracking-wider mb-6">
          Payment Summary
        </h4>
        <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
          <span>Base Fare ({seatCount} seat{seatCount > 1 ? "s" : ""})</span>
          <span className="font-bold text-slate-950">₹ {totalBaseFare.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-600 font-medium pb-3">
          <span>Taxes & Service Charges</span>
          <span className="font-bold text-slate-950">₹ {taxesAndOther.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between text-base font-extrabold text-slate-950 pt-3 border-t border-slate-200/80">
          <span>Total Paid</span>
          <span>₹ {Number(grandTotal).toLocaleString("en-IN")}</span>
        </div>
      </div>
    </div>
  );
}
