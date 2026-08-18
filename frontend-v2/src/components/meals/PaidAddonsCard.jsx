import React from "react";
import { formatCurrency as fmtCurr } from "@/utils/formatters";

export default function PaidAddonsCard({
  passengers = [],
  foodItems = [],
  targetCurrency = "INR",
  selectedMealsMap = {},
  onAddonQtyChange,
}) {
  if (!foodItems || foodItems.length === 0) return null;

  const formatCurrency = (amount, currencyCode) => fmtCurr(amount, currencyCode || targetCurrency);

  return (
    <div className="booking-container-card rounded-3xl p-6 space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-900 flex items-center justify-center font-bold shadow-xs">
            <span className="material-symbols-outlined text-xl">shopping_bag</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              In-Flight Add-ons & Refreshments
            </h3>
            <p className="pt-1 text-[10px] text-slate-500 font-medium">
              Pre-order delicious snacks, beverages, and extra treats for your journey
            </p>
          </div>
        </div>
      </div>

      {/* Passenger Selection List */}
      <div className="space-y-5">
        {passengers.map((p, paxIdx) => {
          const paxName = p.name?.trim() ? p.name.trim() : `Passenger ${paxIdx + 1}`;
          const paxMealsList = selectedMealsMap[paxIdx] || [];

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
            <div key={paxIdx} className="p-4 rounded-2xl plain-card space-y-4">
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
                  Select Extra Add-ons
                </span>
              </div>

              {/* Grid of Paid Food Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {foodItems.map((item) => {
                  const displayPrice = item.display_price || item.price;
                  const itemCurrency = item.display_currency || targetCurrency;
                  
                  // Find current quantity for this passenger
                  const existingMatch = paxMealsList.find(
                    (m) => m.food_item_id === item.id
                  );
                  const qty = existingMatch ? existingMatch.quantity || 0 : 0;

                  return (
                    <div
                      key={`addon_${item.id}`}
                      className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between gap-3 ${
                        qty > 0
                          ? "border-amber-500 bg-amber-50/30 text-slate-950 ring-2 ring-amber-500/10 shadow-sm"
                          : "border-slate-200/80 bg-white hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-100 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-600">
                            <span className="material-symbols-outlined text-lg">
                              {item.is_veg ? "eco" : "restaurant"}
                            </span>
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-slate-900 truncate">
                            {item.name}
                          </h5>

                          {/* Diet Badges */}
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <span className={item.is_veg ? "badge-veg" : "badge-non-veg"}>
                              {item.is_veg ? "VEG" : "NON-VEG"}
                            </span>
                            {item.is_halal && <span className="badge-halal">HALAL</span>}
                            {item.is_vegan && <span className="badge-vegan">VEGAN</span>}
                          </div>
                        </div>
                      </div>

                      {/* Price & Quantity Controls */}
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-1">
                        <span className="text-xs font-bold text-slate-950">
                          {formatCurrency(displayPrice, itemCurrency)}
                        </span>

                        {qty > 0 ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onAddonQtyChange && onAddonQtyChange(paxIdx, item, -1)}
                              className="qty-btn"
                              aria-label="Decrease quantity"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-slate-900 min-w-[16px] text-center">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => onAddonQtyChange && onAddonQtyChange(paxIdx, item, 1)}
                              className="qty-btn"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAddonQtyChange && onAddonQtyChange(paxIdx, item, 1)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                            Add
                          </button>
                        )}
                      </div>
                    </div>
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
