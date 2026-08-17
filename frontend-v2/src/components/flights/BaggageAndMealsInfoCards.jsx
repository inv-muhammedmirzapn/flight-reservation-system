import React from "react";

export default function BaggageAndMealsInfoCards({
  checkedBaggageKg = 20,
  handbagKg = 7,
  mealIncluded = false,
  summary = false,
  title,
  className = "",
}) {
  if (!summary) {
    return (
      <div className={`space-y-5 ${className}`}>
        {title && (
          <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            {title}
          </h4>
        )}

        <div className="flex gap-3 opacity-90">
          {/* Checked Baggage Card */}
          <div className="plain-card p-3 rounded-2xl flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-lg">work</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-slate-950 block truncate">
                {checkedBaggageKg} kg
              </span>
              <span className="text-[10px] font-semibold text-slate-500 block mt-0.5 truncate">
                Checked Baggage
              </span>
            </div>
          </div>

          {/* Cabin Handbag Card */}
          <div className="plain-card p-3 rounded-2xl flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-lg">backpack</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-slate-950 block leading-tight truncate">
                {handbagKg} kg
              </span>
              <span className="text-[10px] font-semibold text-slate-500 block mt-0.5 truncate">
                Cabin Handbag
              </span>
            </div>
          </div>

          {/* Meal Card */}
          <div className="plain-card p-3 rounded-2xl flex flex-col items-center justify-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                mealIncluded ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              <span className="material-symbols-outlined text-lg">restaurant</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-slate-950 block leading-tight truncate">
                {mealIncluded ? "Meal Provided" : "Buy Onboard"}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 block mt-0.5 truncate">
                {mealIncluded ? "Complimentary" : "In-Flight Selection"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  else {
    return (
      <div className="flex gap-3 opacity-90">
        {/* Checked Baggage Card */}
        <div className="plain-card p-3 rounded-2xl flex flex-col items-center justify-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-base">work</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-950 block truncate">
              {checkedBaggageKg} kg
            </span>
            <span className="text-[10px] font-semibold text-slate-500 block mt-0.5 truncate">
              Checked Baggage
            </span>
          </div>
        </div>

        {/* Cabin Handbag Card */}
        <div className="plain-card p-3 rounded-2xl flex flex-col items-center justify-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-base">backpack</span>
          </div>
          <div className="min-w-0 flex flex-col items-center">
            <span className="text-xs font-bold text-slate-950 block leading-tight truncate">
              {handbagKg} kg
            </span>
            <span className="text-[10px] font-semibold text-slate-500 block mt-0.5 truncate">
              Cabin Handbag
            </span>
          </div>
        </div>

        {/* Meal Card */}
        <div className="plain-card p-3 rounded-2xl flex flex-col items-center justify-center gap-3">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              mealIncluded ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            <span className="material-symbols-outlined text-base">restaurant</span>
          </div>
          <div className="min-w-0 flex flex-col items-center">
            <span className="text-xs font-bold text-slate-950 block leading-tight truncate">
              {mealIncluded ? "Provided" : "None"}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 block mt-0.5 truncate">
              {mealIncluded ? "Complimentary" : "In-Flight Selection"}
            </span>
          </div>
        </div>
      </div>
    )
  }
}
