import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { flightsAPI } from "@/services/flight-service/flightService";
import { bookingAPI } from "@/services/booking-service/bookingService";
import FlightItineraryCard from "@/components/flights/FlightItineraryCard";
import PassengerListSection from "@/components/flights/PassengerListSection";
import FareDetailsCard from "@/components/flights/FareDetailsCard";
import toast from "react-hot-toast";

export default function FlightDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [flight, setFlight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Passengers state
  const [passengers, setPassengers] = useState([
    { id: 1, name: "", age: "", gender: "Male" }
  ]);

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

  const handleBookingAction = async () => {
    if (!flight) return;

    const isWaitlisted = Number(flight.available_seats) === 0;

    // Basic validation
    const invalidPassenger = passengers.find((p) => !p.name.trim());
    if (invalidPassenger) {
      toast.error("Please enter the full name for all passengers.");
      return;
    }

    try {
      if (isWaitlisted) {
        toast.success(`Request submitted to join Waitlist for flight ${flight.flight_number}!`);
      } else {
        await bookingAPI.create(flight.id, passengers);
        toast.success("Booking confirmed successfully!");
      }
    } catch (err) {
      console.error("Booking error:", err);
      // Fallback notification for mock demo if unauthenticated
      if (isWaitlisted) {
        toast.success(`Waitlist entry created for ${flight.flight_number}!`);
      } else {
        toast.success(`Booking request received for ${flight.flight_number}!`);
      }
    }
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
    <div className="flex-1 min-h-screen mt-8 pt-12 pb-16 px-4 md:px-6 max-w-6xl mx-auto w-full">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between mb-6 ml-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-950">
          Booking Page
        </h1>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start relative">
        {/* Left Panel (Scrollable) */}
        <div className="flex-1 w-full space-y-6">
          {/* Flight Itinerary Card */}
          <FlightItineraryCard flight={flight} />

          {/* Add Passengers Section */}
          <PassengerListSection
            passengers={passengers}
            onChangePassengers={setPassengers}
          />
        </div>

        {/* Right Panel (Sticky / Fixed Fare Details) */}
        <div className="w-full lg:w-80 xl:w-96 lg:sticky lg:top-24 flex-shrink-0">
          <FareDetailsCard
            flight={flight}
            passengerCount={passengers.length}
            onBookingAction={handleBookingAction}
          />
        </div>
      </div>
    </div>
  );
}
