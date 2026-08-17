import React from "react";

export default function FlightBaggageMealIndicators({
  checkedBaggageKg = 20,
  handbagKg = 7,
  isMealIncluded = false,
  className = "",
  compact = false,
  vertical = false,
}) {
  return (
    <div
      className={`flex ${
        vertical ? "flex-col items-start gap-1 text-[11px]" : "items-center gap-2.5"
      } text-slate-500 font-semibold ${
        compact ? "text-[10px]" : ""
      } ${className}`}
    >
      {/* Checked Baggage */}
      <span className="flex items-center gap-1.5" title="Checked Baggage">
        <span className="material-symbols-outlined text-xs text-emerald-600 select-none">
          work
        </span>
        <span>{checkedBaggageKg} kg{vertical ? " Checked" : ""}</span>
      </span>

      {/* Cabin Handbag */}
      <span className="flex items-center gap-1.5" title="Cabin Handbag">
        <span className="material-symbols-outlined text-xs text-sky-600 select-none">
          backpack
        </span>
        <span>{handbagKg} kg{vertical ? " Cabin" : ""}</span>
      </span>

      {/* Meal */}
      <span
        className="flex items-center gap-1.5"
        title={isMealIncluded ? "Complimentary Meal Included" : "In-Flight Selection / No Meal"}
      >
        <span
          className={`material-symbols-outlined text-xs select-none ${
            isMealIncluded ? "text-amber-600" : "text-slate-400"
          }`}
        >
          {isMealIncluded ? "restaurant" : "no_meals"}
        </span>
        <span>{isMealIncluded ? "Meal" : "No Meal"}</span>
      </span>
    </div>
  );
}
