import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { flightsAPI } from "@/services/flight-service/flightService";
import FlightItineraryCard from "@/components/flights/FlightItineraryCard";
import CabinClassSelector from "@/components/flights/CabinClassSelector";
import FareDetailsCard from "@/components/flights/FareDetailsCard";
import FarePredictionBadge from "@/components/flights/FarePredictionBadge"; 
import toast from "react-hot-toast";

export default function FlightDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const auth = useSelector((state) => state?.auth) || {};
  const isAuthenticated = Boolean(auth.isAuthenticated || auth.token);

  const initialCabinParam = searchParams.get("cabinClass");
  const initialCabinKey = initialCabinParam
    ? initialCabinParam.toUpperCase().includes("BUSINESS")
      ? "BUSINESS"
      : initialCabinParam.toUpperCase().includes("FIRST")
      ? "FIRST"
      : "ECONOMY"
    : "ECONOMY";

  const [flight, setFlight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCabin, setSelectedCabin] = useState(initialCabinKey);
  const [passengerCount] = useState(1);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function fetchFlightDetail() {
      try {
        const data = await flightsAPI.retrieve(id);
        if (isMounted) {
          setFlight(data);
        }
      } catch (err) {
        console.error("Error fetching flight details:", err);
        if (isMounted) {
          setError("Unable to load flight details. The flight may not exist.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (id) {
      fetchFlightDetail();
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleProceedToCheckout = () => {
    if (!isAuthenticated) {
      toast.error("Please login to proceed with flight booking.");
      navigate("/login", { state: { from: location } });
      return;
    }

    navigate(`/flights/${id}/checkout`, {
      state: {
        ...location.state,
        selectedCabin,
        seatCount: passengerCount,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-slate-50/60 pt-16 pb-16 px-4 md:px-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 w-full space-y-6 animate-pulse">
            <div className="h-64 bg-slate-200 rounded-3xl" />
            <div className="h-44 bg-slate-200 rounded-3xl" />
          </div>
          <div className="w-full lg:w-80 xl:w-96 h-64 bg-slate-200 rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !flight) {
    return (
      <div className="flex-1 min-h-screen bg-slate-50/60 pt-20 pb-12 px-4 max-w-4xl mx-auto w-full text-center">
        <div className="plain-card rounded-3xl p-10 max-w-md mx-auto space-y-4">
          <span className="material-symbols-outlined text-4xl text-rose-500">
            error_outline
          </span>
          <h2 className="text-lg font-bold text-slate-900">Flight Not Found</h2>
          <p className="text-xs text-slate-500">{error || "Flight details are unavailable."}</p>
          <button
            type="button"
            onClick={() => navigate("/flights")}
            className="btn-primary px-5 py-2.5 rounded-xl text-xs"
          >
            Back to Search Results
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen mt-12 pt-12 pb-8 px-4 md:px-6 max-w-6xl mx-auto w-full">
      {/* Top Navigation */}
      <div className="mb-6 ml-4">
        <button
          type="button"
          onClick={() => navigate("/flights", { state: { showPastBookings: location.state?.showPastBookings } })}
          className="text-xs font-semibold text-slate-600 hover:text-slate-950 cursor-pointer transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Flights List
        </button>
        <h1 className="text-xl font-bold text-slate-950 mt-3">
          Flight Details & Selection
        </h1>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start relative">
        {/* Left Panel */}
        <div className="flex-1 w-full space-y-6">
          {/* Flight Itinerary Card */}
          <FlightItineraryCard flight={flight} selectedCabinClass={selectedCabin} />

          {/* Cabin Class Selection */}
          <CabinClassSelector
            flight={flight}
            selectedCabin={selectedCabin}
            onSelectCabin={setSelectedCabin}
          />
        </div>

        {/* Right Panel (Sticky Fare Details & Proceed Action) */}
        <div className="w-full lg:w-80 xl:w-96 lg:sticky lg:top-24 flex-shrink-0 space-y-4">

          {/* Fare Prediction Badge */}
          <FarePredictionBadge
            flightInstanceId={id}
            cabinClass={selectedCabin}
          />
          
          {/* Fare Details Card */}
          <FareDetailsCard
            flight={flight}
            selectedCabin={selectedCabin}
            passengerCount={1}
            onBookingAction={handleProceedToCheckout}
            actionButtonText="Book Seats"
          />
        </div>
      </div>
    </div>
  );
}
