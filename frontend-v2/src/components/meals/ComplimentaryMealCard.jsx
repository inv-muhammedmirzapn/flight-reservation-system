import React from "react";

export default function ComplimentaryMealCard({
  passengers = [],
  selectedCabin = "Economy",
  preferencesMap = {},
  onPreferenceChange,
}) {
  const options = [
    {
      key: "VEG",
      title: "Vegetarian Meal Box",
      description: "Freshly prepared vegetarian meal, seasonal salad & dessert",
      icon: "eco",
      colorClass: "border-emerald-500 bg-emerald-50/40 text-emerald-950",
      badgeClass: "bg-emerald-100 text-emerald-800",
    },
    {
      key: "NON_VEG",
      title: "Non-Vegetarian Gourmet Box",
      description: "Chef's special non-veg meal, sides & dessert",
      icon: "restaurant",
      colorClass: "border-amber-500 bg-amber-50/40 text-amber-950",
      badgeClass: "bg-amber-100 text-amber-900",
    },
    {
      key: "NONE",
      title: "No Preference / Skip Meal",
      description: "Opt out of in-flight meal service",
      icon: "do_not_disturb_on",
      colorClass: "border-slate-300 bg-slate-50 text-slate-700",
      badgeClass: "bg-slate-200 text-slate-700",
    },
  ];

  return (
    <div className="booking-container-card rounded-3xl p-6 space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold shadow-xs">
            <span className="material-symbols-outlined text-xl">restaurant_menu</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Complimentary In-Flight Meal
            </h3>
            <p className="pt-1 text-[10px] text-slate-500 font-medium">
              Included with your ticket at no additional charge*
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100/80 text-emerald-900 border border-emerald-300/80">
          <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
          Free Service
        </span>
      </div>



      {/* Passengers Selection List */}
      <div className="space-y-5">
        {passengers.map((p, idx) => {
          const paxName = p.name?.trim() ? p.name.trim() : `Passenger ${idx + 1}`;
          const currentPref = preferencesMap[idx] || "VEG";

          const genderRaw = (p.gender || "").toUpperCase();
          const genderLabel =
            genderRaw === "F" || genderRaw === "FEMALE"
              ? "Female"
              : genderRaw === "M" || genderRaw === "MALE"
                ? "Male"
                : genderRaw === "O" || genderRaw === "OTHER"
                  ? "Other"
                  : null;

          const ageLabel = p.age ? `${p.age} yrs` : null;
          const metaText = [genderLabel, ageLabel].filter(Boolean).join(", ");

          return (
            <div
              key={idx}
              className="p-4 rounded-2xl plain-card space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500 text-lg">
                    person
                  </span>
                  <h4 className="text-sm font-bold text-slate-950">{paxName}</h4>
                  {metaText && (
                    <span className="text-xs text-slate-400 font-medium">
                      ({metaText})
                    </span>
                  )}
                </div>

                <span className="text-xs font-medium text-slate-400">
                  Select Meal
                </span>
              </div>

              {/* Option Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {options.map((opt) => {
                  const isSelected = currentPref === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => onPreferenceChange(idx, opt.key)}
                      className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2 ${isSelected
                          ? `${opt.colorClass} ring-2 ring-slate-950/10 shadow-sm`
                          : "border-slate-200/80 bg-white hover:border-slate-300 text-slate-700"
                        }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="material-symbols-outlined text-lg font-bold">
                          {opt.icon}
                        </span>
                        {isSelected && (
                          <span className="material-symbols-outlined text-sm font-bold text-slate-950">
                            check_circle
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-xs font-bold block">{opt.title}</span>
                        <span className="text-[10px] text-slate-500 font-medium block mt-0.5 line-clamp-2">
                          {opt.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
