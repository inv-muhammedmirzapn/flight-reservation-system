import React from "react";

export default function BaggageSelectionCard({
  passengers = [],
  baggageInfo = {},
  onBaggageChange,
}) {
  const cabinBaggageKg = baggageInfo.cabin_baggage_kg ?? 20;
  const handbagKg = baggageInfo.handbag_kg ?? 7;
  const maxExtraKg = baggageInfo.max_extra_baggage_kg_per_person ?? 20;
  const pricePerKg = Number(baggageInfo.extra_baggage_display_price_per_kg || baggageInfo.extra_baggage_price_per_kg || 0);
  const displayCurrency = baggageInfo.display_currency || baggageInfo.extra_baggage_currency || "INR";

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: displayCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="booking-container-card rounded-3xl p-6 space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-900 flex items-center justify-center font-bold shadow-xs">
            <span className="material-symbols-outlined text-xl">luggage</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Baggage Add-ons
            </h3>
            <p className="pt-1 text-[10px] text-slate-500 font-medium">
              Review included allowances and add extra check-in baggage for your trip
            </p>
          </div>
        </div>

        {/* Global Currency / Unit Rate Info */}
        {pricePerKg > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 text-xs font-semibold text-slate-700 shadow-2xs self-start sm:self-auto">
            <span className="material-symbols-outlined text-sm text-indigo-600">info</span>
            <span>{formatCurrency(pricePerKg)} / kg</span>
          </div>
        )}
      </div>

      {/* Passenger Extra Baggage Selection List */}
      <div className="space-y-4">
        {passengers.map((p, paxIdx) => {
          const paxName = p.name?.trim() ? p.name.trim() : `Passenger ${paxIdx + 1}`;
          const currentExtraKg = Math.max(0, parseInt(p.extra_baggage_kg || 0, 10));
          const passengerExtraCost = currentExtraKg * pricePerKg;

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
            <div key={paxIdx} className="p-4 rounded-2xl plain-card space-y-3">
              {/* Passenger Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-lg">
                    person
                  </span>
                  <h4 className="text-sm font-bold text-slate-950">{paxName}</h4>
                  {metaText && (
                    <span className="text-xs text-slate-400 font-medium">
                      ({metaText})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  <span>{cabinBaggageKg} kg + {handbagKg} kg Included</span>
                </div>
              </div>

              {/* Extra Baggage Weight Control */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-slate-500">add_shopping_cart</span>
                    Add Extra Luggage
                  </h5>
                  <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                    Select in whole 1 kg steps (Up to {maxExtraKg} kg max)
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentExtraKg <= 0}
                      onClick={() => onBaggageChange && onBaggageChange(paxIdx, currentExtraKg - 1)}
                      className="qty-btn"
                      aria-label="Decrease extra baggage"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold text-slate-900 min-w-[32px] text-center bg-slate-100 py-1 px-2 rounded-lg border border-slate-200/60">
                      {currentExtraKg} kg
                    </span>
                    <button
                      type="button"
                      disabled={currentExtraKg >= maxExtraKg}
                      onClick={() => onBaggageChange && onBaggageChange(paxIdx, currentExtraKg + 1)}
                      className="qty-btn"
                      aria-label="Increase extra baggage"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Passenger Cost Summary */}
              {currentExtraKg > 0 && (
                <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200/80 px-3 py-2 rounded-xl text-xs mt-2">
                  <span className="font-semibold text-amber-900">
                    Extra Luggage: +{currentExtraKg} kg
                  </span>
                  <span className="font-bold text-amber-950">
                    + {formatCurrency(passengerExtraCost)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
