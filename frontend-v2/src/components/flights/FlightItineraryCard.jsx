import { getAirportInfo } from "@/utils/airportHelpers";

export default function FlightItineraryCard({ flight, showBadge = true, isWaitlistedOverride, selectedCabinClass = "Economy" }) {
  if (!flight) return null;

  const {
    flight_number = "6E-2382",
    airline = "IndiGo",
    aircraft = "Airbus A320",
    source_airport = "COK",
    destination_airport = "DEL",
    departure_time,
    arrival_time,
    available_seats = 0,
    waitlist_count = 0,
    stops = [],
    fares
  } = flight;

  // Determine active fare and availability for the selected cabin class
  const getFareForCabin = (cabin) => {
    if (!fares) return null;
    const norm = (cabin || "Economy").toUpperCase().replace(/\s+/g, "_");
    if (fares[norm]) return fares[norm];
    if (norm.includes("BUSINESS") && fares["BUSINESS"]) return fares["BUSINESS"];
    if (norm.includes("FIRST") && fares["FIRST"]) return fares["FIRST"];
    if (fares["ECONOMY"]) return fares["ECONOMY"];
    return null;
  };

  const activeFare = getFareForCabin(selectedCabinClass);
  const activeSeats = activeFare !== null ? activeFare.available_seats : available_seats;
  const isWaitlisted = isWaitlistedOverride !== undefined ? Boolean(isWaitlistedOverride) : Number(activeSeats) === 0;
  const queueCount = waitlist_count;

  const sourceInfo = getAirportInfo(source_airport);
  const destInfo = getAirportInfo(destination_airport);

  // Date and Time formatting
  const formatDateTime = (isoString) => {
    if (!isoString) return { dateStr: "-", timeStr: "--:--", fullDateStr: "-" };
    const d = new Date(isoString);
    const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    const dayNum = d.getDate();
    const monthShort = d.toLocaleString("en-US", { month: "short" });
    const dateStr = `${dayNum} ${monthShort}`;
    const fullDateStr = d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return { dateStr, timeStr, fullDateStr };
  };

  const toTitleCase = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const depTime = departure_time || flight.scheduled_departure;
  const arrTime = arrival_time || flight.scheduled_arrival;

  const dep = formatDateTime(depTime);
  const arr = formatDateTime(arrTime);

  // Process transit stops array
  const processedStops = (() => {
    if (!Array.isArray(stops) || stops.length === 0) return [];

    return stops.map((stopItem, index) => {
      let code = "";
      let city = "";
      let name = "";
      let stopDepIso = null;
      let stopArrIso = null;
      let layoverMins = 0;

      if (typeof stopItem === "string") {
        const info = getAirportInfo(stopItem);
        city = info.city || stopItem;
        code = info.code || stopItem;
        name = info.name || `${code} Airport`;
      } else if (typeof stopItem === "object" && stopItem !== null) {
        code = stopItem.airport || stopItem.iata_code || stopItem.code || "";
        city = stopItem.city || "";
        name = stopItem.airport_name || stopItem.name || "";
        stopArrIso = stopItem.arrival_time;
        stopDepIso = stopItem.departure_time;
        layoverMins = stopItem.layover_minutes || 0;

        const info = getAirportInfo(code || city);
        if (info) {
          if (!code || code.length > 3) code = info.code;
          if (!city || city === code) city = info.city;
          if (!name || (name.toUpperCase().includes("AIRPORT") && name.split(" ").length <= 2)) {
            name = info.name;
          }
        }
      }

      // Interpolate transit times if not directly present
      if (!stopArrIso || !stopDepIso) {
        const startMs = new Date(depTime).getTime();
        const endMs = new Date(arrTime).getTime();
        const totalDurationMs = Math.max(1, endMs - startMs);
        const segmentCount = stops.length + 1;
        const fraction = (index + 1) / segmentCount;

        const approxArrMs = startMs + totalDurationMs * fraction - 45 * 60 * 1000;
        const approxDepMs = approxArrMs + 90 * 60 * 1000;

        stopArrIso = new Date(approxArrMs).toISOString();
        stopDepIso = new Date(approxDepMs).toISOString();
      }

      const arrFmt = formatDateTime(stopArrIso);
      const depFmt = formatDateTime(stopDepIso);

      return {
        code: code.toUpperCase(),
        city: toTitleCase(city),
        name: toTitleCase(name),
        arrTimeStr: arrFmt.timeStr,
        depTimeStr: depFmt.timeStr,
        arrDateStr: arrFmt.dateStr,
        layoverMins,
      };
    });
  })();

  // Duration calculation
  const calculateDuration = (depIso, arrIso) => {
    if (!depIso || !arrIso) return "0h 0m";
    const depMs = new Date(depIso).getTime();
    const arrMs = new Date(arrIso).getTime();
    const diffMins = Math.max(0, Math.floor((arrMs - depMs) / (1000 * 60)));
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h ${m}m`;
  };

  const durationStr = calculateDuration(depTime, arrTime);
  const stopCount = Array.isArray(stops) ? stops.length : typeof stops === "number" ? stops : 0;
  const stopsStr = stopCount === 0 ? "Non-stop" : `${stopCount} Stop${stopCount > 1 ? "s" : ""}`;

  return (
    <div className="booking-container-card animate-fade-in transition-all duration-300 relative">
      {/* Top Header Row: Route Title & Optional Seat/Waitlist Status Badge */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <h2 className="text-xl font-bold text-slate-950">
          {sourceInfo.city} &rarr; {destInfo.city}
        </h2>

        {/* Status Badge on Top Right */}
        {showBadge && (
          isWaitlisted ? (
            <div className="absolute right-5 w-24 h-16 flex flex-col items-center gap-1.5 bg-amber-100/90 border border-amber-300/90 text-amber-950 px-3.5 py-1.5 rounded-2xl shadow-2xs font-bold text-xs">
              <span>Waitlist</span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-lg text-amber-800 font-bold select-none">
                  people
                </span>
                <span className="font-bold text-lg">{queueCount}</span>
              </span>
            </div>
          ) : (
            <div className="absolute right-5 w-24 h-16 flex flex-col items-center gap-1.5 bg-emerald-100/90 border border-emerald-300/90 text-emerald-950 px-3.5 py-1.5 rounded-2xl shadow-2xs font-bold text-xs">
              <span>Available</span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-lg text-emerald-800 font-bold select-none">
                  event_seat
                </span>
                <span className="font-bold text-lg">{activeSeats}</span>
              </span>
            </div>
          )
        )}
      </div>

      {/* Flight Meta Info */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 mb-5">
        <span>{dep.fullDateStr}</span>
        <span>&bull;</span>
        <span>{stopsStr}</span>
        <span>&bull;</span>
        <span>{durationStr}</span>
      </div>

      {/* Airline Badge & Square Meal Badge */}
      <div className="flex items-center gap-3 mb-8">
        <div className="inline-flex items-center gap-6 sm:gap-10 bg-sky-100/70 border border-sky-200/60 rounded-xl p-2">
          <span className="text-xs font-bold text-slate-900">{airline}</span>
          <span className="inline-flex items-center gap-3">
            <span className="text-xs font-medium text-slate-600">
              {flight_number}
            </span>
            <span className="text-xs font-medium text-slate-600">
              {aircraft}
            </span>
          </span>
        </div>

        {activeFare?.meal_included && (
          <div
            className="w-9 h-9 rounded-xl bg-amber-100/90 border border-amber-300/80 text-amber-950 flex items-center justify-center shadow-2xs flex-shrink-0"
            title="Complimentary Meal Included"
          >
            <span className="material-symbols-outlined text-lg text-amber-800 font-bold select-none">
              restaurant
            </span>
          </div>
        )}
      </div>

      {/* Vertical Timeline Route Details Container */}
      <div className="relative space-y-4">
        {/* Departure Timeline Box */}
        <div className="timeline-card flex justify-between relative z-10 transition-all duration-300">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <span className="text-lg -mt-5 font-bold tracking-wide text-center text-slate-950 min-w-[60px]">
              {dep.timeStr}
            </span>

            {/* Yellow Circle Connector Node */}
            <div className="w-4 h-4 -mt-5 rounded-full bg-[#ffeb00] border border-slate-950 flex-shrink-0 relative z-20" />

            <div className="min-w-0 space-y-1">
              <h4 className="text-lg font-bold text-slate-950 truncate">
                {sourceInfo.city}
              </h4>
              <p className="text-xs text-slate-500 font-medium truncate">
                {source_airport}, {sourceInfo.name}
              </p>
            </div>
          </div>

          <span className="text-xs font-medium text-slate-950 whitespace-nowrap ml-2">
            {dep.dateStr}
          </span>
        </div>

        {/* Connecting Vertical Timeline Line */}
        <div className="absolute left-[78px] sm:left-[108px] top-[20px] bottom-[32px] w-[2px] bg-slate-300 z-0" />

        {/* Transit Airport Timeline Box(es) */}
        {processedStops.map((stop, idx) => (
          <div
            key={idx}
            className="bg-[#fffdf0] border border-[#fde68a] rounded-2xl px-4 py-5 shadow-2xs flex justify-between relative z-10 transition-all duration-300"
          >
            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
              {/* Arrival & Departure Times Stacked */}
              <div className="flex flex-col gap-1.5 items-center justify-center text-center min-w-[60px]">
                <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
                  <span>{stop.arrTimeStr}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-slate-950">
                  <span>{stop.depTimeStr}</span>
                </div>
              </div>

              {/* Black Circle Connector Node for Transit */}
              <div className="w-4 h-4 rounded-full bg-slate-950 border border-slate-950 flex-shrink-0 relative z-20" />

              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-bold text-slate-950 truncate">
                    {stop.city}
                  </h4>
                  <span className="text-[10px] font-semibold bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded-md">
                    Transit
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate">
                  {stop.code}, {stop.name}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 items-end justify-center min-w-0 ml-2">
              <span className="text-xs font-medium text-slate-950 whitespace-nowrap">
                {stop.arrDateStr}
              </span>
              {stop.layoverMins > 0 && (
                <span className="text-[10px] font-medium text-amber-800 whitespace-nowrap">
                  {Math.floor(stop.layoverMins / 60)}h {stop.layoverMins % 60}m
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Arrival Timeline Box */}
        <div className="timeline-card flex justify-between relative z-10 transition-all duration-300">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <span className="text-lg -mt-5 font-bold tracking-wide text-center text-slate-950 min-w-[60px]">
              {arr.timeStr}
            </span>

            {/* Yellow Circle Connector Node */}
            <div className="w-4 h-4 -mt-5 rounded-full bg-[#ffeb00] border border-slate-950 flex-shrink-0 relative z-20" />

            <div className="min-w-0 space-y-1">
              <h4 className="text-lg font-bold text-slate-950 truncate">
                {destInfo.city}
              </h4>
              <p className="text-xs text-slate-500 font-medium truncate">
                {destination_airport}, {destInfo.name}
              </p>
            </div>
          </div>

          <span className="text-xs font-medium text-slate-950 whitespace-nowrap ml-2">
            {arr.dateStr}
          </span>
        </div>
      </div>
    </div>
  );
}
