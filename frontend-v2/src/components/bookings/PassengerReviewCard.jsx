import React from "react";

export default function PassengerReviewCard({
  index,
  passenger,
  isMealIncluded = false,
  compPref = "NONE",
  compMealItem = null,
  paidMeals = [],
}) {
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
  const hasItems = compMealText || paidMeals.length > 0;

  return (
    <div className="plain-card p-4 rounded-2xl transition-all duration-200 hover:border-slate-200">
      {/* Passenger Info Header */}
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

      {/* Bill / Receipt Itemized List */}
      {hasItems && (
        <div className="receipt-container">
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

          {/* Paid Add-ons Itemized List (Prices aligned to right like a bill) */}
          {paidMeals.map((item, mIdx) => {
            const qty = item.quantity || 1;
            const subtotal = Number(item.price || 0) * qty;
            const currency = item.display_currency || "INR";

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
                  {currency} {subtotal.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
