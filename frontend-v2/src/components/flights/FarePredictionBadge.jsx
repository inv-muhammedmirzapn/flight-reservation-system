import { useState, useEffect } from "react";
import { flightsAPI } from "@/services/flight-service/flightService";


// This is a JavaScript object containing the UI configuration for each prediction direction.
const DIRECTION_CONFIG = {
  INCREASE: {
    icon: "trending_up",
    color: "text-rose-600",
    bg: "bg-rose-50 border-rose-200",
    label: "Price likely rising",
  },
  DECREASE: {
    icon: "trending_down",
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
    label: "Price may drop",
  },
  STABLE: {
    icon: "trending_flat",
    color: "text-slate-600",
    bg: "bg-slate-50 border-slate-200",
    label: "Price is stable",
  },
};

// This component accepts two props:
// flightInstanceId: The ID of the flight instance to get the fare prediction for.
// cabinClass: The cabin class for which the fare prediction is to be obtained.

export default function FarePredictionBadge({ flightInstanceId, cabinClass }) {
    // State to store the fare prediction data.
  const [prediction, setPrediction] = useState(null);
   // State to track loading status.
  const [loading, setLoading] = useState(true);

  // React executes this effect after rendering.
  useEffect(() => {
    // If no flightInstanceId, do nothing.
    if (!flightInstanceId) return;

    // Set a flag to track whether the component is mounted.
    let isMounted = true;
    setLoading(true);
    // Clear previous prediction data.
    setPrediction(null);



    // Call the API to get fare prediction.
    flightsAPI
      .getFarePrediction(flightInstanceId, cabinClass)
      .then((data) => {
        if (isMounted) setPrediction(data);
      })
      .catch(() => {
        // silently fail —The code intentionally doesn't show an error message, as fare prediction is considered optional/advisory.
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

      // This cleanup function runs when the component unmounts or before the effect runs again.
    return () => { isMounted = false; };
  }, [flightInstanceId, cabinClass]); // Dependency array - ensures the effect runs only when these values change

  
  // Loading skeleton
  if (loading) {
    return (
      <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 animate-pulse h-24" />
    );
  }

  // Hide if no data or flight departed
  if (!prediction || prediction.direction === "DEPARTED") return null;

  const config = DIRECTION_CONFIG[prediction.direction] || DIRECTION_CONFIG.STABLE;

  return (
    <div className={`w-full rounded-2xl border p-4 ${config.bg}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`material-symbols-outlined text-xl ${config.color}`}>
          {config.icon}
        </span>
        <span className={`text-sm font-bold ${config.color}`}>
          {config.label}
        </span>
        <span className="ml-auto text-[11px] font-semibold text-slate-400">
          {prediction.confidence}% confidence
        </span>
      </div>

      {/* Advice */}
      <p className="text-xs text-slate-600 leading-relaxed mb-3">
        {prediction.advice}
      </p>

      {/* Footer stats */}
      <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]">calendar_today</span>
          {prediction.days_until_departure}d until departure
        </span>
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]">airline_seat_recline_normal</span>
          {prediction.occupancy_pct}% occupied
        </span>
      </div>
    </div>
  );
}
