import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import FlightSearchHeader from "@/components/flights/FlightSearchHeader";
import DateStripCarousel from "@/components/flights/DateStripCarousel";
import FlightCard from "@/components/flights/FlightCard";
import { flightsAPI } from "@/services/flight-service/flightService";

export default function FlightsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get("from") || "DEL";
  const to = searchParams.get("to") || "HAM";
  const depDate = searchParams.get("depDate") || new Date().toISOString().split("T")[0];

  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFilteredResult, setIsFilteredResult] = useState(true);

  // Fetch flights from database whenever search parameters change
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function loadFlights() {
      try {
        // Try fetching filtered flights based on search criteria
        const response = await flightsAPI.list(1, {
          source: from,
          destination: to,
          date: depDate,
          page_size: 20
        });

        const results = response.results || response || [];

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
  }, [from, to, depDate]);

  const handleViewDetails = (flight) => {
    if (flight && flight.id) {
      navigate(`/flights/${flight.id}`);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-slate-50/60 mt-3 pt-16 pb-12 px-4 md:px-6 max-w-6xl mx-auto w-full">
      {/* Top Search Header Component */}
      <div className="mb-6">
        <FlightSearchHeader />
      </div>

      {/* Interactive Date Strip Carousel */}
      <div className="mb-6">
        <DateStripCarousel selectedDepDate={depDate} />
      </div>

      {/* Main Flights Section */}
      <div className="mt-6">
        {/* Section Title & Status Indicator */}
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-sm font-medium text-slate-900 ml-2">
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
          <div className="space-y-2">
            {flights.map((flight) => (
              <FlightCard
                key={flight.id}
                flight={flight}
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
