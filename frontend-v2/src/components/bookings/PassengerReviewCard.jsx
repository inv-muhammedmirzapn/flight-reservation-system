import React from "react";
import { formatCurrency as fmtCurr } from "@/utils/formatters";

export default function PassengerReviewCard({
  index,
  passenger,
  selectedSeat = null,
  isMealIncluded = false,
  compPref = "NONE",
  compMealItem = null,
  paidMeals = [],
  extraBaggagePricePerKg = 0,
  currency = "INR",
}) {
  const getSeatPositionLabel = (seat) => {
    if (!seat || typeof seat !== "object") return "";
    if (seat.extra_legroom) return "Extra Legroom";
    if (seat.exit_row) return "Exit Row";
    const pos = seat.position || seat.seat_position || "";
    if (!pos) return "";
    return pos.charAt(0).toUpperCase() + pos.slice(1).toLowerCase();
  };

  const seatNum =
    typeof selectedSeat === "string"
      ? selectedSeat
      : selectedSeat?.seat_number || passenger?.seat_number || "";

  const seatPosLabel =
    typeof selectedSeat === "object" && selectedSeat
      ? getSeatPositionLabel(selectedSeat)
      : "";

  const seatDisplay = seatNum
    ? `Seat ${seatNum}${seatPosLabel ? ` (${seatPosLabel})` : ""}`
    : null;

  const compMealText =
    compPref === "NONE"
      ? null
      : compMealItem?.name
        ? compMealItem.name
        : compPref === "NON_VEG"
          ? "Non-Veg Meal Box"
          : "Veg Meal Box";

  const genderRaw = (passenger?.gender || "").toUpperCase();
  const genderLabel =
    genderRaw === "F" || genderRaw === "FEMALE"
      ? "Female"
      : genderRaw === "M" || genderRaw === "MALE"
        ? "Male"
        : genderRaw === "O" || genderRaw === "OTHER"
          ? "Other"
          : "Passenger";

  const ageLabel = passenger?.age ? `${passenger.age} yrs` : null;
  const phoneLabel = passenger?.phone_number?.trim() ? passenger.phone_number.trim() : null;
  const passengerMeta = [genderLabel, ageLabel, phoneLabel].filter(Boolean).join(" • ");

  const extraBaggageKg = Math.max(0, parseInt(passenger?.extra_baggage_kg || 0, 10));
  const extraBaggageCost = extraBaggageKg * extraBaggagePricePerKg;
  const seatFee = Number(selectedSeat?.display_seat_fee || selectedSeat?.seat_fee || 0);

  const hasItems = compMealText || paidMeals.length > 0 || extraBaggageKg > 0 || seatFee > 0;

  const formatCurrency = (amount) => fmtCurr(amount, currency);

  return (
    <div className="plain-card p-4 rounded-2xl transition-all duration-200 hover:border-slate-200">
      {/* Passenger Info Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
            {index + 1}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-950">
              {passenger?.name?.trim() ? passenger.name.trim() : `Passenger ${index + 1}`}
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              {passengerMeta}
            </p>
          </div>
        </div>

        {/* Seat Badge (Only shown if a seat was selected) */}
        {seatDisplay && (
          <span className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
            <span className="material-symbols-outlined text-sm text-slate-600">event_seat</span>
            <span>{seatDisplay}</span>
          </span>
        )}
      </div>

      {/* Bill / Receipt Itemized List */}
      {hasItems && (
        <div className="receipt-container">
          {/* Seat Selection Fee Row if applicable */}
          {seatFee > 0 && (
            <div className="receipt-row receipt-row-muted">
              <div className="receipt-item-label">
                <span className="material-symbols-outlined text-sm text-blue-600">
                  event_seat
                </span>
                <span>Seat {seatNum} Selection ({seatPosLabel || "Reserved"})</span>
              </div>
              <div className="receipt-item-price">
                {formatCurrency(seatFee)}
              </div>
            </div>
          )}

          {/* Complimentary Meal Item Row */}
          {compMealText && (
            <div className="receipt-row receipt-row-muted">
              <div className="receipt-item-label">
                <span className="material-symbols-outlined text-sm text-emerald-600">
                  restaurant
                </span>
                <span>{compMealText}</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200/80">
                Included
              </span>
            </div>
          )}

          {/* Paid Add-ons Itemized List */}
          {paidMeals.map((item, mIdx) => {
            const qty = item.quantity || 1;
            const itemPrice = Number(item.display_price || item.price || 0);
            const subtotal = itemPrice * qty;

            return (
              <div key={mIdx} className="receipt-row receipt-row-muted">
                <div className="receipt-item-label">
                  <span className="material-symbols-outlined text-sm text-amber-600">
                    shopping_bag
                  </span>
                  <span>
                    {item.name} {qty > 1 ? <span className="font-medium text-slate-950 ml-1">x{qty}</span> : ""}
                  </span>
                </div>
                <div className="receipt-item-price">
                  {formatCurrency(subtotal)}
                </div>
              </div>
            );
          })}

          {/* Extra Baggage Row */}
          {extraBaggageKg > 0 && (
            <div className="receipt-row receipt-row-muted">
              <div className="receipt-item-label">
                <span className="material-symbols-outlined text-sm text-indigo-600">
                  luggage
                </span>
                <span>+{extraBaggageKg} kg Extra Luggage</span>
              </div>
              <div className="receipt-item-price">
                {formatCurrency(extraBaggageCost)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
