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

  const grandTotal = Number(detailData?.display_total_price || detailData?.total_price || detailData?.price || 0);
  const seatCount = detailData?.seat_count || passengers.length || 1;
  const subTotal = grandTotal > 0 ? Math.round(grandTotal / 1.12) : 0;
  
  const displayCurrency = detailData?.display_currency || detailData?.flight?.fares?.[cabinClass]?.display_currency || "INR";
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: displayCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Calculate meal total
  let mealTotal = 0;
  passengers.forEach(p => {
    (p.selected_meals || p.meals || []).forEach(m => {
       const qty = m.quantity || 1;
       const price = Number(m.display_price || m.unit_price || m.food_item?.display_price || m.flight_meal?.display_price || 0);
       mealTotal += (qty * price);
    });
  });

  // Calculate extra baggage total
  let extraBaggageTotal = 0;
  passengers.forEach(p => {
    extraBaggageTotal += Number(p.display_extra_baggage_cost || p.extra_baggage_cost || 0);
  });

  // Calculate base fare
  let baseFareTotal = Number(detailData?.base_fare) || 0;
  if (!baseFareTotal) {
      const fareObj = flight?.fares?.[cabinClass] || (flight?.fares ? Object.values(flight.fares)[0] : null);
      const baseFarePerPax = fareObj ? Number(fareObj.display_price || fareObj.price) : Number(flight?.base_fare || 0);
      baseFareTotal = baseFarePerPax * seatCount;
  }

  // Calculate seat total by taking what's left
  let seatTotal = Math.max(0, subTotal - baseFareTotal - mealTotal - extraBaggageTotal);

  // Safety fallback if fare data doesn't align
  if (subTotal - baseFareTotal - mealTotal - extraBaggageTotal < -2) {
      baseFareTotal = subTotal;
      seatTotal = 0;
      mealTotal = 0;
      extraBaggageTotal = 0;
  }

  const taxesCalc = grandTotal - subTotal;
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
      <FlightItineraryCard
        flight={flight}
        showBadge={false}
        selectedCabinClass={cabinClass}
        overrideCheckedBaggage={
          passengers?.[0]?.free_baggage_allowance_kg !== undefined && passengers?.[0]?.free_baggage_allowance_kg !== null
            ? Math.round(Number(passengers[0].free_baggage_allowance_kg))
            : undefined
        }
        overrideHandbag={
          passengers?.[0]?.free_handbag_allowance_kg !== undefined && passengers?.[0]?.free_handbag_allowance_kg !== null
            ? Math.round(Number(passengers[0].free_handbag_allowance_kg))
            : undefined
        }
      />

      {/* Passenger List Box */}
      <div className="px-5 pb-5 space-y-3">
        <h4 className="text-xs font-bold text-slate-500 tracking-wide mb-5">
          Passenger Details ({passengers.length || seatCount})
        </h4>
        <div className="flex flex-col gap-3">
          {passengers.length > 0 ? (
            passengers.map((p, idx) => {
              const allMeals = p.meals || p.selected_meals || [];
              const paidMeals = allMeals.filter(
                (m) => Number(m.unit_price || m.price || 0) > 0 || (Boolean(m.food_item_name) && !m.flight_meal_name)
              );
              const compMealObj = allMeals.find(
                (m) => Number(m.unit_price || m.price || 0) === 0 && Boolean(m.flight_meal_name || m.flight_meal_id || m.flight_meal)
              );

              const compMealName =
                compMealObj?.flight_meal_name ||
                compMealObj?.name ||
                (p.meal_preference === "VEG"
                  ? "Veg Meal Box"
                  : p.meal_preference === "NON_VEG"
                    ? "Non-Veg Meal Box"
                    : null);

              const genderLabel =
                p.gender === "F" || p.gender === "FEMALE"
                  ? "Female"
                  : p.gender === "M" || p.gender === "MALE"
                    ? "Male"
                    : p.gender || "Passenger";

              const extraKg = Number(p.extra_baggage_kg || 0);
              const extraCost = Number(p.display_extra_baggage_cost || p.extra_baggage_cost || 0);

              const fareObj = flight?.fares?.[cabinClass] || (flight?.fares ? Object.values(flight.fares)[0] : null);
              const freeBaggageKg = Math.round(
                Number(
                  p.free_baggage_allowance_kg ??
                  fareObj?.effective_baggage_allowance_kg ??
                  fareObj?.baggage_allowance ??
                  flight.baggage_weight_allowed_per_person ??
                  20
                )
              );
              const freeHandbagKg = Math.round(
                Number(
                  p.free_handbag_allowance_kg ??
                  fareObj?.effective_handbag_allowance_kg ??
                  fareObj?.handbag_allowance ??
                  flight.handbag_weight_allowed_per_person ??
                  7
                )
              );

              return (
                <div key={idx} className="timeline-card p-3.5 flex flex-col gap-2 font-medium">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400 text-xl">
                        person
                      </span>
                      <div>
                        <p className="font-bold text-slate-950 text-sm">
                          {p.name || p.full_name || `Passenger ${idx + 1}`}
                        </p>
                        <p className="text-slate-500 text-[10px] mt-0.5">
                          {genderLabel}{p.age ? `, ${p.age} yrs` : ""}
                        </p>
                      </div>
                    </div>

                    {p.seat_number && (
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                        Seat {p.seat_number}
                      </span>
                    )}
                  </div>

                  {/* Options & Baggage Breakdown */}
                  <div className="receipt-container">
                    {/* Free Baggage Snapshot Row */}
                    <div className="receipt-row receipt-row-muted">
                      <div className="receipt-item-label">
                        <span className="material-symbols-outlined text-xs text-emerald-600">
                          work
                        </span>
                        <span>{freeBaggageKg} kg Checked | {freeHandbagKg} kg Handbag</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200/80">
                        Included
                      </span>
                    </div>

                    {/* Extra Baggage Row if purchased */}
                    {extraKg > 0 && (
                      <div className="receipt-row receipt-row-muted">
                        <div className="receipt-item-label">
                          <span className="material-symbols-outlined text-xs text-indigo-600">
                            luggage
                          </span>
                          <span>+{extraKg} kg Extra Luggage</span>
                        </div>
                        <div className="receipt-item-price">
                          {formatCurrency(extraCost)}
                        </div>
                      </div>
                    )}

                    {/* Complimentary Meal Row */}
                    {compMealName && p.meal_preference !== "NONE" && (
                      <div className="receipt-row receipt-row-muted">
                        <div className="receipt-item-label">
                          <span className="material-symbols-outlined text-xs text-emerald-600">
                            restaurant
                          </span>
                          <span>{compMealName}</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200/80">
                          Included
                        </span>
                      </div>
                    )}

                    {/* Paid Meals Row */}
                    {paidMeals.map((m, mIdx) => {
                      const mealName =
                        m.food_item_name ||
                        m.name ||
                        m.food_item?.name ||
                        "Pre-ordered Item";
                      const qty = m.quantity || 1;
                      const itemPrice = Number(m.display_price || m.unit_price || m.price || 0);
                      const subtotal = itemPrice * qty;

                      return (
                        <div key={mIdx} className="receipt-row receipt-row-muted">
                          <div className="receipt-item-label">
                            <span className="material-symbols-outlined text-xs text-amber-600">
                              shopping_bag
                            </span>
                            <span>
                              {mealName} {qty > 1 ? <span className="font-medium text-slate-950 ml-1">x{qty}</span> : ""}
                            </span>
                          </div>
                          {itemPrice > 0 && (
                            <div className="receipt-item-price">
                              {formatCurrency(subtotal)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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

      {/* Fare Summary Breakdown */}
      <div className="px-5 pb-5 space-y-3">
        <h4 className="text-xs font-bold text-slate-500 tracking-wider mb-6">
          Payment Summary
        </h4>
        <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
          <span>Base Fare ({seatCount} seat{seatCount > 1 ? "s" : ""})</span>
          <span className="font-bold text-slate-950">{formatCurrency(baseFareTotal)}</span>
        </div>

        {seatTotal > 0 && (
          <div className="flex items-center justify-between text-xs text-blue-700 font-medium mt-2">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">airline_seat_recline_normal</span>
              Seat Fare
            </span>
            <span className="font-bold text-blue-900">{formatCurrency(seatTotal)}</span>
          </div>
        )}

        {mealTotal > 0 && (
          <div className="flex items-center justify-between text-xs text-amber-700 font-medium mt-2">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">restaurant</span>
              In-Flight Meals
            </span>
            <span className="font-bold text-amber-900">{formatCurrency(mealTotal)}</span>
          </div>
        )}

        {extraBaggageTotal > 0 && (
          <div className="flex items-center justify-between text-xs text-indigo-700 font-medium mt-2">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">luggage</span>
              Extra Luggage
            </span>
            <span className="font-bold text-indigo-900">{formatCurrency(extraBaggageTotal)}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-600 font-medium mt-2 pb-3">
          <span>Taxes & Service Charges (12%)</span>
          <span className="font-bold text-slate-950">{formatCurrency(taxesCalc)}</span>
        </div>
        <div className="flex items-center justify-between text-base font-extrabold text-slate-950 pt-3 border-t border-slate-200/80">
          <span>Total Amount</span>
          <span>{formatCurrency(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
