import React from "react";

export default function FareDetailsCard({ flight, passengerCount = 1, onBookingAction }) {
  if (!flight) return null;

  const { base_fare = 0, available_seats = 0 } = flight;
  const isWaitlisted = Number(available_seats) === 0;

  const unitFare = Number(base_fare) || 0;
  const totalBaseFare = Math.round(unitFare * passengerCount);
  const taxesAndOther = Math.round(totalBaseFare * 0.12);
  const grandTotal = totalBaseFare + taxesAndOther;

  return (
    <div className="booking-container-card w-full shadow-xs">
      <h3 className="text-xl font-extrabold text-slate-950 mb-6 tracking-tight">
        Fare Details
      </h3>

      {/* Breakdown Rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm font-medium text-slate-700">
          <span>Base Fare {passengerCount > 1 ? `(${passengerCount} passengers)` : ""}</span>
          <span className="font-bold text-slate-950">
            ₹ {totalBaseFare.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm font-medium text-slate-700">
          <span>Taxes and Other</span>
          <span className="font-bold text-slate-950">
            ₹ {taxesAndOther.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-300/80 my-5" />

      {/* Total Amount */}
      <div className="flex flex-col items-end gap-1">
        <span className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
          ₹ {grandTotal.toLocaleString("en-IN")}
        </span>
      </div>

      {/* Booking Action Button */}
      <button
        type="button"
        onClick={onBookingAction}
        className={`w-full mt-6 py-3.5 rounded-2xl font-extrabold text-xs uppercase tracking-wider cursor-pointer transition-all shadow-md active:scale-95 ${
          isWaitlisted
            ? "bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-amber-400/20"
            : "btn-primary text-slate-950"
        }`}
      >
        {isWaitlisted ? "Join Waitlist" : "Book Ticket"}
      </button>
    </div>
  );
}
