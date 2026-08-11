import React from "react";
import FlightItineraryCard from "@/components/flights/FlightItineraryCard";

export default function TicketInvoice({ detailData, isWaitlist = false, locationStateFlight = null, locationStatePassengers = null }) {
  if (!detailData) return null;

  const flight = detailData?.flight_detail || detailData?.flight || locationStateFlight || {};
  const passengers = detailData?.passengers || locationStatePassengers || [];
  const cabinClass = (detailData?.cabin_class || "ECONOMY").toUpperCase();

  const cabinLabelMap = {
    ECONOMY: "Economy",
    BUSINESS: "Business",
    FIRST: "First Class"
  };

  const grandTotal = Number(detailData?.total_price || detailData?.price || 0);
  const seatCount = detailData?.seat_count || passengers.length || 1;
  const subTotal = grandTotal > 0 ? Math.round(grandTotal / 1.12) : 0;
  const taxesCalc = grandTotal - subTotal;

  // Calculate meal total
  let mealTotal = 0;
  passengers.forEach(p => {
    (p.selected_meals || p.meals || []).forEach(m => {
       const qty = m.quantity || 1;
       const price = Number(m.unit_price || m.food_item?.price || m.flight_meal?.price || 0);
       mealTotal += (qty * price);
    });
  });

  // Calculate base fare
  let baseFareTotal = Number(detailData?.base_fare) || 0;
  if (!baseFareTotal) {
      const fareObj = flight?.fares?.[cabinClass] || (flight?.fares ? Object.values(flight.fares)[0] : null);
      const baseFarePerPax = fareObj ? Number(fareObj.price) : Number(flight?.base_fare || 0);
      baseFareTotal = baseFarePerPax * seatCount;
  }

  // Calculate seat total by taking what's left
  let seatTotal = Math.max(0, subTotal - baseFareTotal - mealTotal);

  // Safety fallback if fare data doesn't align
  if (subTotal - baseFareTotal - mealTotal < -2) {
      baseFareTotal = subTotal;
      seatTotal = 0;
      mealTotal = 0;
  }

  const ticketStatus = (detailData?.status || "CONFIRMED").toUpperCase();

  const getTicketStatusBadge = () => {
    if (ticketStatus === "EXPIRED") {
      return (
        <span className="bg-slate-200 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
          Expired
          <span className="material-symbols-outlined text-sm">hourglass_disabled</span>
        </span>
      );
    }

    if (ticketStatus === "CANCELLED") {
      return (
        <span className="bg-rose-100 border border-rose-300 text-rose-950 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
          Cancelled
          <span className="material-symbols-outlined text-sm">cancel</span>
        </span>
      );
    }

    if (isWaitlist) {
      return (
        <span className="bg-amber-100 border border-amber-300 text-amber-950 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
          {detailData?.queue_position ? `Waitlisted #${detailData.queue_position}` : "Waitlisted"}
          <span className="material-symbols-outlined text-sm">hourglass_top</span>
        </span>
      );
    }

    return (
      <span className="bg-emerald-100 border border-emerald-300 text-emerald-950 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs">
        Confirmed
        <span className="material-symbols-outlined text-sm">check_circle</span>
      </span>
    );
  };

  return (
    <div className="booking-container-card w-full space-y-6 shadow-xs text-slate-900 animate-fade-in">
      {/* Invoice Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mx-5 border-b border-slate-300/80">
        <div>
          <span className="text-xs font-bold text-slate-500 tracking-wide block">
            {isWaitlist ? "Waitlist ID" : "Booking ID"}
          </span>
          <span className="text-sm font-bold text-slate-950">
            #{detailData?.id ? String(detailData.id).slice(0, 8).toUpperCase() : "BK-893041"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-slate-100 border border-slate-200 text-slate-800 px-3 py-1 rounded-xl text-xs font-bold">
            {cabinLabelMap[cabinClass] || cabinClass}
          </span>
          {getTicketStatusBadge()}
        </div>
      </div>

      {/* Reused Flight Itinerary Card */}
      <FlightItineraryCard flight={flight} showBadge={false} />

      {/* Passenger List Box (Reuses timeline-card) */}
      <div className="px-5 pb-5 space-y-3">
        <h4 className="text-xs font-bold text-slate-500 tracking-wide mb-5">
          Passenger Details ({passengers.length || seatCount})
        </h4>
        <div className="flex flex-col gap-3">
          {passengers.length > 0 ? (
            passengers.map((p, idx) => {
              const passengerMeals = p.meals || p.selected_meals || [];
              return (
                <div key={idx} className="timeline-card p-3.5 flex flex-col gap-2 font-medium">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400 text-xl">
                        person
                      </span>
                      <div>
                        <p className="font-bold text-slate-950 text-sm">{p.name || p.full_name || `Passenger ${idx + 1}`}</p>
                        <p className="text-slate-500 text-[10px] mt-0.5">{p.gender === "F" ? "Female" : p.gender === "M" ? "Male" : p.gender || "Passenger"}, {p.age} yrs</p>
                      </div>
                    </div>

                    {p.seat_number && (
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                        Seat {p.seat_number}
                      </span>
                    )}
                  </div>

                  {p.meal_preference && p.meal_preference !== "NONE" && (
                    <div className="mt-1 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">restaurant_menu</span>
                        Complimentary Meal:
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-md">
                        {p.meal_preference === "VEG" ? "Veg Meal Box" : "Non-Veg Gourmet Box"}
                      </span>
                    </div>
                  )}

                  {passengerMeals.length > 0 && (
                    <div className="mt-1 pt-2 border-t border-slate-200/80 flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">restaurant</span>
                        Pre-ordered Meals:
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {passengerMeals.map((m, mIdx) => {
                          const mealName = m.food_item?.name || m.flight_meal?.name || m.name || "In-Flight Meal";
                          const qty = m.quantity || 1;
                          return (
                            <span key={mIdx} className="inline-flex items-center text-[10px] font-bold bg-amber-50 text-amber-950 border border-amber-200/70 px-2 py-0.5 rounded-md">
                              {mealName} {qty > 1 ? `x${qty}` : ""}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="timeline-card p-3 text-xs font-medium text-slate-600">
              {seatCount} Passenger(s)
            </div>
          )}
        </div>
      </div>

      {/* Fare Summary Breakdown (Reuses timeline-card) */}
      <div className="px-5 pb-5 space-y-3">
        <h4 className="text-xs font-bold text-slate-500 tracking-wider mb-6">
          Payment Summary
        </h4>
        <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
          <span>Base Fare ({seatCount} seat{seatCount > 1 ? "s" : ""})</span>
          <span className="font-bold text-slate-950">₹ {baseFareTotal.toLocaleString("en-IN")}</span>
        </div>

        {seatTotal > 0 && (
          <div className="flex items-center justify-between text-xs text-blue-700 font-medium mt-2">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">airline_seat_recline_normal</span>
              Seat Fare
            </span>
            <span className="font-bold text-blue-900">₹ {seatTotal.toLocaleString("en-IN")}</span>
          </div>
        )}

        {mealTotal > 0 && (
          <div className="flex items-center justify-between text-xs text-amber-700 font-medium mt-2">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">restaurant</span>
              In-Flight Meals
            </span>
            <span className="font-bold text-amber-900">₹ {mealTotal.toLocaleString("en-IN")}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-600 font-medium mt-2 pb-3">
          <span>Taxes & Service Charges (12%)</span>
          <span className="font-bold text-slate-950">₹ {taxesCalc.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between text-base font-extrabold text-slate-950 pt-3 border-t border-slate-200/80">
          <span>Total Amount</span>
          <span>₹ {grandTotal.toLocaleString("en-IN")}</span>
        </div>
      </div>
    </div>
  );
}
