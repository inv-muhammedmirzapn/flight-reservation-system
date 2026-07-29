import React from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

export default function FareDetailsCard({ flight, passengerCount = 1, onBookingAction }) {
  const navigate = useNavigate();
  const auth = useSelector((state) => state?.auth) || {};
  const isAuthenticated = Boolean(auth.isAuthenticated || auth.token);

  if (!flight) return null;

  const { base_fare = 0, available_seats = 0 } = flight;
  const isWaitlisted = Number(available_seats) === 0;

  const unitFare = Number(base_fare) || 0;
  const totalBaseFare = Math.round(unitFare * passengerCount);
  const taxesAndOther = Math.round(totalBaseFare * 0.12);
  const grandTotal = totalBaseFare + taxesAndOther;

  const handleClick = () => {
    if (!isAuthenticated) {
      navigate("/login");
    } else {
      onBookingAction();
    }
  };

  const buttonText = !isAuthenticated
    ? isWaitlisted
      ? "Login to Join Waitlist"
      : "Login to Book Ticket"
    : isWaitlisted
    ? "Join Waitlist"
    : "Book Ticket";

  return (
    <div className="booking-container-card w-full shadow-xs animate-fade-in transition-all duration-300">
      <h3 className="text-xl font-bold text-slate-950 mb-6">
        Fare Details
      </h3>

      {/* Breakdown Rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-medium text-slate-700">
          <span>Base Fare {passengerCount > 1 ? `(${passengerCount} passengers)` : ""}</span>
          <span className="font-bold text-slate-950">
            ₹ {totalBaseFare.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs font-medium text-slate-700">
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
        <span className="text-2xl font-bold text-slate-950">
          ₹ {grandTotal.toLocaleString("en-IN")}
        </span>
      </div>

      {/* Booking Action Button */}
      <button
        type="button"
        onClick={handleClick}
        className={`w-full mt-6 p-2.5 text-base sm:text-lg rounded-2xl font-bold cursor-pointer transition-all duration-200 active:scale-95 btn-primary`}
      >
        {buttonText}
      </button>
    </div>
  );
}
