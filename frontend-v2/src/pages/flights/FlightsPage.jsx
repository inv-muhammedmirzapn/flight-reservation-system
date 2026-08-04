import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import FlightSearchHeader from "@/components/flights/FlightSearchHeader";
import DateStripCarousel from "@/components/flights/DateStripCarousel";
import FlightCard from "@/components/flights/FlightCard";
import FlightFilterDrawer from "@/components/flights/FlightFilterDrawer";
import { flightsAPI } from "@/services/flight-service/flightService";

export default function FlightsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get("from") || "DEL";
  const to = searchParams.get("to") || "HAM";
  const depDate = searchParams.get("depDate") || new Date().toISOString().split("T")[0];
  const cabinClassParam = searchParams.get("cabinClass") || "Economy";

  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFilteredResult, setIsFilteredResult] = useState(true);

  // Filter drawer state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({
    ordering: "base_fare",
    stops: "",
    airlines: [],
    waitlistMode: "all",
    maxFare: 100000
  });

  const handleApplyFilters = (newFilters) => {
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

  // Fetch flights from database whenever search parameters or applied filters change
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function loadFlights() {
      try {
        const queryParams = {
          source: from,
          destination: to,
          date: depDate,
          cabin_class: cabinClassParam,
          page_size: 20
        };

        if (filters.ordering) queryParams.ordering = filters.ordering;
        if (filters.stops !== undefined && filters.stops !== "") queryParams.stops = filters.stops;
        if (filters.maxFare && filters.maxFare < 100000) queryParams.max_fare = filters.maxFare;
        if (filters.airlines && filters.airlines.length > 0) queryParams.airlines = filters.airlines.join(",");
        if (filters.waitlistMode && filters.waitlistMode !== "all") queryParams.waitlist_mode = filters.waitlistMode;

        const response = await flightsAPI.list(1, queryParams);
        let results = response.results || response || [];

        // 0. Exclude departed flights (status DEPARTED/ARRIVED or departure_time in past)
        const now = new Date();
        results = results.filter((f) => {
          if (f.status === "DEPARTED" || f.status === "ARRIVED") return false;
          if (f.departure_time && new Date(f.departure_time) <= now) return false;
          return true;
        });

        // 1. Waitlist Mode Filter Fallback
        const normCabin = (cabinClassParam || "Economy").toUpperCase().replace(/\s+/g, "_");
        if (filters.waitlistMode === "available_only") {
          results = results.filter((f) => {
            if (f.fares && f.fares[normCabin]) {
              return Number(f.fares[normCabin].available_seats) > 0;
            }
            return Number(f.available_seats) > 0;
          });
        } else if (filters.waitlistMode === "waitlisted_only") {
          results = results.filter((f) => {
            if (f.fares && f.fares[normCabin]) {
              return Number(f.fares[normCabin].available_seats) === 0;
            }
            return Number(f.available_seats) === 0;
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
        }
      } catch (err) {
        console.error("Error fetching database flights:", err);
        if (isMounted) {
          setError("Failed to load flights from database.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFlights();

    return () => {
      isMounted = false;
    };
  }, [from, to, depDate, filters]);

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
      />

      {/* Top Search Header Component */}
      <div className="mb-10">
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
            {isFilteredResult
              && `Found ${flights.length} flights from ${from} to ${to}`}
          </h2>
        </div>

        {/* Loading Skeletons */}
        {loading && (
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
            {flights.map((flight) => (
              <FlightCard
                key={flight.id}
                flight={flight}
                selectedCabinClass={cabinClassParam}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && flights.length === 0 && (
          <div className="p-10 text-center mx-auto my-6">
            <span className="material-symbols-outlined text-4xl text-slate-400 mb-2 select-none">
              flight_takeoff
            </span>
            <p className="text-slate-800 font-bold text-base">No flights found</p>
            <p className="text-slate-500 text-xs mt-1">There are no flights matching your search criteria from {from} to {to} on {depDate}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
