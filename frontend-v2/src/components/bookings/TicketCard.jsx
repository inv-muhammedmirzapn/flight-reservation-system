import { useNavigate } from "react-router-dom";

export default function TicketCard({ item, isPastView = false }) {
  const navigate = useNavigate();

  if (!item) return null;

  const isWaitlist = item.itemType === "WAITLIST" || Boolean(item.queue_position !== undefined && item.queue_position !== null);
  const flight = item.flight_detail || item.flight || {};

  const cabinClass = (item?.cabin_class || "ECONOMY").toUpperCase();
  const fareObj = flight?.fares?.[cabinClass] || (flight?.fares ? Object.values(flight.fares)[0] : null);
  const passengers = item?.passengers || [];
  const paxCount = passengers.length || item?.seat_count || 1;
  const firstPax = passengers[0];

  const totalExtraBaggageKg = passengers.reduce(
    (sum, p) => sum + Math.round(Number(p.extra_baggage_kg || 0)),
    0
  );

  const baseCheckedKg = Math.round(
    Number(
      firstPax?.free_baggage_allowance_kg ??
      item?.free_baggage_allowance_kg ??
      fareObj?.effective_baggage_allowance_kg ??
      fareObj?.baggage_allowance ??
      flight.baggage_weight_allowed_per_person ??
      20
    )
  );

  const handbagKg = Math.round(
    Number(
      firstPax?.free_handbag_allowance_kg ??
      item?.free_handbag_allowance_kg ??
      fareObj?.effective_handbag_allowance_kg ??
      fareObj?.handbag_allowance ??
      flight.handbag_weight_allowed_per_person ??
      7
    )
  );

  const isMealIncluded = Boolean(
    fareObj?.meal_included ??
      flight.meal_included ??
      Object.values(flight.fares || {}).some((f) => f?.meal_included)
  );

  // Real Booking Info Calculations
  const baggageSummaryText = totalExtraBaggageKg > 0
    ? `${baseCheckedKg * paxCount + totalExtraBaggageKg} kg (${baseCheckedKg * paxCount}kg + ${totalExtraBaggageKg}kg extra)`
    : paxCount > 1
      ? `${baseCheckedKg * paxCount} kg Total (${baseCheckedKg}kg/pax · ${handbagKg}kg cabin)`
      : `${baseCheckedKg} kg Checked · ${handbagKg} kg Cabin`;

  const seatNumbers = passengers
    .map((p) => p.seat_number)
    .filter(Boolean);

  const seatsText = seatNumbers.length > 0
    ? seatNumbers.length === 1 ? `Seat ${seatNumbers[0]}` : `Seats ${seatNumbers.join(", ")}`
    : "No seat selected";

  const mealItems = [];
  passengers.forEach((p) => {
    const meals = p.selected_meals || p.meals || [];
    meals.forEach((m) => {
      const name = m.food_item_name || m.flight_meal_name || m.name || m.food_item?.name;
      if (name && !mealItems.includes(name)) {
        mealItems.push(name);
      }
    });
    if (meals.length === 0 && p.meal_preference && p.meal_preference !== "NONE") {
      const prefLabel = p.meal_preference === "VEG" ? "Veg Meal" : p.meal_preference === "NON_VEG" ? "Non-Veg Meal" : p.meal_preference;
      if (!mealItems.includes(prefLabel)) {
        mealItems.push(prefLabel);
      }
    }
  });

  const mealSummaryText = mealItems.length > 0
    ? mealItems.join(", ")
    : isMealIncluded
      ? "Complimentary Meal"
      : "No Meal Selected";

  // Formats timestamp for black top header: e.g. 08:57 on 10th July, 2026
  const formatHeaderTimestamp = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    const day = d.getDate();
    
    const getOrdinal = (n) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    return `${hours}:${mins} on ${getOrdinal(day)} ${month}, ${year}`;
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return { dateStr: "-", timeStr: "--:--" };
    const d = new Date(isoString);
    const day = d.getDate();
    const monthLong = d.toLocaleString("en-US", { month: "short" });
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return {
      dateStr: `${day} ${monthLong}`,
      timeStr: `${hours}:${minutes}`
    };
  };

  const calculateDuration = (depIso, arrIso) => {
    if (!depIso || !arrIso) return "0h 0m";
    const depMs = new Date(depIso).getTime();
    const arrMs = new Date(arrIso).getTime();
    const diffMins = Math.max(0, Math.floor((arrMs - depMs) / (1000 * 60)));
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h ${m}m`;
  };

  const shortId = item.id ? String(item.id).slice(0, 8).toUpperCase() : "523A6FE6";
  const headerTime = formatHeaderTimestamp(item.created_at);

  const depTime = flight.departure_time || flight.scheduled_departure;
  const arrTime = flight.arrival_time || flight.scheduled_arrival;

  const dep = formatDateTime(depTime);
  const arr = formatDateTime(arrTime);

  const durationStr = calculateDuration(depTime, arrTime);

  const stops = flight.stops;
  const stopCount = Array.isArray(stops) ? stops.length : typeof stops === "number" ? stops : 0;
  const stopsStr = stopCount === 0 ? "Non-stop" : `${stopCount} Stop${stopCount > 1 ? "s" : ""}`;

  const passengerCount = item.passengers?.length || item.seat_count || 1;

  // Flight Status Badge
  const flightStatus = (flight.status || "SCHEDULED").toUpperCase();
  const getFlightStatusBadge = () => {
    if (flightStatus === "DELAYED") {
      return (
        <span className="bg-amber-400 text-amber-950 px-2 py-0.5 sm:py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 shrink-0">
          Delayed
          <span className="material-symbols-outlined text-xs sm:text-sm select-none">schedule</span>
        </span>
      );
    }
    if (flightStatus === "CANCELLED") {
      return (
        <span className="bg-rose-400 text-rose-950 px-2 py-0.5 sm:py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 shrink-0">
          Cancelled
          <span className="material-symbols-outlined text-xs sm:text-sm select-none">cancel</span>
        </span>
      );
    }
    return (
      <span className="bg-[#7ce47a] text-slate-950 px-2 py-0.5 sm:py-1 rounded-xl text-[10px] font-semibold flex items-center gap-1.5 shrink-0">
        On time
        <span className="material-symbols-outlined text-xs sm:text-sm select-none">flight</span>
      </span>
    );
  };

  // Ticket Status Badge
  const ticketStatus = (item.status || "CONFIRMED").toUpperCase();
  const getTicketStatusBadge = () => {
    if (ticketStatus === "EXPIRED") {
      return (
        <span className="bg-slate-200 text-slate-700 border border-slate-300 px-2 py-0.5 sm:py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 shrink-0">
          Expired
          <span className="material-symbols-outlined text-xs sm:text-sm select-none">hourglass_disabled</span>
        </span>
      );
    }

    if (ticketStatus === "CANCELLED") {
      return (
        <span className="bg-rose-100 text-rose-950 border border-rose-300 px-2 py-0.5 sm:py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 shrink-0">
          Cancelled
          <span className="material-symbols-outlined text-xs sm:text-sm select-none">cancel</span>
        </span>
      );
    }

    if (isWaitlist) {
      return (
        <span className="bg-amber-100 text-amber-950 border border-amber-300 px-2 py-0.5 sm:py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 shrink-0">
          {item.queue_position ? `WL #${item.queue_position}` : "Waitlisted"}
          <span className="material-symbols-outlined text-xs sm:text-sm select-none">hourglass_top</span>
        </span>
      );
    }

    return (
      <span className="bg-white text-slate-950 border border-slate-300/80 px-2 py-0.5 sm:py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 shrink-0">
        Confirmed
        <span className="material-symbols-outlined text-xs sm:text-sm select-none">check_circle</span>
      </span>
    );
  };

  const handleCardClick = () => {
    if (isWaitlist) {
      navigate(`/my-bookings/ticket/waitlist/${item.id}`, {
        state: { waitlist: item, flight, showPastBookings: isPastView }
      });
    } else {
      navigate(`/my-bookings/ticket/${item.id}`, {
        state: { booking: item, flight, showPastBookings: isPastView }
      });
    }
  };

  const getLogoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `http://127.0.0.1:8000${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const rawLogo =
    flight.airline_logo ||
    item.airline_logo ||
    (typeof flight.airline === "object" ? flight.airline?.logo : null);

  const logoSrc = getLogoUrl(rawLogo);
  const airlineName = typeof flight.airline === "object" ? flight.airline?.airline_name || flight.airline?.name : (flight.airline || "Skyline Airways");

  return (
    <div className="group animate-fade-in shadow-sm hover:shadow transition-all mb-4 overflow-hidden rounded-2xl md:rounded-3xl ">
      {/* Top Header Bar */}
      <div className="rounded-t-2xl md:rounded-t-3xl mx-auto bg-slate-950 text-white px-4 sm:px-6 pt-2 pb-6 flex items-center justify-between text-[10px] sm:text-xs font-semibold tracking-wide">
        <span className="text-slate-200">
          {isWaitlist ? "Waitlist ID" : "Booking ID"} #{shortId}
        </span>
        <span className="text-slate-300 font-medium truncate max-w-[200px] sm:max-w-none">
          Booked at {headerTime}
        </span>
      </div>

      {/* Main Ticket Card Container */}
      <div
        onClick={handleCardClick}
        className={`w-full rounded-2xl md:rounded-3xl p-4 sm:p-5 transition-all duration-300 cursor-pointer -mt-4 border ${
          isWaitlist
            ? "bg-amber-50 border-amber-200/80 hover:border-amber-300"
            : "plain-card border-slate-200/70"
        }`}
      >
        {/* ── DESKTOP & TABLET LAYOUT (visible on md: grid) ────────────────────────── */}
        <div className="hidden md:grid md:grid-cols-12 items-center gap-4">

          {/* 1. Airline & Flight Info */}
          <div className="col-span-2 flex flex-col justify-center gap-1 min-w-0">
            <span className="text-xs font-semibold text-slate-500 mb-0.5">
              {flight.flight_number || "SA-224"}
            </span>
            <div className="flex items-center gap-2">
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt={airlineName}
                  className="h-4 max-w-[80px] object-contain"
                />
              )}
              <span className="text-xs font-bold text-slate-900 truncate">
                {airlineName}
              </span>
            </div>
            <span className="text-xs font-extrabold text-slate-950">
              {flight.source_airport} &rarr; {flight.destination_airport}
            </span>
          </div>

          {/* 2. Departure Time & Date */}
          <div className="col-span-2 flex flex-col items-start">
            <span className="text-xs font-semibold text-slate-500 mb-0.5">
              {dep.dateStr}
            </span>
            <span className="text-2xl lg:text-3xl font-bold text-slate-950">
              {dep.timeStr}
            </span>
          </div>

          {/* 3. Arrival Time & Date */}
          <div className="col-span-2 flex flex-col items-start">
            <span className="text-xs font-semibold text-slate-500 mb-0.5">
              {arr.dateStr}
            </span>
            <span className="text-2xl lg:text-3xl font-bold text-slate-950">
              {arr.timeStr}
            </span>
          </div>

          {/* 4. Duration & Stops */}
          <div
            className={`col-span-2 flex flex-col items-center justify-center p-3 rounded-2xl text-center ${
              isWaitlist ? "bg-amber-100/70" : "bg-black/5"
            }`}
          >
            <span className="material-symbols-outlined text-slate-700 text-lg select-none">
              schedule
            </span>
            <span className="text-xs font-bold text-slate-900 mt-0.5 tracking-wide">
              {durationStr}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              {stopsStr}
            </span>
          </div>

          {/* 5. Real Booking Info Column (Seats, Baggage, Meals) */}
          <div className="col-span-2 flex flex-col justify-center gap-1 text-[11px] font-semibold text-slate-600 border-l border-slate-200/60 pl-3 md:pl-4 min-w-0">
            {/* Seat Info */}
            <div className="flex items-center gap-1.5 truncate" title={`Seats: ${seatsText}`}>
              <span className="material-symbols-outlined text-xs text-indigo-600 shrink-0 select-none">
                event_seat
              </span>
              <span className="truncate text-slate-900 font-bold">{seatsText}</span>
            </div>

            {/* Baggage Info */}
            <div className="flex items-center gap-1.5 truncate" title={`Baggage: ${baggageSummaryText}`}>
              <span className="material-symbols-outlined text-xs text-emerald-600 shrink-0 select-none">
                work
              </span>
              <span className="truncate">{baggageSummaryText}</span>
            </div>

            {/* Meal Info */}
            <div className="flex items-center gap-1.5 truncate" title={`Meal: ${mealSummaryText}`}>
              <span className={`material-symbols-outlined text-xs shrink-0 select-none ${mealItems.length > 0 || isMealIncluded ? "text-amber-600" : "text-slate-400"}`}>
                {mealItems.length > 0 || isMealIncluded ? "restaurant" : "no_meals"}
              </span>
              <span className="truncate">{mealSummaryText}</span>
            </div>
          </div>

          {/* 6. Passenger Count & Double Status Badges */}
          <div className="col-span-2 flex items-center justify-end gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 bg-black/5 px-2.5 py-1.5 rounded-xl">
              <span className="material-symbols-outlined text-sm text-slate-700 select-none">person</span>
              <span>{passengerCount}</span>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              {getFlightStatusBadge()}
              {getTicketStatusBadge()}
            </div>
          </div>

        </div>


        {/* ── MOBILE LAYOUT (visible on small screens, hidden on md:) ────────────── */}
        <div className="flex md:hidden flex-col gap-3">

          {/* Top Bar: Airline info & Passenger Count */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt={airlineName}
                  className="h-4 max-w-[60px] object-contain shrink-0"
                />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate">{airlineName}</span>
                <span className="text-[10px] font-semibold text-slate-500">{flight.flight_number || "SA-224"}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
              <span className="material-symbols-outlined text-xs text-slate-700 select-none">person</span>
              <span>{passengerCount}</span>
            </div>
          </div>

          {/* Flight Schedule & Route Line */}
          <div className="flex items-center justify-between gap-2 py-1">
            {/* Departure */}
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-bold text-slate-400">{flight.source_airport}</span>
              <span className="text-xl font-bold text-slate-900 leading-tight">
                {dep.timeStr}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
                {dep.dateStr}
              </span>
            </div>

            {/* Center Graphic / Duration */}
            <div className="flex-1 flex flex-col items-center px-2">
              <span className="text-[10px] font-bold text-slate-600">{durationStr}</span>
              <div className="w-full flex items-center gap-1 my-1">
                <div className="h-[2px] flex-1 bg-slate-200" />
                <span className="material-symbols-outlined text-slate-400 text-xs select-none rotate-90">flight</span>
                <div className="h-[2px] flex-1 bg-slate-200" />
              </div>
              <span className="text-[9px] font-semibold text-slate-400">{stopsStr}</span>
            </div>

            {/* Arrival */}
            <div className="flex flex-col text-right">
              <span className="text-[10px] font-bold text-slate-400">{flight.destination_airport}</span>
              <span className="text-xl font-bold text-slate-900 leading-tight">
                {arr.timeStr}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
                {arr.dateStr}
              </span>
            </div>
          </div>

          {/* Mobile Real Booking Summary Row */}
          <div className="flex flex-col gap-1 py-2 px-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-semibold text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-indigo-600 select-none shrink-0">event_seat</span>
              <span className="font-bold text-slate-900 truncate">{seatsText}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-emerald-600 select-none shrink-0">work</span>
              <span className="truncate">{baggageSummaryText}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`material-symbols-outlined text-xs select-none shrink-0 ${mealItems.length > 0 || isMealIncluded ? "text-amber-600" : "text-slate-400"}`}>
                {mealItems.length > 0 || isMealIncluded ? "restaurant" : "no_meals"}
              </span>
              <span className="truncate">{mealSummaryText}</span>
            </div>
          </div>

          {/* Bottom Bar: Status Badges */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Status
            </span>

            <div className="flex items-center gap-1.5">
              {getFlightStatusBadge()}
              {getTicketStatusBadge()}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
