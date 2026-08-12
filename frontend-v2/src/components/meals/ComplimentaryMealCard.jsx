
export default function ComplimentaryMealCard({
  passengers = [],
  _selectedCabin = "Economy",
  flightMeals = [],
  isMealIncluded = false,
  targetCurrency = "INR",
  preferencesMap = {},
  selectedMealsMap = {},
  onMealSelect,
  onPreferenceChange,
}) {
  return (
    <div className="booking-container-card rounded-3xl p-6 space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold shadow-xs">
            <span className="material-symbols-outlined text-xl">restaurant_menu</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Complimentary In-Flight Meal
            </h3>
            <p className="pt-1 text-[10px] text-slate-500 font-medium">
              Included with your ticket fare at no additional charge
            </p>
          </div>
        </div>
      </div>

      {/* Passengers Selection List */}
      <div className="space-y-5">
        {passengers.map((p, idx) => {
          const paxName = p.name?.trim() ? p.name.trim() : `Passenger ${idx + 1}`;
          const paxPaidMeals = selectedMealsMap[idx] || [];
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
            <div key={idx} className="p-4 rounded-2xl plain-card space-y-3">
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
                  Select Meal Choice
                </span>
              </div>

              {/* Database Flight Meals Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Flight Meals (Combos from DB) */}
                {flightMeals.map((meal) => {
                  const isSelected = paxPaidMeals.some((m) => m.flight_meal_id === meal.id);
                  const itemsDesc = meal.items?.map((it) => `${it.quantity}x ${it.name}`).join(", ");

                  return (
                    <button
                      key={`combo_${meal.id}`}
                      type="button"
                      onClick={() =>
                        onMealSelect
                          ? onMealSelect(idx, {
                              flight_meal_id: meal.id,
                              name: meal.name,
                              display_price: 0,
                              display_currency: targetCurrency,
                            })
                          : onPreferenceChange && onPreferenceChange(idx, meal.is_veg ? "VEG" : "NON_VEG")
                      }
                      className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? `${meal.is_veg ? "border-emerald-500 bg-emerald-50/40 text-emerald-950" : "border-amber-500 bg-amber-50/40 text-amber-950"} ring-2 ring-slate-950/10 shadow-sm`
                          : "border-slate-200/80 bg-white hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="material-symbols-outlined text-lg font-bold">
                          {meal.is_veg ? "eco" : "dinner_dining"}
                        </span>
                        {isSelected && (
                          <span className="material-symbols-outlined text-sm font-bold text-slate-950">
                            check_circle
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-xs font-bold block">{meal.name}</span>
                        {itemsDesc && (
                          <span className="text-[10px] text-slate-500 font-medium block mt-0.5 line-clamp-1">
                            {itemsDesc}
                          </span>
                        )}

                        {/* Meal Tags */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className={meal.is_veg ? "badge-veg" : "badge-non-veg"}>
                            {meal.is_veg ? "VEG" : "NON-VEG"}
                          </span>
                          {meal.is_halal && <span className="badge-halal">HALAL</span>}
                          {meal.is_vegan && <span className="badge-vegan">VEGAN</span>}
                        </div>

                        <span className="text-xs font-bold text-slate-900 block mt-2">
                          Included (Free)
                        </span>
                      </div>
                    </button>
                  );
                })}

                {/* Option: Skip Meal */}
                <button
                  type="button"
                  onClick={() =>
                    onMealSelect
                      ? onMealSelect(idx, { key: "NONE" })
                      : onPreferenceChange && onPreferenceChange(idx, "NONE")
                  }
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2 ${
                    paxPaidMeals.length === 0 && currentPref === "NONE"
                      ? "border-slate-400 bg-slate-100 text-slate-900 ring-2 ring-slate-950/10 shadow-sm"
                      : "border-slate-200/80 bg-white hover:border-slate-300 text-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="material-symbols-outlined text-lg font-bold">
                      do_not_disturb_on
                    </span>
                    {paxPaidMeals.length === 0 && currentPref === "NONE" && (
                      <span className="material-symbols-outlined text-sm font-bold text-slate-950">
                        check_circle
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-xs font-bold block">No Meal / Skip</span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                      Opt out of in-flight meal service
                    </span>
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
