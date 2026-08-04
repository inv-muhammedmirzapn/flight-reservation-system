import React from "react";

export default function CabinClassSelector({ flight, selectedCabin, onSelectCabin }) {
  const cabins = [
    { key: "ECONOMY", label: "Economy", icon: "chair" },
    { key: "BUSINESS", label: "Business", icon: "airline_seat_recline_extra" },
    { key: "FIRST", label: "First Class", icon: "workspace_premium" }
  ];

  return (
    <div className="booking-container-card space-y-3 animate-fade-in">
      <h3 className="text-xl font-bold text-slate-950 mb-2">
        Select Cabin Class
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {cabins.map((cabin) => {
          const fareObj = flight?.fares?.[cabin.key];
          const isSelected = selectedCabin === cabin.key;
          const cabinPrice = fareObj ? fareObj.price : (cabin.key === "ECONOMY" ? flight?.base_fare : null);
          const isAvailable = fareObj ? fareObj.available_seats > 0 : flight?.available_seats > 0;
          const seatsCount = fareObj?.available_seats ?? flight?.available_seats ?? 0;

          return (
            <button
              key={cabin.key}
              type="button"
              onClick={() => onSelectCabin(cabin.key)}
              className={`cabin-option-card ${
                isSelected ? "cabin-option-card-selected" : "cabin-option-card-default"
              }`}
            >
              <div className="flex items-center gap-1.5 w-full justify-between">
                <span className="material-symbols-outlined text-lg font-bold">
                  {cabin.icon}
                </span>
                {isSelected && (
                  <span className="material-symbols-outlined text-sm font-bold text-[#ffeb00]">
                    check_circle
                  </span>
                )}
              </div>
              <span className="text-xs font-bold mt-1">{cabin.label}</span>
              {cabinPrice != null ? (
                <span className={`text-xs font-extrabold ${isSelected ? "text-[#ffeb00]" : "text-emerald-700"}`}>
                  ₹{Number(cabinPrice).toLocaleString("en-IN")}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">N/A</span>
              )}
              <span
                className={`text-[9px] font-semibold ${
                  isAvailable
                    ? isSelected
                      ? "text-slate-300"
                      : "text-slate-500"
                    : "text-amber-500 font-bold"
                }`}
              >
                {isAvailable ? `${seatsCount} seats` : "Waitlist"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
