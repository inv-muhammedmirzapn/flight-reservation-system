import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchComparison, clearComparison } from "@/store/comparisonSlice";
import { formatCurrency } from "@/utils/formatters";

const getLogoUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `http://127.0.0.1:8000${url.startsWith("/") ? "" : "/"}${url}`;
};

const fmtTime = (iso) => {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
};

const fmtDuration = (mins) => {
  if (!mins && mins !== 0) return "-";
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export default function CompareModal({ onClose }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selectedIds, comparisonData, loading, error } = useSelector(
    (state) => state.comparison
  );

  useEffect(() => {
    if (selectedIds.length >= 2) {
      dispatch(fetchComparison(selectedIds));
    }
  }, [dispatch, selectedIds]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    onClose();
  };

  const rows = [
    { label: "Airline", icon: "airlines" },
    { label: "Departure", icon: "flight_takeoff" },
    { label: "Arrival", icon: "flight_land" },
    { label: "Travel Time", icon: "schedule" },
    { label: "Stops", icon: "trip_origin" },
    { label: "Price Prediction", icon: "monitoring" },
    { label: "Economy Price", icon: "sell" },
    { label: "Business Price", icon: "workspace_premium" },
    { label: "First Price", icon: "star" },
    { label: "Economy Seats", icon: "event_seat" },
    { label: "Business Seats", icon: "event_seat" },
    { label: "First Seats", icon: "event_seat" },
    { label: "Refund Type", icon: "policy" },
    { label: "Meal Included", icon: "restaurant" },
  ];

  const getCellValue = (flight, rowLabel) => {
    const economyFare = flight.fares?.find(f => f.cabin_class === "ECONOMY");
    const businessFare = flight.fares?.find(f => f.cabin_class === "BUSINESS");
    const firstFare = flight.fares?.find(f => f.cabin_class === "FIRST");
    const economySeats = flight.seat_availability?.ECONOMY;
    const businessSeats = flight.seat_availability?.BUSINESS;
    const firstSeats = flight.seat_availability?.FIRST;

    switch (rowLabel) {
      case "Airline":
        return (
          <div className="flex flex-col items-center gap-1">
            {getLogoUrl(flight.airline_logo) ? (
              <img
                src={getLogoUrl(flight.airline_logo)}
                alt={flight.airline_name}
                className="h-6 max-w-[80px] object-contain"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            ) : null}
            <span className="text-xs font-bold text-slate-800 text-center">{flight.airline_name}</span>
            <span className="text-[10px] text-slate-400">{flight.airline_code}</span>
          </div>
        );
      case "Departure":
        return (
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-slate-900">{fmtTime(flight.departure_time)}</span>
            <span className="text-[10px] text-slate-500">{fmtDate(flight.departure_time)}</span>
          </div>
        );
      case "Arrival":
        return (
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-slate-900">{fmtTime(flight.arrival_time)}</span>
            <span className="text-[10px] text-slate-500">{fmtDate(flight.arrival_time)}</span>
          </div>
        );
      case "Travel Time":
        return <span className="text-sm font-bold text-slate-800">{fmtDuration(flight.travel_time_minutes)}</span>;
      case "Stops":
        return (
          <span className={`text-sm font-bold ${flight.number_of_stops === 0 ? "text-green-600" : "text-amber-600"}`}>
            {flight.number_of_stops === 0 ? "Non-stop" : `${flight.number_of_stops} Stop${flight.number_of_stops > 1 ? "s" : ""}`}
          </span>
        );
      case "Price Prediction": {
        const direction = flight.fare_prediction_direction;
        const confidence = flight.fare_prediction_confidence;
        
        if (!direction) {
          return <span className="text-xs text-slate-400">N/A</span>;
        }
        
        if (direction === "INCREASE") {
          return (
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border border-rose-200">
                <span className="material-symbols-outlined text-[12px]">trending_up</span> Increase
              </span>
              <span className="text-[9px] font-semibold text-slate-500 mt-1">{confidence}% confidence</span>
            </div>
          );
        } else if (direction === "DECREASE") {
          return (
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border border-emerald-200">
                <span className="material-symbols-outlined text-[12px]">trending_down</span> Drop
              </span>
              <span className="text-[9px] font-semibold text-slate-500 mt-1">{confidence}% confidence</span>
            </div>
          );
        } else {
           return (
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border border-slate-200">
                <span className="material-symbols-outlined text-[12px]">trending_flat</span> Stable
              </span>
              <span className="text-[9px] font-semibold text-slate-500 mt-1">{confidence}% confidence</span>
            </div>
          );
        }
      }
      case "Economy Price":
        return economyFare
          ? <span className="text-base font-extrabold text-slate-900">{formatCurrency(Math.round(economyFare.price), economyFare.currency)}</span>
          : <span className="text-xs text-slate-400">N/A</span>;
      case "Business Price":
        return businessFare
          ? <span className="text-base font-extrabold text-slate-900">{formatCurrency(Math.round(businessFare.price), businessFare.currency)}</span>
          : <span className="text-xs text-slate-400">N/A</span>;
      case "First Price":
        return firstFare
          ? <span className="text-base font-extrabold text-slate-900">{formatCurrency(Math.round(firstFare.price), firstFare.currency)}</span>
          : <span className="text-xs text-slate-400">N/A</span>;
      case "Economy Seats":
        return economySeats
          ? <span className={`text-sm font-bold ${economySeats.available > 10 ? "text-green-600" : "text-amber-600"}`}>{economySeats.available} / {economySeats.total}</span>
          : <span className="text-xs text-slate-400">N/A</span>;
      case "Business Seats":
        return businessSeats
          ? <span className={`text-sm font-bold ${businessSeats.available > 5 ? "text-green-600" : "text-amber-600"}`}>{businessSeats.available} / {businessSeats.total}</span>
          : <span className="text-xs text-slate-400">N/A</span>;
      case "First Seats":
        return firstSeats
          ? <span className={`text-sm font-bold ${firstSeats.available > 2 ? "text-green-600" : "text-amber-600"}`}>{firstSeats.available} / {firstSeats.total}</span>
          : <span className="text-xs text-slate-400">N/A</span>;
      case "Refund Type":
        return <span className="text-xs font-semibold text-slate-600 capitalize">{economyFare?.refund_type?.replace("_", " ") || "-"}</span>;
      case "Meal Included":
        return economyFare?.meal_included
          ? <span className="text-green-600 font-bold text-sm">✓ Yes</span>
          : <span className="text-slate-400 text-sm">✗ No</span>;
      default:
        return "-";
    }
  };

  // ── Best-value highlights ─────────────────────────────────────────────
  const bestTravelTimeId = (() => {
    if (comparisonData.length < 2) return null;
    const valid = comparisonData.filter(f => f.travel_time_minutes != null);
    if (!valid.length) return null;
    return valid.reduce((a, b) => a.travel_time_minutes <= b.travel_time_minutes ? a : b).flight_instance_id;
  })();

  const bestPriceId = (() => {
    if (comparisonData.length < 2) return null;
    const valid = comparisonData.filter(f => f.fares?.find(fare => fare.cabin_class === "ECONOMY"));
    if (!valid.length) return null;
    return valid.reduce((a, b) => {
      const pa = a.fares.find(f => f.cabin_class === "ECONOMY")?.price ?? Infinity;
      const pb = b.fares.find(f => f.cabin_class === "ECONOMY")?.price ?? Infinity;
      return pa <= pb ? a : b;
    }).flight_instance_id;
  })();

  const isBest = (flight, rowLabel) => {
    if (rowLabel === "Travel Time") return flight.flight_instance_id === bestTravelTimeId;
    if (rowLabel === "Economy Price") return flight.flight_instance_id === bestPriceId;
    return false;
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* Modal Panel */}
      <div className="relative bg-white w-full max-w-5xl max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in"
        style={{ boxShadow: "0 24px 64px rgba(15,23,42,0.25)" }}
      >

        {/* Modal Header */}
        <div className="flex items-center justify-between px-7 py-5  border-b border-yellow-100 shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Flight Comparison
            </h2>
            <p className="text-xs font-medium text-slate-600 mt-1">
              Comparing {comparisonData.length || selectedIds.length} flights side by side
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { dispatch(clearComparison()); handleClose(); }}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer px-4 py-2 rounded-xl border border-yellow-200 hover:border-yellow-300 hover:bg-yellow-100/50 bg-white/50"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/60 hover:bg-white shadow-sm border border-yellow-100 transition-colors cursor-pointer text-slate-700 hover:text-slate-900"
            >
              <span className="material-symbols-outlined text-lg select-none">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-auto">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-900" />
              <p className="text-slate-500 text-sm font-semibold">Fetching comparison data...</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="m-6 bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700 text-sm font-semibold">
              {error}
            </div>
          )}

          {/* Comparison Table */}
          {!loading && !error && comparisonData.length > 0 && (
            <table className="w-full min-w-[500px]">
              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <tr className="border-b-2 border-slate-200">
                  <th className="w-40 p-5 text-left text-[11px] font-extrabold text-slate-500 uppercase tracking-widest bg-slate-50/90 rounded-tl-xl">
                    Feature
                  </th>
                  {comparisonData.map((flight) => (
                    <th key={flight.flight_instance_id} className="p-5 text-center border-l border-slate-100 bg-white shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-sm font-extrabold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">{flight.flight_number}</span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${flight.status === "SCHEDULED" ? "bg-emerald-100 text-emerald-700" :
                          flight.status === "DELAYED" ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                          {flight.status}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, rowIdx) => (
                  <tr
                    key={row.label}
                    className={`transition-colors hover:bg-slate-50/80 ${rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                  >
                    <td className="p-4 bg-slate-50/50 border-r border-slate-100 sticky left-0 group">
                      <div className="flex items-center gap-3 pl-2">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-slate-600 group-hover:border-slate-300 transition-colors">
                          <span className="material-symbols-outlined select-none" style={{ fontSize: "16px" }}>
                            {row.icon}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-700 whitespace-nowrap">{row.label}</span>
                      </div>
                    </td>
                    {comparisonData.map((flight) => {
                      const best = isBest(flight, row.label);
                      return (
                        <td
                          key={flight.flight_instance_id}
                          className={`p-5 text-center border-l border-slate-100 relative transition-colors ${
                            best ? "bg-emerald-50/70" : ""
                          }`}
                        >

                          {getCellValue(flight, row.label)}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Book Now row */}
                <tr className="border-t-2 border-slate-100 bg-slate-50/50">
                  <td className="p-5 bg-slate-50/80 border-r border-slate-100 sticky left-0 rounded-bl-xl" />
                  {comparisonData.map((flight) => (
                    <td key={flight.flight_instance_id} className="p-6 text-center border-l border-slate-100 bg-white">
                      <button
                        type="button"
                        onClick={() => { dispatch(clearComparison()); handleClose(); navigate(`/flights/${flight.flight_instance_id}`); }}
                        className="w-[160px] py-3 rounded-xl text-sm font-bold btn-primary shadow-sm hover:shadow-md transition-all"
                      >
                        Book Now
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
