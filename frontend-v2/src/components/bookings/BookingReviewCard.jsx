import React from "react";

export default function BookingReviewCard({
  passengers = [],
  isMealIncluded = false,
  complimentaryPrefMap = {},
  selectedMealsMap = {},
}) {
  return (
    <div className="booking-container-card rounded-3xl p-6 space-y-6 animate-fade-in transition-all duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold shadow-xs">
            <span className="material-symbols-outlined text-xl">fact_check</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Review & Confirm Booking
            </h3>
            <p className="pt-1 text-[10px] text-slate-500 font-medium">
              Please verify passenger details and selected options before checkout
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-100/80 text-amber-900 border border-amber-300/80">
          <span className="material-symbols-outlined text-sm font-bold">verified_user</span>
          Final Step
        </span>
      </div>

      {/* Passengers Summary */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-500">
          Travelers ({passengers.length})
        </h4>
        <div className="space-y-3">
          {passengers.map((p, idx) => {
            const compPref = complimentaryPrefMap[idx] || (isMealIncluded ? "VEG" : "NONE");
            const paidMeals = selectedMealsMap[idx] || [];

            const genderRaw = (p.gender || "").toUpperCase();
            const genderLabel =
              genderRaw === "F" || genderRaw === "FEMALE"
                ? "Female"
                : genderRaw === "M" || genderRaw === "MALE"
                  ? "Male"
                  : genderRaw === "O" || genderRaw === "OTHER"
                    ? "Other"
                    : "Passenger";

            return (
              <div
                key={idx}
                className="plain-card p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-200 shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs">
                    <span className="material-symbols-outlined text-lg">person</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-950">
                      {p.name?.trim() ? p.name.trim() : `Passenger ${idx + 1}`}
                    </p>
                    <p className="text-xs text-slate-500 font-medium pt-0.5">
                      {genderLabel}, {p.age || "N/A"} yrs
                      {p.phone_number?.trim() ? ` • ${p.phone_number.trim()}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isMealIncluded && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold bg-emerald-100/80 text-emerald-900 border border-emerald-300/80">
                      <span className="material-symbols-outlined text-xs">restaurant</span>
                      Complimentary: {compPref === "NON_VEG" ? "Non-Veg Meal" : compPref === "VEG" ? "Veg Meal" : "None"}
                    </span>
                  )}
                  {paidMeals.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-100/80 text-amber-900 border border-amber-300/80">
                      <span className="material-symbols-outlined text-sm">shopping_bag</span>
                      {paidMeals.reduce((acc, m) => acc + m.quantity, 0)} Add-on Item(s)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
