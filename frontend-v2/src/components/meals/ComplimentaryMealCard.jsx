import React from "react";

export default function ComplimentaryMealCard({
  passengers = [],
  selectedCabin = "Economy",
  foodItems = [],
  flightMeals = [],
  isMealIncluded = false,
  targetCurrency = "INR",
  preferencesMap = {},
  selectedMealsMap = {},
  onMealSelect,
  onPreferenceChange,
}) {
  const defaultOptions = [
    {
      key: "VEG",
      title: "Vegetarian Meal Box",
      description: "Freshly prepared vegetarian meal, seasonal salad & dessert",
      icon: "eco",
      colorClass: "border-emerald-500 bg-emerald-50/40 text-emerald-950",
    },
    {
      key: "NON_VEG",
      title: "Non-Vegetarian Gourmet Box",
      description: "Chef's special non-veg meal, sides & dessert",
      icon: "restaurant",
      colorClass: "border-amber-500 bg-amber-50/40 text-amber-950",
    },
    {
      key: "NONE",
      title: "No Preference / Skip Meal",
      description: "Opt out of in-flight meal service",
      icon: "do_not_disturb_on",
      colorClass: "border-slate-300 bg-slate-50 text-slate-700",
    },
  ];

  const hasBackendItems = foodItems.length > 0 || flightMeals.length > 0;

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
              {isMealIncluded ? "Complimentary In-Flight Meal" : "In-Flight Food & Beverages"}
            </h3>
            <p className="pt-1 text-[10px] text-slate-500 font-medium">
              {isMealIncluded
                ? "Included with your ticket fare at no additional charge"
                : "Select delicious meals and refreshments for your flight"}
            </p>
          </div>
        </div>

        {isMealIncluded ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100/80 text-emerald-900 border border-emerald-300/80">
            <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
            Free Service
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-100/80 text-amber-900 border border-amber-300/80">
            <span className="material-symbols-outlined text-sm font-bold">shopping_bag</span>
            Add-on Menu
          </span>
        )}
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

              {/* Dynamic Backend Food Items Grid */}
              {hasBackendItems ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Backend Food Items */}
                  {foodItems.map((item) => {
                    const isSelected = paxPaidMeals.some((m) => m.food_item_id === item.id);
                    const displayPrice = item.display_price || item.price;
                    const priceLabel = isMealIncluded
                      ? "Included (Free)"
                      : `${item.display_currency || targetCurrency} ${Number(displayPrice).toLocaleString()}`;

                    return (
                      <button
                        key={`food_${item.id}`}
                        type="button"
                        onClick={() =>
                          onMealSelect
                            ? onMealSelect(idx, {
                                food_item_id: item.id,
                                name: item.name,
                                is_veg: item.is_veg,
                                display_price: displayPrice,
                                display_currency: item.display_currency || targetCurrency,
                              })
                            : onPreferenceChange && onPreferenceChange(idx, item.is_veg ? "VEG" : "NON_VEG")
                        }
                        className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? `${item.is_veg ? "border-emerald-500 bg-emerald-50/40 text-emerald-950" : "border-amber-500 bg-amber-50/40 text-amber-950"} ring-2 ring-slate-950/10 shadow-sm`
                            : "border-slate-200/80 bg-white hover:border-slate-300 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="material-symbols-outlined text-lg font-bold">
                            {item.is_veg ? "eco" : "restaurant"}
                          </span>
                          {isSelected && (
                            <span className="material-symbols-outlined text-sm font-bold text-slate-950">
                              check_circle
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold block">{item.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                item.is_veg
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {item.is_veg ? "VEG" : "NON-VEG"}
                            </span>
                            {item.is_vegan && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-green-100 text-green-800">
                                VEGAN
                              </span>
                            )}
                            {item.is_halal && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-800">
                                HALAL
                              </span>
                            )}
                          </div>

                          <span className="text-xs font-bold text-slate-900 block mt-2">
                            {priceLabel}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Backend Flight Meals (Combos) */}
                  {flightMeals.map((meal) => {
                    const isSelected = paxPaidMeals.some((m) => m.flight_meal_id === meal.id);
                    const displayPrice = meal.display_price || meal.price;
                    const priceLabel = isMealIncluded
                      ? "Included (Free)"
                      : `${meal.display_currency || targetCurrency} ${Number(displayPrice).toLocaleString()}`;
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
                                display_price: displayPrice,
                                display_currency: meal.display_currency || targetCurrency,
                              })
                            : onPreferenceChange && onPreferenceChange(idx, "NON_VEG")
                        }
                        className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? "border-sky-500 bg-sky-50/40 text-sky-950 ring-2 ring-slate-950/10 shadow-sm"
                            : "border-slate-200/80 bg-white hover:border-slate-300 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="material-symbols-outlined text-lg font-bold">
                            dinner_dining
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
                          <span className="text-xs font-bold text-slate-900 block mt-2">
                            {priceLabel}
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
              ) : (
                /* Fallback General Preferences Grid */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {defaultOptions.map((opt) => {
                    const isSelected = currentPref === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => onPreferenceChange && onPreferenceChange(idx, opt.key)}
                        className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
