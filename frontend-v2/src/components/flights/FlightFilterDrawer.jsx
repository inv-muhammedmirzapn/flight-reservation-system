import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function FlightFilterDrawer({ isOpen, onClose, filters, onApplyFilters, onResetFilters }) {
  // Local draft state — only applies when user clicks 'Apply Filters'
  const [draftFilters, setDraftFilters] = useState({
    ordering: "base_fare",
    stops: "",
    airlines: [],
    waitlistMode: "all", // "all" | "available_only" | "waitlisted_only"
    maxFare: 100000
  });

  // Sync draft state with incoming filters when drawer opens
  useEffect(() => {
    if (isOpen) {
      setDraftFilters({
        ordering: filters?.ordering || "base_fare",
        stops: filters?.stops !== undefined ? filters.stops : "",
        airlines: filters?.airlines || [],
        waitlistMode: filters?.waitlistMode || "all",
        maxFare: filters?.maxFare ?? 100000
      });
    }
  }, [isOpen, filters]);

  // Prevent body scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (typeof document === "undefined") return null;

  const handleApply = () => {
    if (onApplyFilters) {
      onApplyFilters(draftFilters);
    }
    if (onClose) {
      onClose();
    }
  };

  const handleReset = () => {
    const defaultFilters = {
      ordering: "base_fare",
      stops: "",
      airlines: [],
      waitlistMode: "all",
      maxFare: 100000
    };
    setDraftFilters(defaultFilters);
    if (onResetFilters) {
      onResetFilters(defaultFilters);
    }
    if (onClose) {
      onClose();
    }
  };

  return createPortal(
    <>
      {/* Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-[110] transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sliding Drawer Panel from Left */}
      <div
        className={`fixed top-0 left-0 h-full w-80 sm:w-96 max-w-[85vw] plain-card rounded-r-3xl overflow-hidden shadow-2xl z-[110] flex flex-col transition-transform duration-300 ease-out transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-900 font-bold text-xl">
              tune
            </span>
            <h2 className="text-lg font-bold text-slate-950">
              Filters & Sorting
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200/80 flex items-center justify-center text-slate-700 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg font-bold">close</span>
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-7">
          {/* 1. Sort By */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Sort By
            </h3>
            <div className="flex gap-2">
              {[
                { label: "Cheapest First", value: "base_fare" },
                { label: "Earliest Departure", value: "departure_time" },
                { label: "Shortest Duration", value: "duration" }
              ].map((option) => {
                const isSelected = draftFilters.ordering === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setDraftFilters((prev) => ({ ...prev, ordering: option.value }))
                    }
                    className={`flex-1 py-2 px-1 text-[10px] font-semibold rounded-xl border transition-all cursor-pointer text-center ${
                      isSelected
                        ? "bg-slate-950 text-white border-slate-950 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Waitlisted Flights Filter */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Waitlisted Flights
            </h3>
            <div className="flex gap-2">
              {[
                { label: "All Flights", value: "all" },
                { label: "Hide Waitlisted", value: "available_only" },
                { label: "Waitlist Only", value: "waitlisted_only" }
              ].map((opt) => {
                const isSelected = draftFilters.waitlistMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setDraftFilters((prev) => ({ ...prev, waitlistMode: opt.value }))
                    }
                    className={`flex-1 py-2 px-1 text-[10px] font-semibold rounded-xl border transition-all cursor-pointer text-center ${
                      isSelected
                        ? "bg-slate-950 text-white border-slate-950 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Price Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900">
                Max Price
              </h3>
              <span className="text-xs font-bold text-slate-950 bg-slate-100 px-2.5 py-1 rounded-lg">
                ₹{draftFilters.maxFare >= 100000 ? "1,00,000+" : draftFilters.maxFare.toLocaleString("en-IN")}
              </span>
            </div>
            <input
              type="range"
              min="5000"
              max="100000"
              step="2500"
              value={draftFilters.maxFare}
              onChange={(e) =>
                setDraftFilters((prev) => ({ ...prev, maxFare: Number(e.target.value) }))
              }
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-950"
            />
            <div className="flex justify-between text-[10px] font-semibold text-slate-400 mt-1">
              <span>₹5,000</span>
              <span>₹1,00,000+</span>
            </div>
          </div>

          {/* 4. Stops */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Stops
            </h3>
            <div className="flex items-center gap-2">
              {["Any", "Non-stop", "1 Stop", "2+ Stops"].map((stopOption, idx) => {
                const valueStr = idx === 0 ? "" : String(idx - 1);
                const isSelected =
                  (draftFilters.stops === "" && idx === 0) || draftFilters.stops === valueStr;
                return (
                  <button
                    key={stopOption}
                    type="button"
                    onClick={() =>
                      setDraftFilters((prev) => ({ ...prev, stops: valueStr }))
                    }
                    className={`flex-1 p-2 text-[10px] font-semibold rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-950 text-white border-slate-950 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70"
                    }`}
                  >
                    {stopOption}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Airline Filter */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Airline
            </h3>
            <div className="space-y-2">
              {["Air India", "Lufthansa", "Etihad Airways", "IndiGo", "Air India Express"].map((airlineName) => {
                const isChecked = draftFilters.airlines.includes(airlineName);
                return (
                  <label
                    key={airlineName}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/70 transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-slate-800">
                      {airlineName}
                    </span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const current = draftFilters.airlines;
                        const updated = e.target.checked
                          ? [...current, airlineName]
                          : current.filter((a) => a !== airlineName);
                        setDraftFilters((prev) => ({ ...prev, airlines: updated }));
                      }}
                      className="accent-slate-900 cursor-pointer w-4 h-4 rounded-md"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-5 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 py-2.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-slate-200/70 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2.5 text-xs font-bold text-slate-950 bg-[#ffeb00] hover:bg-[#ebd800] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Apply Filter
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
