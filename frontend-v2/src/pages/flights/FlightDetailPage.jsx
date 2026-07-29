import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { flightsAPI } from "@/services/flight-service/flightService";
import { bookingAPI } from "@/services/booking-service/bookingService";
import { waitlistAPI } from "@/services/waitlist-service/waitlistService";
import FlightItineraryCard from "@/components/flights/FlightItineraryCard";
import PassengerListSection from "@/components/flights/PassengerListSection";
import FareDetailsCard from "@/components/flights/FareDetailsCard";
import toast from "react-hot-toast";

export default function FlightDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useSelector((state) => state?.auth) || {};
  const isAuthenticated = Boolean(auth.isAuthenticated || auth.token);

  const [flight, setFlight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Passengers state & Validation errors
  const [passengers, setPassengers] = useState([
    { id: 1, name: "", age: "", gender: "Male" }
  ]);
  const [passengerErrors, setPassengerErrors] = useState({});

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

  const validatePassengers = () => {
    const errorsMap = {};
    let isValid = true;

    passengers.forEach((p, index) => {
      const pErr = {};

      // Name validation: max 40 chars, only alphabets
      if (!p.name || !p.name.trim()) {
        pErr.name = "Full name is required";
        isValid = false;
      } else if (p.name.length > 40) {
        pErr.name = "Name cannot exceed 40 characters";
        isValid = false;
      } else if (!/^[A-Za-z\s]+$/.test(p.name)) {
        pErr.name = "Only alphabets allowed";
        isValid = false;
      }

      // Age validation: only digits, 1-120 max
      if (!p.age) {
        pErr.age = "Age is required";
        isValid = false;
      } else {
        const ageNum = Number(p.age);
        if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
          pErr.age = "Age must be between 1 and 120";
          isValid = false;
        }
      }

      if (Object.keys(pErr).length > 0) {
        errorsMap[index] = pErr;
      }
    });

    setPassengerErrors(errorsMap);
    return isValid;
  };

  const handlePassengersChange = (updated) => {
    setPassengers(updated);
    // Clear errors when user modifies input
    if (Object.keys(passengerErrors).length > 0) {
      setPassengerErrors({});
    }
  };

  const handleBookingAction = async () => {
    if (!flight) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!validatePassengers()) {
      toast.error("Please fix passenger form errors before proceeding.");
      return;
    }

    const isWaitlisted = Number(flight.available_seats) === 0;

    try {
      if (isWaitlisted) {
        const res = await waitlistAPI.join(flight.id, passengers);
        toast.success(`Request submitted to join Waitlist for flight ${flight.flight_number}!`);
        navigate(`/booking-confirmation/waitlist/${res.id}`, {
          state: { waitlist: res, flight, passengers }
        });
      } else {
        const res = await bookingAPI.create(flight.id, passengers);
        toast.success("Booking confirmed successfully!");
        navigate(`/booking-confirmation/${res.id}`, {
          state: { booking: res, flight, passengers }
        });
      }
    } catch (err) {
      console.error("Booking error:", err);
      toast.error(err?.message || "Booking failed. Please try again.");
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
    <div className="flex-1 min-h-screen mt-12 pt-12 pb-8 px-4 md:px-6 max-w-6xl mx-auto w-full">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between mb-6 ml-4">
        <h1 className="text-xl font-bold text-slate-950">
          Confirm Booking
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
            onChangePassengers={handlePassengersChange}
            errors={passengerErrors}
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
