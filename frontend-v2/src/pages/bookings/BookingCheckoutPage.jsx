import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { flightsAPI } from "@/services/flight-service/flightService";
import { bookingAPI } from "@/services/booking-service/bookingService";
import { waitlistAPI } from "@/services/waitlist-service/waitlistService";
import FlightItinerarySummaryCard from "@/components/flights/FlightItinerarySummaryCard";
import FareDetailsCard from "@/components/flights/FareDetailsCard";
import CheckoutStepper from "@/components/bookings/CheckoutStepper";
import BookingReviewCard from "@/components/bookings/BookingReviewCard";
import SeatSelectionCard from "@/components/bookings/SeatSelectionCard";
import ComplimentaryMealCard from "@/components/meals/ComplimentaryMealCard";
import PaidAddonsCard from "@/components/meals/PaidAddonsCard";
import PassengerListSection from "@/components/flights/PassengerListSection";
import DuplicatePassengerModal from "@/components/bookings/DuplicatePassengerModal";
import toast from "react-hot-toast";

export default function BookingCheckoutPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Selected cabin and initial seat count passed from FlightDetailPage state (defaults if accessed directly)
  const initialCabin = location.state?.selectedCabin || "ECONOMY";
  const initialSeatCount = location.state?.seatCount || 1;

  const [flight, setFlight] = useState(null);
  const [mealsData, setMealsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCabin] = useState(initialCabin);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Duplicate passenger prompt state
  const [hasConfirmedDuplicates, setHasConfirmedDuplicates] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingStepIndex, setPendingStepIndex] = useState(null);

  // Passenger data state
  const [passengers, setPassengers] = useState(
    Array.from({ length: initialSeatCount }, (_, i) => ({
      id: Date.now() + i,
      name: "",
      age: "",
      gender: "Male",
    }))
  );

  // Passenger validation errors mapping: { [paxIdx]: { name?: string, age?: string } }
  const [passengerErrors, setPassengerErrors] = useState({});

  // Input element refs for focusing invalid passenger fields
  const inputRefs = useRef({});

  // Complimentary meal preferences state: { [paxIdx]: 'VEG' | 'NON_VEG' | 'NONE' }
  const [complimentaryPrefMap, setComplimentaryPrefMap] = useState({});

  // Paid add-on meals mapping state: { [paxIdx]: [{ food_item_id, flight_meal_id, flight_leg_id, quantity, price, name }] }
  const [selectedMealsMap, setSelectedMealsMap] = useState({});

  // Selected seats array
  const [selectedSeats, setSelectedSeats] = useState([]);

  useEffect(() => {
    async function loadCheckoutData() {
      try {
        setLoading(true);
        const [flightData, mealsResp] = await Promise.all([
          flightsAPI.retrieve(id),
          flightsAPI.getMeals(id, { cabin_class: selectedCabin }).catch((err) => {
            console.warn("Could not load meals data from backend API:", err);
            return null;
          }),
        ]);
        setFlight(flightData);
        setMealsData(mealsResp);
      } catch (err) {
        console.error("Failed to load flight details:", err);
        toast.error("Flight not found or unavailable.");
      } finally {
        setLoading(false);
      }
    }
    loadCheckoutData();
  }, [id, selectedCabin]);

  // Pre-select default complimentary meal if included with ticket fare
  useEffect(() => {
    if (!mealsData || !passengers.length) return;
    const flightMealsList = mealsData.flight_meals || [];
    const normCab = (selectedCabin || "ECONOMY").toUpperCase();
    const fareObj = flight?.fares?.[normCab] || flight?.fares?.["ECONOMY"] || null;
    const isMealInc = Boolean(mealsData?.meal_included ?? fareObj?.meal_included);

    if (isMealInc && flightMealsList.length > 0) {
      const defaultMeal = flightMealsList.find((meal) => meal.is_veg) || flightMealsList[0];
      if (defaultMeal) {
        const curr = mealsData.target_currency || fareObj?.currency || "INR";

        setComplimentaryPrefMap((prevPref) => {
          const newPrefMap = { ...prevPref };
          let changed = false;
          passengers.forEach((_, idx) => {
            if (!newPrefMap[idx]) {
              newPrefMap[idx] = defaultMeal.is_veg ? "VEG" : "NON_VEG";
              changed = true;
            }
          });
          return changed ? newPrefMap : prevPref;
        });

        setSelectedMealsMap((prevMeals) => {
          const newMealsMap = { ...prevMeals };
          let changed = false;
          passengers.forEach((_, idx) => {
            if (!newMealsMap[idx] || newMealsMap[idx].length === 0) {
              newMealsMap[idx] = [
                {
                  flight_meal_id: defaultMeal.id,
                  name: defaultMeal.name,
                  price: 0,
                  display_currency: defaultMeal.display_currency || curr,
                  quantity: 1,
                },
              ];
              changed = true;
            }
          });
          return changed ? newMealsMap : prevMeals;
        });
      }
    }
  }, [mealsData, flight, selectedCabin, passengers.length]);

  if (loading) {
    return (
      <div className="flex-1 min-h-screen mt-12 pt-12 pb-16 px-4 md:px-8 max-w-6xl mx-auto w-full animate-pulse space-y-8">
        <div className="h-20 bg-slate-200 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 h-96 bg-slate-100 rounded-3xl" />
          <div className="lg:col-span-4 h-96 bg-slate-200 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!flight) {
    return (
      <div className="flex-1 min-h-screen mt-12 pt-16 pb-16 px-4 max-w-md mx-auto text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Flight Not Found</h2>
        <button
          onClick={() => navigate("/flights")}
          className="btn-primary py-2.5 px-6"
        >
          Back to Search
        </button>
      </div>
    );
  }

  // Active fare for cabin & meals backend data
  const normCabin = (selectedCabin || "ECONOMY").toUpperCase();
  const fareObj = flight.fares?.[normCabin] || flight.fares?.["ECONOMY"] || null;
  const isMealIncluded = Boolean(mealsData?.meal_included ?? fareObj?.meal_included);
  const foodItems = mealsData?.food_items || [];
  const flightMeals = mealsData?.flight_meals || [];
  const targetCurrency = mealsData?.target_currency || fareObj?.currency || "INR";
  const availableSeats = fareObj?.available_seats ?? flight.available_seats ?? 0;
  const isWaitlisted = Number(availableSeats) === 0;

  const hasMealsOrAddons = isMealIncluded || foodItems.length > 0 || flightMeals.length > 0;

  // Calculate total meal cost from paid add-ons
  const calculateMealTotal = () => {
    let sum = 0;
    Object.values(selectedMealsMap).forEach((mealList) => {
      if (Array.isArray(mealList)) {
        mealList.forEach((m) => {
          sum += (Number(m.price) || 0) * (Number(m.quantity) || 1);
        });
      }
    });
    return sum;
  };

  const mealTotal = calculateMealTotal();
  const seatTotal = selectedSeats.reduce((sum, seat) => sum + Number(seat.seat_fee || 0), 0);

  // Dynamically define stepper steps
  const steps = [
    { id: "passengers", title: "Passengers", subtitle: "Passenger Details" },
    ...(!isWaitlisted
      ? [{ id: "seat_selection", title: "Seats", subtitle: "Choose your seat" }]
      : []),
    ...(hasMealsOrAddons
      ? [{ id: "free_meal", title: "Meals & Menu", subtitle: "In-Flight Selection" }]
      : []),
    { id: "review", title: "Payment", subtitle: "Confirm Booking" },
  ];

  const currentStepObj = steps[currentStepIndex] || steps[0];
  const currentStepNumber = currentStepIndex + 1;

  const handleComplimentaryPrefChange = (paxIdx, prefKey) => {
    setComplimentaryPrefMap((prev) => ({
      ...prev,
      [paxIdx]: prefKey,
    }));
    setSelectedMealsMap((prev) => ({
      ...prev,
      [paxIdx]: [],
    }));
  };

  const handleMealSelection = (paxIdx, selectedItem) => {
    if (!selectedItem || selectedItem.key === "NONE") {
      setComplimentaryPrefMap((prev) => ({ ...prev, [paxIdx]: "NONE" }));
      // Retain paid add-ons (> 0 price), remove complimentary item
      setSelectedMealsMap((prev) => ({
        ...prev,
        [paxIdx]: (prev[paxIdx] || []).filter((m) => Number(m.price) > 0),
      }));
      return;
    }

    if (selectedItem.flight_meal_id) {
      setComplimentaryPrefMap((prev) => ({ ...prev, [paxIdx]: selectedItem.name }));
      setSelectedMealsMap((prev) => {
        const currentList = prev[paxIdx] || [];
        const paidItems = currentList.filter((m) => Number(m.price) > 0);
        return {
          ...prev,
          [paxIdx]: [
            {
              flight_meal_id: selectedItem.flight_meal_id,
              name: selectedItem.name,
              price: 0,
              display_currency: selectedItem.display_currency || targetCurrency,
              quantity: 1,
            },
            ...paidItems,
          ],
        };
      });
    }
  };

  const handlePaidAddonQtyChange = (paxIdx, item, delta) => {
    setSelectedMealsMap((prev) => {
      const currentList = prev[paxIdx] || [];
      const itemPrice = Number(item.display_price || item.price || 0);
      const existingIdx = currentList.findIndex((m) => m.food_item_id === item.id);

      let updatedList = [...currentList];

      if (existingIdx >= 0) {
        const existing = updatedList[existingIdx];
        const newQty = (existing.quantity || 1) + delta;
        if (newQty <= 0) {
          updatedList.splice(existingIdx, 1);
        } else {
          updatedList[existingIdx] = {
            ...existing,
            quantity: newQty,
          };
        }
      } else if (delta > 0) {
        updatedList.push({
          food_item_id: item.id,
          name: item.name,
          price: itemPrice,
          display_currency: item.display_currency || targetCurrency,
          quantity: 1,
          is_veg: item.is_veg,
        });
      }

      return {
        ...prev,
        [paxIdx]: updatedList,
      };
    });
  };

  const validatePassengers = (paxList) => {
    let isValid = true;
    const newErrors = {};
    let firstInvalidKey = null;

    paxList.forEach((p, idx) => {
      const pErr = {};
      // Name validation
      if (!p.name || p.name.trim() === "") {
        pErr.name = "Full name is required";
        isValid = false;
        if (!firstInvalidKey) firstInvalidKey = `${idx}-name`;
      } else if (p.name.trim().length < 2) {
        pErr.name = "Name must be at least 2 characters";
        isValid = false;
        if (!firstInvalidKey) firstInvalidKey = `${idx}-name`;
      }

      // Age validation
      if (!p.age || p.age.toString().trim() === "") {
        pErr.age = "Age is required";
        isValid = false;
        if (!firstInvalidKey) firstInvalidKey = `${idx}-age`;
      } else if (isNaN(Number(p.age)) || Number(p.age) < 1 || Number(p.age) > 120) {
        pErr.age = "Please enter a valid age (1-120)";
        isValid = false;
        if (!firstInvalidKey) firstInvalidKey = `${idx}-age`;
      }

      if (Object.keys(pErr).length > 0) {
        newErrors[idx] = pErr;
      }
    });

    return { isValid, newErrors, firstInvalidKey };
  };

  const checkForDuplicatePassengers = (paxList) => {
    if (!paxList || paxList.length < 2) return false;
    const seen = new Set();
    for (const p of paxList) {
      const nameKey = (p.name || "").trim().toLowerCase();
      const ageKey = (p.age !== undefined && p.age !== null ? String(p.age) : "").trim();
      const genderKey = (p.gender || "").trim().toLowerCase();

      if (!nameKey || !ageKey) continue;

      const key = `${nameKey}|${ageKey}|${genderKey}`;
      if (seen.has(key)) {
        return true;
      }
      seen.add(key);
    }
    return false;
  };

  const handlePassengersChange = (updatedPassengers, changedIdx, changedField) => {
    setPassengers(updatedPassengers);
    setHasConfirmedDuplicates(false);

    if (changedIdx !== undefined && passengerErrors[changedIdx]) {
      const p = updatedPassengers[changedIdx];
      let fieldError = null;

      if (changedField === "name") {
        if (!p.name || p.name.trim() === "") {
          fieldError = "Full name is required";
        } else if (p.name.trim().length < 2) {
          fieldError = "Name must be at least 2 characters";
        }
      } else if (changedField === "age") {
        if (!p.age || p.age.toString().trim() === "") {
          fieldError = "Age is required";
        } else if (isNaN(Number(p.age)) || Number(p.age) < 1 || Number(p.age) > 120) {
          fieldError = "Please enter a valid age (1-120)";
        }
      }

      setPassengerErrors((prev) => {
        const paxErrors = { ...(prev[changedIdx] || {}) };
        if (fieldError) {
          paxErrors[changedField] = fieldError;
        } else {
          delete paxErrors[changedField];
        }
        const newPrev = { ...prev };
        if (Object.keys(paxErrors).length > 0) {
          newPrev[changedIdx] = paxErrors;
        } else {
          delete newPrev[changedIdx];
        }
        return newPrev;
      });
    }
  };

  const handleBlurPassengerField = (idx, field) => {
    const p = passengers[idx];
    if (!p) return;
    let fieldError = null;

    if (field === "name") {
      if (!p.name || p.name.trim() === "") {
        fieldError = "Full name is required";
      } else if (p.name.trim().length < 2) {
        fieldError = "Name must be at least 2 characters";
      }
    } else if (field === "age") {
      if (!p.age || p.age.toString().trim() === "") {
        fieldError = "Age is required";
      } else if (isNaN(Number(p.age)) || Number(p.age) < 1 || Number(p.age) > 120) {
        fieldError = "Please enter a valid age (1-120)";
      }
    }

    if (fieldError) {
      setPassengerErrors((prev) => ({
        ...prev,
        [idx]: {
          ...(prev[idx] || {}),
          [field]: fieldError,
        },
      }));
    }
  };

  // Step Validation & Navigation
  const validateCurrentStep = (targetStepIdx) => {
    if (currentStepObj.id === "passengers") {
      const { isValid, newErrors, firstInvalidKey } = validatePassengers(passengers);
      setPassengerErrors(newErrors);

      if (!isValid) {
        toast.error("Please fix the highlighted passenger errors.");
        if (firstInvalidKey && inputRefs.current[firstInvalidKey]) {
          inputRefs.current[firstInvalidKey].focus();
        }
        return false;
      }

      // Check for case-insensitive duplicate passenger details
      const hasDuplicates = checkForDuplicatePassengers(passengers);
      if (hasDuplicates && !hasConfirmedDuplicates) {
        const nextIdx = targetStepIdx !== undefined ? targetStepIdx : currentStepIndex + 1;
        setPendingStepIndex(nextIdx);
        setShowDuplicateModal(true);
        return false;
      }
    }
    if (currentStepObj.id === "seat_selection") {
      if (selectedSeats.length > 0 && selectedSeats.length !== passengers.length) {
        toast.error(`Please select exactly ${passengers.length} seats, or leave it empty for auto-assignment.`);
        return false;
      }
    }
    return true;
  };

  const handleConfirmDuplicates = () => {
    setHasConfirmedDuplicates(true);
    setShowDuplicateModal(false);
    if (pendingStepIndex !== null && pendingStepIndex !== currentStepIndex) {
      if (pendingStepIndex >= 0 && pendingStepIndex < steps.length) {
        setCurrentStepIndex(pendingStepIndex);
      }
    } else if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
    setPendingStepIndex(null);
  };

  const handleCancelDuplicates = () => {
    setShowDuplicateModal(false);
    setPendingStepIndex(null);
  };

  const handleNext = () => {
    const targetIdx = currentStepIndex + 1;
    if (!validateCurrentStep(targetIdx)) return;
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(targetIdx);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    } else {
      navigate(`/flights/${id}`);
    }
  };

  // Submit Booking
  const handleConfirmBooking = async () => {
    if (!validateCurrentStep()) return;

    setSubmitting(true);
    try {
      const formattedPassengers = passengers.map((p, idx) => {
        const mealPref = complimentaryPrefMap[idx] || (isMealIncluded ? "VEG" : "NONE");
        const paidMeals = selectedMealsMap[idx] || [];

        const g = (p.gender || "").toUpperCase();
        const genderCode = g.startsWith("F") ? "F" : g.startsWith("O") ? "O" : "M";

        return {
          name: p.name.trim(),
          age: parseInt(p.age, 10),
          gender: genderCode,
          phone_number: p.phone_number?.trim() || "",
          meal_preference: mealPref,
          seat_number: selectedSeats[idx]?.seat_number || "",
          selected_meals: paidMeals.map((m) => ({
            food_item_id: m.food_item_id || null,
            flight_meal_id: m.flight_meal_id || null,
            flight_leg_id: m.flight_leg_id || null,
            quantity: m.quantity || 1,
          })),
        };
      });

      if (isWaitlisted) {
        const response = await waitlistAPI.join(id, formattedPassengers, selectedCabin);
        toast.success(`Successfully joined waitlist (Position #${response.queue_position || 1})!`);
        navigate(`/booking-confirmation/waitlist/${response.id}`);
      } else {
        const response = await bookingAPI.create(id, formattedPassengers, selectedCabin);
        toast.success("Flight booking confirmed successfully!");
        navigate(`/booking-confirmation/${response.id}`);
      }
    } catch (err) {
      console.error("Booking error:", err);
      const errMsg =
        err.message ||
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Failed to process booking. Please try again.";
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen mt-12 pt-12 pb-8 px-4 md:px-6 max-w-6xl mx-auto w-full space-y-6 animate-fade-in">
      {/* Top Navigation */}
      <div className="ml-4">
        <button
          type="button"
          onClick={() => navigate(`/flights/${id}`)}
          className="text-xs font-semibold text-slate-600 hover:text-slate-950 cursor-pointer transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Flight Details
        </button>
        <h1 className="text-xl font-bold text-slate-950 mt-3">
          Confirm Booking
        </h1>
      </div>

      {/* Flight Header Summary */}
      <FlightItinerarySummaryCard flight={flight} />

      {/* Main Grid: Left Stepper Forms, Right Sticky Fare Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column - Active Step Content */}
        <div className="lg:col-span-8 space-y-6">

          {/* Stepper Progress Bar */}
          <CheckoutStepper
            currentStep={currentStepNumber}
            steps={steps}
            onStepClick={(stepNum) => {
              const targetIdx = stepNum - 1;
              if (targetIdx < currentStepIndex) {
                setCurrentStepIndex(targetIdx);
              } else if (targetIdx > currentStepIndex) {
                if (validateCurrentStep(targetIdx)) {
                  setCurrentStepIndex(targetIdx);
                }
              }
            }}
          />

          {/* STEP: Passenger Information */}
          {currentStepObj.id === "passengers" && (
            <PassengerListSection
              passengers={passengers}
              onChangePassengers={handlePassengersChange}
              errors={passengerErrors}
              inputRefs={inputRefs}
              onBlurField={handleBlurPassengerField}
            />
          )}

          {/* STEP: Seat Selection */}
          {currentStepObj.id === "seat_selection" && !isWaitlisted && (
            <SeatSelectionCard
              flight={flight}
              cabinClass={normCabin}
              passengers={passengers}
              selectedSeats={selectedSeats}
              onSeatSelect={setSelectedSeats}
            />
          )}

          {/* STEP: Meal / Food Selection */}
          {currentStepObj.id === "free_meal" && (
            <div className="space-y-6">
              <ComplimentaryMealCard
                passengers={passengers}
                selectedCabin={selectedCabin}
                foodItems={foodItems}
                flightMeals={flightMeals}
                isMealIncluded={isMealIncluded}
                targetCurrency={targetCurrency}
                preferencesMap={complimentaryPrefMap}
                selectedMealsMap={selectedMealsMap}
                onMealSelect={handleMealSelection}
                onPreferenceChange={handleComplimentaryPrefChange}
              />
              <PaidAddonsCard
                passengers={passengers}
                foodItems={foodItems}
                targetCurrency={targetCurrency}
                selectedMealsMap={selectedMealsMap}
                onAddonQtyChange={handlePaidAddonQtyChange}
              />
            </div>
          )}

          {/* STEP: Review & Final Confirmation */}
          {currentStepObj.id === "review" && (
            <BookingReviewCard
              passengers={passengers}
              isMealIncluded={isMealIncluded}
              complimentaryPrefMap={complimentaryPrefMap}
              selectedMealsMap={selectedMealsMap}
            />
          )}

          {/* Stepper Navigation Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleBack}
              className="btn-outline-plain py-2.5 px-6 text-xs font-bold rounded-xl cursor-pointer"
            >
              &larr; Back
            </button>

            {currentStepIndex < steps.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="btn-primary py-2.5 px-5 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-2"
              >
                <span>Continue</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmBooking}
                className="btn-primary py-2.5 px-5 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-2"
              >
                {submitting ? (
                  <span>Processing Booking...</span>
                ) : isWaitlisted ? (
                  <span>Join Waitlist</span>
                ) : (
                  <span>Confirm Ticket & Pay &rarr;</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right Column - Sticky Fare Details Summary */}
        <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
          <FareDetailsCard
            flight={flight}
            selectedCabin={selectedCabin}
            passengerCount={passengers.length}
            mealTotal={mealTotal}
            seatTotal={seatTotal}
            onBookingAction={currentStepIndex < steps.length - 1 ? handleNext : handleConfirmBooking}
            actionButtonText={currentStepIndex < steps.length - 1 ? "Continue" : (isWaitlisted ? "Join Waitlist" : "Confirm Ticket & Pay")}
          />
        </div>
      </div>

      {/* Duplicate Passenger Confirmation Modal */}
      <DuplicatePassengerModal
        isOpen={showDuplicateModal}
        onConfirm={handleConfirmDuplicates}
        onCancel={handleCancelDuplicates}
      />
    </div>
  );
}
