import React from "react";
import PassengerReviewCard from "./PassengerReviewCard";

export default function BookingReviewCard({
  passengers = [],
  selectedSeats = [],
  isMealIncluded = false,
  complimentaryPrefMap = {},
  selectedMealsMap = {},
  extraBaggagePricePerKg = 0,
  currency = "INR",
}) {
  return (
    <div className="booking-container-card rounded-3xl p-6 space-y-5 animate-fade-in transition-all duration-300">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-bold shadow-xs">
            <span className="material-symbols-outlined text-xl">person_pin</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-950">
              Passenger & Selection Summary
            </h3>
            <p className="text-[10px] text-slate-500 font-medium pt-0.5">
              Review traveler details and selected items before final payment
            </p>
          </div>
        </div>
      </div>

      {/* Passengers Summary List */}
      <div className="space-y-3">
        {passengers.map((p, idx) => {
          const compPref = complimentaryPrefMap[idx] || (isMealIncluded ? "VEG" : "NONE");
          const paxSelectedMeals = selectedMealsMap[idx] || [];
          const paidMeals = paxSelectedMeals.filter((m) => Number(m.price) > 0);
          const compMealItem = paxSelectedMeals.find((m) => Number(m.price) === 0);
          const selectedSeat = selectedSeats[idx] || null;

          return (
            <PassengerReviewCard
              key={idx}
              index={idx}
              passenger={p}
              selectedSeat={selectedSeat}
              isMealIncluded={isMealIncluded}
              compPref={compPref}
              compMealItem={compMealItem}
              paidMeals={paidMeals}
              extraBaggagePricePerKg={extraBaggagePricePerKg}
              currency={currency}
            />
          );
        })}
      </div>
    </div>
  );
}
