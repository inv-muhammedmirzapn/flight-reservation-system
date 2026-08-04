import React from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

export default function FareDetailsCard({ flight, selectedCabin = "ECONOMY", passengerCount = 1, onBookingAction }) {
  const navigate = useNavigate();
  const auth = useSelector((state) => state?.auth) || {};
  const isAuthenticated = Boolean(auth.isAuthenticated || auth.token);

  if (!flight) return null;

  const fareObj = flight.fares?.[selectedCabin];
  const unitFare = Math.round(fareObj ? Number(fareObj.price) : Number(flight.base_fare) || 0);
  const cabinAvailableSeats = fareObj?.available_seats ?? flight.available_seats;
  const isWaitlisted = Number(cabinAvailableSeats) === 0;

  const getCabinLabel = (cabin) => {
    const norm = (cabin || "ECONOMY").toUpperCase();
    if (norm.includes("BUSINESS")) return "Business Fare";
    if (norm.includes("FIRST")) return "First Class Fare";
    return "Economy Fare";
  };
  const cabinLabel = getCabinLabel(selectedCabin);

  const totalBaseFare = unitFare * passengerCount;
  const gstAmount = Math.round(totalBaseFare * 0.12);
  const grandTotal = totalBaseFare + gstAmount;

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
      <div className="flex flex-col gap-2 text-xs font-medium text-slate-700">
        <div className="flex items-center justify-between">
          <span>{cabinLabel}</span>
          <span className="text-slate-950">
            ₹ {unitFare.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>Passengers</span>
          <span className="text-slate-950">
            {passengerCount}
          </span>
        </div>

        <div className="flex items-center justify-between mt-4">
          <span>Total Fare</span>
          <span className="text-slate-950">
            ₹ {totalBaseFare.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>GST (12%)</span>
          <span className="text-slate-950">
            ₹ {gstAmount.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-300/80 my-5" />

      {/* Grand Total Amount */}
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs font-semibold text-slate-500">Grand Total</span>
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
