import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import FlightSearchHeader from "@/components/flights/FlightSearchHeader";
import DateStripCarousel from "@/components/flights/DateStripCarousel";
import FlightCard from "@/components/flights/FlightCard";
import FlightFilterDrawer from "@/components/flights/FlightFilterDrawer";
import { flightsAPI } from "@/services/flight-service/flightService";
import { useDispatch, useSelector } from "react-redux";
import { fetchFlightBounds } from "@/store/flightSlice";
import { formatCurrency } from "@/utils/formatters";

function ConnectingRouteCard({ route, rankLabel, cabinClassParam, navigate }) {
  // Extract hops from route (support both hops structure and legacy route structure)
  const hops = route.hops || (route.route ? route.route.map((leg) => ({ options: [leg] })) : []);

  // State for selected option index per hop: { [hopIndex]: optionIndex }
  const [selectedIndices, _setSelectedIndices] = useState({});

  // Active leg for each hop based on selection
  const activeLegs = hops.map((hop, hIdx) => {
    const sIdx = selectedIndices[hIdx] || 0;
    return hop.options[sIdx] || hop.options[0] || {};
  });

  // Calculate dynamic totals
  const totalFare = activeLegs.reduce((sum, leg) => sum + (leg.min_fare || 0), 0);

  // Time formatting helpers
  const fmtTime = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const fmtDate = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

  // Calculate overall duration from first departure to last arrival if dates available
  let totalDurationMins = route.total_duration_minutes;
  if (activeLegs.length > 0 && activeLegs[0].departure_time && activeLegs[activeLegs.length - 1].arrival_time) {
    const depMs = new Date(activeLegs[0].departure_time).getTime();
    const arrMs = new Date(activeLegs[activeLegs.length - 1].arrival_time).getTime();
    if (arrMs > depMs) {
      totalDurationMins = Math.round((arrMs - depMs) / (1000 * 60));
    }
  }
  const totalHours = Math.floor(totalDurationMins / 60);
  const totalMins = totalDurationMins % 60;

  const getLogoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `http://127.0.0.1:8000${url.startsWith("/") ? "" : "/"}${url}`;
  };

  // Unique airlines among active legs
  const uniqueAirlines = [];
  const seenCodes = new Set();
  activeLegs.forEach((leg) => {
    if (leg.airline_code && !seenCodes.has(leg.airline_code)) {
      seenCodes.add(leg.airline_code);
      uniqueAirlines.push({ name: leg.airline_name, code: leg.airline_code });
    }
  });

  const allLegsBookable = activeLegs.length > 0 && activeLegs.every((leg) => !!leg.instance_id);

  return (
    <div className="w-full plain-card bg-white rounded-2xl md:rounded-3xl p-5 border border-slate-200/80 shadow-sm max-w-5xl mx-auto my-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-extrabold text-slate-900 leading-tight">
            {uniqueAirlines.map((a) => a.name).join(" · ")}
          </p>
          <div>
            <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md uppercase tracking-wider">
              {rankLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end gap-1">
            {totalFare > 0 && (
              <span className="text-base font-extrabold text-slate-900">
                {formatCurrency(Math.round(totalFare), "INR")}
              </span>
            )}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
                <span className="material-symbols-outlined text-[13px] text-slate-400">schedule</span>
                {totalHours}h {totalMins}m
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
                <span className="material-symbols-outlined text-[13px] text-slate-400">trip_origin</span>
                {hops.length - 1} stop{hops.length - 1 !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {allLegsBookable && (
            <button
              type="button"
              onClick={() => {
                const nextLeg = activeLegs[1] || null;
                navigate(`/flights/${activeLegs[0].instance_id}?cabinClass=${encodeURIComponent(cabinClassParam)}`, {
                  state: {
                    nextLeg,
                    connectingJourney: { legs: activeLegs, currentLegIndex: 0 }
                  }
                });
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold btn-primary cursor-pointer shadow-sm whitespace-nowrap"
            >
              Book Journey
            </button>
          )}
        </div>
      </div>

      <div className="h-px bg-slate-100 mb-4" />

      {/* Hops/Legs */}
      <div className="flex flex-col gap-3">
        {hops.map((hop, hopIdx) => {
          // const sIdx = selectedIndices[hopIdx] || 0;
          const leg = activeLegs[hopIdx] || {};

          const depTime = fmtTime(leg.departure_time);
          const arrTime = fmtTime(leg.arrival_time);
          const depDate = fmtDate(leg.departure_time);
          const arrDate = fmtDate(leg.arrival_time);
          const durationH = Math.floor((leg.duration_minutes || 0) / 60);
          const durationM = (leg.duration_minutes || 0) % 60;
          const canBook = !!leg.instance_id;
          const legLogo = getLogoUrl(leg.airline_logo_url);

          // Layover between this leg and previous leg
          let layoverStr = null;
          if (hopIdx > 0) {
            const prevLeg = activeLegs[hopIdx - 1];
            if (prevLeg.arrival_time && leg.departure_time) {
              const layoverMins = Math.round(
                (new Date(leg.departure_time) - new Date(prevLeg.arrival_time)) / 60000
              );
              const lH = Math.floor(layoverMins / 60);
              const lM = layoverMins % 60;
              layoverStr = `${lH}h ${lM}m layover at ${leg.departure_airport}`;
            }
          }

          return (
            <div key={hopIdx}>
              {/* Layover divider */}
              {layoverStr && (
                <div className="flex items-center gap-2 my-2 px-1">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-[9px] font-semibold text-slate-400 whitespace-nowrap">
                    {layoverStr}
                  </span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
              )}

              {/* Leg row */}
              <div className="flex items-center gap-3">
                {/* Airline logo mini */}
                <div className="shrink-0 w-7 h-7 flex items-center justify-center">
                  {legLogo ? (
                    <img
                      src={legLogo}
                      alt={leg.airline_name || "Airline"}
                      className="w-7 h-7 rounded-full object-contain bg-white border border-slate-200 shadow-2xs"
                      onError={(e) => {
                        e.target.style.display = "none";
                        if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] font-extrabold border border-slate-200"
                    style={{ display: legLogo ? "none" : "flex" }}
                  >
                    {leg.airline_code || "FL"}
                  </div>
                </div>

                {/* Left: departure */}
                <div className="flex flex-col items-start min-w-[55px]">
                  {depTime ? (
                    <>
                      <span className="text-lg font-bold text-slate-900 leading-none">{depTime}</span>
                      <span className="text-[10px] font-semibold text-slate-400">{depDate}</span>
                      <span className="text-[10px] font-bold text-slate-500">{leg.departure_airport}</span>
                    </>
                  ) : (
                    <span className="text-xs font-extrabold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {leg.departure_airport}
                    </span>
                  )}
                </div>

                {/* Center: flight info */}
                <div className="flex-1 flex flex-col items-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                      {leg.flight_no}
                    </span>
                    {leg.airline_name && (
                      <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[150px]">
                        · {leg.airline_name}
                      </span>
                    )}
                  </div>

                  <div className="w-full flex items-center gap-1">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="material-symbols-outlined text-slate-400 text-xs rotate-90 select-none">flight</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <span className="text-[9px] font-semibold text-slate-400 mt-0.5">{durationH}h {durationM}m</span>
                </div>

                {/* Right: arrival */}
                <div className="flex flex-col items-end min-w-[55px]">
                  {arrTime ? (
                    <>
                      <span className="text-lg font-bold text-slate-900 leading-none">{arrTime}</span>
                      <span className="text-[10px] font-semibold text-slate-400">{arrDate}</span>
                      <span className="text-[10px] font-bold text-slate-500">{leg.arrival_airport}</span>
                    </>
                  ) : (
                    <span className="text-xs font-extrabold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {leg.arrival_airport}
                    </span>
                  )}
                </div>

                {/* Fare + Book */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {leg.min_fare != null && (
                    <span className="text-[10px] font-bold text-slate-600">
                      {formatCurrency(Math.round(leg.min_fare), "INR")}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!canBook}
                    onClick={() => {
                      if (!canBook) return;
                      const nextLeg = activeLegs[hopIdx + 1] || null;
                      navigate(`/flights/${leg.instance_id}?cabinClass=${encodeURIComponent(cabinClassParam)}`, {
                        state: {
                          nextLeg,
                          connectingJourney: { legs: activeLegs, currentLegIndex: hopIdx }
                        }
                      });
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-[10px] font-bold transition-all
                      ${canBook
                        ? "btn-primary cursor-pointer"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                      }`}
                  >
                    {canBook ? "Book" : "Unavailable"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FlightsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get("from") || "DEL";
  const to = searchParams.get("to") || "HAM";
  const depDate = searchParams.get("depDate") || new Date().toISOString().split("T")[0];
  const cabinClassParam = searchParams.get("cabinClass") || "Economy";

  const [flights, setFlights] = useState([]);
  const [recommendedRoutes, setRecommendedRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFilteredResult, setIsFilteredResult] = useState(true);
  const [showNoDirectModal, setShowNoDirectModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 10;

  const dispatch = useDispatch();
  const { bounds } = useSelector((state) => state.flights);
  // const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(fetchFlightBounds({
      source: from,
      destination: to,
      date: depDate,
      cabin_class: cabinClassParam
    }));
  }, [dispatch, from, to, depDate, cabinClassParam]);

  // Filter drawer state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({
    ordering: "base_fare",
    stops: "",
    airlines: [],
    waitlistMode: "all",
    maxFare: 100000
  });

  // Reset maxFare when core search parameters change (route or cabin class)
  useEffect(() => {
    setFilters(prev => {
      if (prev.maxFare === 100000) return prev; // already reset, skip to avoid extra re-render
      return { ...prev, maxFare: 100000 };
    });
  }, [from, to, cabinClassParam]);

  // Sync draft maxFare when bounds load
  useEffect(() => {
    if (bounds && (bounds.max_price || bounds.max)) {
      const boundMax = bounds.max_price || bounds.max;
      setFilters(prev => {
        const newMax = prev.maxFare === 100000 ? boundMax : prev.maxFare;
        if (prev.maxFare === newMax) return prev;
        return {
          ...prev,
          maxFare: newMax
        };
      });
    }
  }, [bounds]);

  const handleApplyFilters = (newFilters) => {
    setCurrentPage(1);
    setFilters(newFilters);
  };

  const handleResetFilters = (defaultFilters) => {
    setFilters(defaultFilters || {
      ordering: "base_fare",
      stops: "",
      airlines: [],
      waitlistMode: "all",
      maxFare: 100000
    });
  };

  // Fetch flights from database whenever search parameters, applied filters, or page changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setShowNoDirectModal(false);

    async function loadFlights() {
      try {
        const queryParams = {
          source: from,
          destination: to,
          date: depDate,
          cabin_class: cabinClassParam,
          page_size: PAGE_SIZE
        };

        if (filters.ordering) queryParams.ordering = filters.ordering;
        if (filters.stops !== undefined && filters.stops !== "") queryParams.stops = filters.stops;
        if (filters.maxFare && filters.maxFare < 100000) queryParams.max_fare = filters.maxFare;
        if (filters.airlines && filters.airlines.length > 0) queryParams.airlines = filters.airlines.join(",");
        if (filters.waitlistMode && filters.waitlistMode !== "all") queryParams.waitlist_mode = filters.waitlistMode;

        const response = await flightsAPI.list(currentPage, queryParams);
        let results = response.results || response || [];
        const apiTotal = typeof response.count === "number" ? response.count : results.length;
        if (isMounted) setTotalCount(apiTotal);

        // 0. Exclude departed flights (status DEPARTED/ARRIVED or departure_time in past)
        const now = new Date();
        results = results.filter((f) => {
          if (f.status === "DEPARTED" || f.status === "ARRIVED") return false;
          if (f.departure_time && new Date(f.departure_time) <= now) return false;
          return true;
        });

        // 1. Waitlist Mode Filter Fallback
        let normCabin = "ECONOMY";
        const upperCabin = (cabinClassParam || "Economy").toUpperCase();
        if (upperCabin.includes("BUSINESS")) normCabin = "BUSINESS";
        else if (upperCabin.includes("FIRST")) normCabin = "FIRST";

        if (filters.waitlistMode === "available_only") {
          results = results.filter((f) => {
            if (f.fares && f.fares[normCabin] !== undefined) {
              return Number(f.fares[normCabin].available_seats) > 0;
            }
            return Number(f.available_seats) > 0;
          });
        } else if (filters.waitlistMode === "waitlisted_only") {
          results = results.filter((f) => {
            if (f.fares && f.fares[normCabin] !== undefined) {
              return Number(f.fares[normCabin].available_seats) <= 0;
            }
            return Number(f.available_seats) <= 0;
          });
        }

        // 2. Max Fare Filter Fallback
        if (filters.maxFare && filters.maxFare < 100000) {
          results = results.filter((f) => Number(f.base_fare) <= filters.maxFare);
        }

        // 3. Airline Filter Fallback
        if (filters.airlines && filters.airlines.length > 0) {
          results = results.filter((f) => filters.airlines.includes(f.airline));
        }

        // 4. Stops Filter Fallback
        if (filters.stops !== undefined && filters.stops !== "") {
          const expectedStops = Number(filters.stops);
          results = results.filter((f) => {
            const stopCount = Array.isArray(f.stops) ? f.stops.length : (typeof f.stops === "number" ? f.stops : 0);
            if (expectedStops >= 2) return stopCount >= 2;
            return stopCount === expectedStops;
          });
        }

        // 5. Ordering Fallback
        if (filters.ordering === "base_fare") {
          results.sort((a, b) => Number(a.base_fare || 0) - Number(b.base_fare || 0));
        } else if (filters.ordering === "departure_time") {
          results.sort((a, b) => new Date(a.departure_time || 0) - new Date(b.departure_time || 0));
        } else if (filters.ordering === "duration") {
          results.sort((a, b) => {
            const durA = (new Date(a.arrival_time) - new Date(a.departure_time));
            const durB = (new Date(b.arrival_time) - new Date(b.departure_time));
            return durA - durB;
          });
        }

        if (isMounted) {
          setFlights(results);
          setIsFilteredResult(true);
          if (results.length === 0 && from && to) {
            try {
              const recRes = await flightsAPI.fetchRecommendedRoutes(from, to, depDate);
              if (isMounted) {
                const recData = recRes.data || recRes;
                const routes = recData.recommended_routes || [];
                setRecommendedRoutes(routes);
                if (routes.length > 0) {
                  const alreadySeen = sessionStorage.getItem('noDirectPopupSeen') === `${from}-${to}-${depDate}`;
                  if (!alreadySeen) {
                    setShowNoDirectModal(true);
                  }
                }
              }
            } catch (recErr) {
              console.warn("Failed to fetch recommended routes", recErr);
              if (isMounted) setRecommendedRoutes([]);
            }
          } else {
            setRecommendedRoutes([]);
          }
        }
      } catch (err) {
        console.error("Error fetching database flights:", err);
        if (isMounted) {
          setError("Failed to load flights from database: " + (err.message || String(err)));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFlights();

    return () => {
      isMounted = false;
    };
  }, [from, to, depDate, cabinClassParam, filters, currentPage]);

  // Reset to page 1 when route/cabin changes
  useEffect(() => {
    setCurrentPage(1);
  }, [from, to, depDate, cabinClassParam]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleViewDetails = (flight) => {
    if (flight && flight.id) {
      navigate(`/flights/${flight.id}?cabinClass=${encodeURIComponent(cabinClassParam)}`);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-slate-50/60 mt-3 pt-16 pb-12 px-4 md:px-6 max-w-6xl mx-auto w-full relative">
      {/* Fixed Pop-out Filters Button on Left Edge */}
      <button
        type="button"
        onClick={() => setIsFilterDrawerOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs px-3.5 py-3 rounded-r-2xl shadow-xl flex items-center gap-2 hover:pl-4.5 transition-all duration-200 cursor-pointer border-y border-r border-slate-700/50 group"
        title="Open Filters"
      >
        <span className="material-symbols-outlined text-[#ffeb00] text-lg font-bold group-hover:rotate-12 transition-transform">
          tune
        </span>
      </button>

      {/* Slide-in Filter Drawer Modal */}
      <FlightFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
        bounds={bounds}
      />

      {/* Top Search Header Component */}
      <div className="mb-10 relative z-30">
        <FlightSearchHeader />
      </div>

      {/* Interactive Date Strip Carousel */}
      <div className="mb-6">
        <DateStripCarousel selectedDepDate={depDate} filters={filters} />
      </div>

      {/* Main Flights Section */}
      <div className="mt-10">
        {/* Section Title & Status Indicator */}
        <div className="flex items-center justify-between mb-6 px-1">
          <h2 className="text-xs font-medium text-slate-900 ml-2">
            {isFilteredResult && !loading && !showNoDirectModal
              && `Found ${flights.length} flights from ${from} to ${to}`}
          </h2>
        </div>

        {/* Loading Skeletons */}
        {(loading || showNoDirectModal) && (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="w-full max-w-5xl mx-auto bg-[#eaebee]/60 border border-slate-200/80 rounded-3xl p-6 h-28 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700 text-sm font-semibold max-w-5xl mx-auto">
            {error}
          </div>
        )}

        {/* Flight Cards List */}
        {!loading && !error && flights.length > 0 && (
          <div className="flex flex-col">
            {(() => {
              // Compute algorithm optimization badges across all displayed flights
              const normCab = (cabinClassParam || "Economy").toUpperCase().includes("BUSINESS")
                ? "BUSINESS" : (cabinClassParam || "Economy").toUpperCase().includes("FIRST")
                  ? "FIRST" : "ECONOMY";

              const getFare = (f) => {
                const fares = f.fares;
                if (!fares) return Number(f.base_fare || 0);
                if (Array.isArray(fares)) {
                  const active = fares.find((x) => x.cabin_class?.toUpperCase().includes(normCab)) || fares[0];
                  return Number(active?.display_price || active?.price || 0);
                }
                if (typeof fares === "object") {
                  const active = fares[normCab] || fares["ECONOMY"] || Object.values(fares)[0];
                  return Number(active?.display_price || active?.price || 0);
                }
                return Number(f.base_fare || 0);
              };

              const getDuration = (f) => {
                const depIso = f.departure_time || f.scheduled_departure;
                const arrIso = f.arrival_time || f.scheduled_arrival;
                if (depIso && arrIso) {
                  const d = new Date(arrIso) - new Date(depIso);
                  return isNaN(d) ? Infinity : d;
                }
                return Infinity;
              };

              const getStops = (f) => {
                if (Array.isArray(f.stops)) return f.stops.length;
                if (typeof f.stops === "number") return f.stops;
                return 0;
              };

              const assignedBadges = new Map();
              const fares = flights.map(f => ({
                id: f.id,
                fare: getFare(f),
                dur: getDuration(f),
                stops: getStops(f)
              }));

              // 1. Cheapest (Lowest Fare > 0)
              const cheapest = [...fares].filter(x => x.fare > 0).sort((a, b) => a.fare - b.fare)[0];
              if (cheapest) {
                assignedBadges.set(cheapest.id, "Cheapest");
              }

              // 2. Fastest (Shortest Total Duration)
              const fastest = [...fares].filter(x => x.dur !== Infinity).sort((a, b) => a.dur - b.dur)[0];
              if (fastest && !assignedBadges.has(fastest.id)) {
                assignedBadges.set(fastest.id, "Fastest");
              } else if (fastest) {
                const nextFastest = [...fares].filter(x => x.dur !== Infinity && !assignedBadges.has(x.id)).sort((a, b) => a.dur - b.dur)[0];
                if (nextFastest) assignedBadges.set(nextFastest.id, "Fastest");
              }

              // 3. Stops Badge ("Direct" if 0 layovers, or "Fewest Stops" if layovers exist in list)
              const minStopsCount = Math.min(...fares.map(x => x.stops));
              if (minStopsCount === 0) {
                const unbadgedDirect = fares.find(x => x.stops === 0 && !assignedBadges.has(x.id));
                if (unbadgedDirect) {
                  assignedBadges.set(unbadgedDirect.id, "Direct");
                }
              } else {
                const unbadgedFewestStops = fares.find(x => x.stops === minStopsCount && !assignedBadges.has(x.id));
                if (unbadgedFewestStops) {
                  assignedBadges.set(unbadgedFewestStops.id, "Fewest Stops");
                }
              }

              // 4. Shortest (Direct route minimum flight duration/distance proxy)
              const nonStopUnbadged = fares.filter(x => x.stops === 0 && !assignedBadges.has(x.id)).sort((a, b) => a.dur - b.dur)[0];
              if (nonStopUnbadged) {
                assignedBadges.set(nonStopUnbadged.id, "Shortest");
              }

              // Fallback: Any remaining non-stop flights get "Direct"
              fares.forEach(x => {
                if (x.stops === 0 && !assignedBadges.has(x.id)) {
                  assignedBadges.set(x.id, "Direct");
                }
              });

              return flights.map((flight) => (
                <FlightCard
                  key={flight.id}
                  flight={flight}
                  selectedCabinClass={cabinClassParam}
                  onViewDetails={handleViewDetails}
                  optimizationBadge={assignedBadges.get(flight.id) || null}
                />
              ));
            })()}
          </div>
        )}

        {/* ── Pagination ───────────────────────────────────────────────── */}
        {!loading && !error && totalPages > 1 && flights.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-6 mb-2 select-none">
            {/* Prev */}
            <button
              id="pagination-prev"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border transition-all text-sm font-bold
                ${currentPage === 1
                  ? "border-slate-200 text-slate-300 cursor-not-allowed bg-white"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100 bg-white cursor-pointer active:scale-95"}`}
              aria-label="Previous page"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_left</span>
            </button>

            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("ellipsis-" + p);
                acc.push(p);
                return acc;
              }, [])
              .map((item) =>
                typeof item === "string" ? (
                  <span key={item} className="w-9 text-center text-slate-400 text-sm">…</span>
                ) : (
                  <button
                    id={`pagination-page-${item}`}
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border text-sm font-bold transition-all active:scale-95
                      ${item === currentPage
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"}`}
                  >
                    {item}
                  </button>
                )
              )}

            {/* Next */}
            <button
              id="pagination-next"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border transition-all text-sm font-bold
                ${currentPage === totalPages
                  ? "border-slate-200 text-slate-300 cursor-not-allowed bg-white"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100 bg-white cursor-pointer active:scale-95"}`}
              aria-label="Next page"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_right</span>
            </button>
          </div>
        )}

        {/* No Direct Flights — Connecting Routes Fallback */}
        {!loading && !error && flights.length === 0 && !showNoDirectModal && (
          <div>
            {recommendedRoutes.length > 0 ? (
              <div className="max-w-5xl mx-auto">
                {/* Info banner */}
                <div className="flex items-start gap-3 mb-5 p-4 bg-slate-100/80 border border-slate-200 rounded-2xl">
                  <span className="material-symbols-outlined text-slate-500 text-xl mt-0.5 shrink-0">info</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">No direct flights for {from} → {to}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Showing best connecting route options instead. Select your preferred airline and flight for each leg below.</p>
                  </div>
                </div>

                {/* Recommended connecting route cards */}
                <div className="flex flex-col gap-4">
                  {recommendedRoutes.map((route, idx) => {
                    const rankLabel = ["Best Option", "2nd Option", "3rd Option"][idx] || `Option ${idx + 1}`;
                    return (
                      <ConnectingRouteCard
                        key={idx}
                        route={route}
                        rankLabel={rankLabel}
                        cabinClassParam={cabinClassParam}
                        navigate={navigate}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-10 text-center mx-auto my-6">
                <span className="material-symbols-outlined text-4xl text-slate-400 mb-2 select-none">
                  flight_takeoff
                </span>
                <p className="text-slate-800 font-bold text-base">No flights found</p>
                <p className="text-slate-500 text-xs mt-1">There are no flights matching your search criteria from {from} to {to} on {depDate}.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* No Direct Flight Available — Modal Popup */}
      {showNoDirectModal && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in"
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in"
            style={{ boxShadow: "0 24px 64px rgba(15,23,42,0.22)" }}
          >
            {/* Header */}
            <div className="px-8 pt-6 pb-4 border-b border-slate-100 flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-amber-600 text-xl select-none">connecting_airports</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-extrabold text-slate-900 leading-tight">Sorry!  No Direct Flight Available</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {from} &rarr; {to} &bull; We found <strong>{recommendedRoutes.length} connecting route{recommendedRoutes.length !== 1 ? "s" : ""}</strong> for you
                </p>
              </div>
            </div>

            {/* Recommended Routes List — compact rows */}
            <div className="px-8 py-4 flex flex-col gap-2">
              {recommendedRoutes.map((route, idx) => {
                const hops = route.hops || (route.route ? route.route.map((l) => ({ options: [l] })) : []);
                const firstLeg = hops[0]?.options?.[0] || {};
                const lastLeg = hops[hops.length - 1]?.options?.[0] || {};
                const stops = hops.length - 1;
                const totalFare = (hops).reduce((s, h) => s + (h.options?.[0]?.min_fare || 0), 0);
                const airlineNames = hops
                  .map((h) => h.options?.[0]?.airline_name)
                  .filter(Boolean)
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join(" + ");
                const rankLabel = ["Best Option", "2nd Option", "3rd Option"][idx] || `Option ${idx + 1}`;
                const logoUrl = firstLeg.airline_logo_url
                  ? (firstLeg.airline_logo_url.startsWith("http") ? firstLeg.airline_logo_url : `http://127.0.0.1:8000${firstLeg.airline_logo_url.startsWith("/") ? "" : "/"}${firstLeg.airline_logo_url}`)
                  : null;
                const airportChain = hops.map(h => h.options?.[0]?.departure_airport).filter(Boolean).join(" → ") + (lastLeg.arrival_airport ? ` → ${lastLeg.arrival_airport}` : "");

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    {/* Logo / Initials */}
                    <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center border border-slate-200">
                      {logoUrl ? (
                        <img src={logoUrl} alt={firstLeg.airline_name || ""} className="w-8 h-8 object-contain" />
                      ) : (
                        <span className="text-[9px] font-extrabold text-slate-700">{firstLeg.airline_code || "FL"}</span>
                      )}
                    </div>

                    {/* Airline name */}
                    <p className="text-xs font-bold text-slate-900 w-44 truncate shrink-0">
                      {airlineNames || firstLeg.airline_name || "Airline"}
                    </p>

                    {/* Route chain */}
                    <p className="text-[10px] text-slate-500 flex-1 truncate">
                      {stops} stop{stops !== 1 ? "s" : ""} &bull; {airportChain}
                    </p>

                    {/* Fare + rank badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      {totalFare > 0 && (
                        <p className="text-xs font-extrabold text-slate-900">₹{totalFare.toLocaleString("en-IN")}</p>
                      )}
                      {idx === 0 && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white whitespace-nowrap">{rankLabel}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Action */}
            <div className="px-8 pb-6 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowNoDirectModal(false);
                  sessionStorage.setItem('noDirectPopupSeen', `${from}-${to}-${depDate}`);
                }}
                className="w-full btn-primary text-slate-950 py-2.5 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 transition-transform"
              >
                <span>Next</span>
                <span className="material-symbols-outlined text-base font-bold">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
