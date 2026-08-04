import React from "react";
import FlightItineraryCard from "@/components/flights/FlightItineraryCard";

export default function TicketInvoice({ detailData, isWaitlist = false, locationStateFlight = null, locationStatePassengers = null }) {
  if (!detailData) return null;

  const flight = detailData?.flight_detail || detailData?.flight || locationStateFlight || {};
  const passengers = detailData?.passengers || locationStatePassengers || [];
  const cabinClass = (detailData?.cabin_class || "ECONOMY").toUpperCase();

  const cabinLabelMap = {
    ECONOMY: "Economy",
    BUSINESS: "Business",
    FIRST: "First Class"
  };

  const grandTotal = Number(detailData?.total_price || detailData?.price || 0);
  const seatCount = detailData?.seat_count || passengers.length || 1;
  const basePriceCalc = grandTotal > 0 ? Math.round(grandTotal / 1.12) : 0;
  const taxesCalc = grandTotal - basePriceCalc;

  const ticketStatus = (detailData?.status || "CONFIRMED").toUpperCase();

  const getTicketStatusBadge = () => {
    if (ticketStatus === "EXPIRED") {
      return (
        <span className="bg-slate-200 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
          Expired
          <span className="material-symbols-outlined text-sm">hourglass_disabled</span>
        </span>
      );
    }

    if (ticketStatus === "CANCELLED") {
      return (
        <span className="bg-rose-100 border border-rose-300 text-rose-950 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
          Cancelled
          <span className="material-symbols-outlined text-sm">cancel</span>
        </span>
      );
    }

    if (isWaitlist) {
      return (
        <span className="bg-amber-100 border border-amber-300 text-amber-950 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
          {detailData?.queue_position ? `Waitlisted #${detailData.queue_position}` : "Waitlisted"}
          <span className="material-symbols-outlined text-sm">hourglass_top</span>
        </span>
      );
    }

    return (
      <span className="bg-emerald-100 border border-emerald-300 text-emerald-950 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
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
          <span className="text-sm font-bold text-slate-950">
            #{detailData?.id ? String(detailData.id).slice(0, 8).toUpperCase() : "BK-893041"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-slate-100 border border-slate-200 text-slate-800 px-3 py-1 rounded-xl text-xs font-bold">
            {cabinLabelMap[cabinClass] || cabinClass}
          </span>
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
              <div key={idx} className="timeline-card flex items-center justify-between font-medium">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-400 text-xl">
                    person
                  </span>
                  <div>
                    <p className="font-bold text-slate-950 text-sm">{p.name || p.full_name || `Passenger ${idx + 1}`}</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">{p.gender === "F" ? "Female" : p.gender === "M" ? "Male" : p.gender || "Passenger"}, {p.age} yrs</p>
                  </div>
                </div>

                {p.seat_number && (
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                    Seat {p.seat_number}
                  </span>
                )}
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
          <span className="font-bold text-slate-950">₹ {basePriceCalc.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-600 font-medium pb-3">
          <span>Taxes & Service Charges (12%)</span>
          <span className="font-bold text-slate-950">₹ {taxesCalc.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between text-base font-extrabold text-slate-950 pt-3 border-t border-slate-200/80">
          <span>Total Amount</span>
          <span>₹ {grandTotal.toLocaleString("en-IN")}</span>
        </div>
      </div>
    </div>
  );
}
