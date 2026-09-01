import { formatCurrency as fmtCurr } from "@/utils/formatters";

export default function DynamicPriceBreakdownCard({ flight, selectedCabin = "ECONOMY" }) {
  if (!flight) return null;

  const fareObj = flight.fares?.[selectedCabin];
  const breakdown = fareObj?.price_breakdown;
  const displayCurrency = fareObj?.display_currency || "INR";

  const formatCurrency = (amount) => fmtCurr(amount, displayCurrency);

  // Fallbacks if breakdown is missing or direct price used
  const finalPrice = Math.round(
    breakdown?.final_price_display ??
    fareObj?.display_price ??
    fareObj?.price ??
    flight.base_fare ??
    0
  );
  const basePrice = Math.round(
    breakdown?.base_price_display ?? breakdown?.base_price ?? finalPrice
  );

  const daysUntilDeparture = breakdown?.days_until_departure ?? 0;
  const occupancyPercent = Math.round(breakdown?.occupancy_percent ?? 0);
  const weekendMultiplier = breakdown?.weekend_multiplier ?? 1;
  const holidayMultiplier = breakdown?.holiday_multiplier ?? 1;
  const holidayName = breakdown?.holiday_name ?? "";
  const demandSurgePercent = Math.round(breakdown?.demand_surge_percent ?? 0);
  const proximityMultiplier = breakdown?.proximity_multiplier ?? 1;

  // Calculate net multiplier percentage change
  const overallDiff = finalPrice - basePrice;
  const overallPercentChange = basePrice > 0 ? Math.round(((finalPrice - basePrice) / basePrice) * 100) : 0;

  // Construct active factors list
  const factors = [];

  // 1. Explicit Cabin Occupancy Factor (Always show if breakdown is present)
  const isLowOccupancy = occupancyPercent < 60;
  const proxDiff = Math.round((proximityMultiplier - 1) * 100);

  factors.push({
    id: "occupancy",
    icon: "airline_seat_recline_normal",
    label: `Cabin Seat Occupancy (${occupancyPercent}%)`,
    badgeText: proxDiff < 0 ? `${proxDiff}%` : proxDiff > 0 ? `+${proxDiff}% Surge` : `${occupancyPercent}% Booked`,
    badgeColor: isLowOccupancy
      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
      : "bg-amber-100 text-amber-900 border-amber-300",
    description: isLowOccupancy
      ? `Occupancy < 60% capacity threshold → ${Math.abs(proxDiff)}% discount applied to boost sales`
      : `Occupancy ≥ 60% capacity threshold → ${proxDiff}% high-demand surge applied`,
  });

  // 2. Proximity / Departure Window Factor
  if (daysUntilDeparture > 0 || proximityMultiplier !== 1) {
    factors.push({
      id: "proximity",
      icon: "schedule",
      label: `Departure Window (${daysUntilDeparture}d remaining)`,
      badgeText: `${daysUntilDeparture}d out`,
      badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
      description:
        proxDiff < 0
          ? "Low occupancy at departure day yields a discount instead of a last-minute price hike"
          : proxDiff > 0
            ? "Last-minute booking window with high occupancy increases yield"
            : "Standard departure window",
    });
  }

  // 3. Demand Velocity Surge
  if (demandSurgePercent > 0) {
    factors.push({
      id: "demand",
      icon: "trending_up",
      label: "Demand Velocity Surge",
      badgeText: `+${demandSurgePercent}%`,
      badgeColor: "bg-rose-100 text-rose-900 border-rose-300",
      description: "High volume of recent bookings for this route",
    });
  }

  // 4. Weekend Travel
  if (weekendMultiplier > 1) {
    const wPct = Math.round((weekendMultiplier - 1) * 100);
    factors.push({
      id: "weekend",
      icon: "today",
      label: "Weekend Peak Travel",
      badgeText: `+${wPct}%`,
      badgeColor: "bg-indigo-100 text-indigo-900 border-indigo-300",
      description: "High demand travel day adjustment",
    });
  }

  // 5. Holiday Event
  if (holidayMultiplier > 1 || holidayName) {
    const hPct = Math.round((holidayMultiplier - 1) * 100);
    factors.push({
      id: "holiday",
      icon: "celebration",
      label: holidayName ? `${holidayName} Event` : "Holiday Event Surge",
      badgeText: hPct > 0 ? `+${hPct}%` : "Holiday Active",
      badgeColor: "bg-purple-100 text-purple-900 border-purple-300",
      description: "Seasonal holiday surge pricing",
    });
  }

  return (
    <div className="booking-container-card w-full shadow-xs animate-fade-in transition-all duration-300 border border-slate-200/80 bg-white/90 backdrop-blur-md rounded-3xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-900">
            <span className="material-symbols-outlined text-lg">auto_awesome</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-950">
              Dynamic Price Breakdown
            </h3>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[8px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
          LIVE
        </span>
      </div>

      {/* Base vs Final Summary Banner */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3.5 mb-4 flex items-center justify-between">
        <div>
          <span className="text-[11px] text-slate-600 font-medium block">Route Base Price</span>
          <span className="text-sm font-bold text-slate-700 line-through">
            {formatCurrency(basePrice)}
          </span>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-[11px] font-semibold text-slate-600">Calculated Base Fare</span>
            {overallPercentChange !== 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${overallPercentChange > 0
                    ? "bg-rose-100 text-rose-800"
                    : "bg-emerald-100 text-emerald-800"
                  }`}
              >
                {overallPercentChange > 0 ? `+${overallPercentChange}%` : `${overallPercentChange}%`}
              </span>
            )}
          </div>
          <span className="text-lg font-extrabold text-slate-950">
            {formatCurrency(finalPrice)}
          </span>
        </div>
      </div>

      {/* Pricing Factor Details */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-slate-600 block mb-1">
          Active Price Modifiers
        </span>

        {/* Base Price Component */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-base text-slate-600">sell</span>
            <div>
              <span className="text-xs font-semibold text-slate-800 block">Baseline Fare</span>
              <span className="text-[10px] text-slate-600">Standard route pricing tier</span>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-900">{formatCurrency(basePrice)}</span>
        </div>

        {/* Dynamic Modifiers */}
        {factors.map((factor) => (
          <div
            key={factor.id}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-base text-slate-700">
                {factor.icon}
              </span>
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  {factor.label}
                </span>
                <span className="text-[10px] text-slate-600">{factor.description}</span>
              </div>
            </div>

            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${factor.badgeColor}`}
            >
              {factor.badgeText}
            </span>
          </div>
        ))}
      </div>

      {/* Formula Footer */}
      <div className="mt-4 pt-3 border-t border-slate-200/60 text-[11px] text-slate-600 flex items-center justify-between">
        <span className="flex items-center gap-1 font-medium">
          <span className="material-symbols-outlined text-sm text-slate-600">info</span>
          Evaluated via Dynamic Pricing Rules
        </span>
        <span className="font-bold text-slate-800">
          {overallDiff !== 0
            ? `${overallDiff > 0 ? "+" : ""}${formatCurrency(overallDiff)} Adjustment`
            : "Baseline"}
        </span>
      </div>
    </div>
  );
}
