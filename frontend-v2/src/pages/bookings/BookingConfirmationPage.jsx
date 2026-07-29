import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { bookingAPI } from "@/services/booking-service/bookingService";
import { waitlistAPI } from "@/services/waitlist-service/waitlistService";
import FlightItineraryCard from "@/components/flights/FlightItineraryCard";

export default function BookingConfirmationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isWaitlist = location.pathname.includes("/waitlist");

  const auth = useSelector((state) => state?.auth) || {};
  const userEmail = auth.profile?.email || auth.decodedToken?.email || "your registered email";

  const [detailData, setDetailData] = useState(location.state?.booking || location.state?.waitlist || null);
  const [loading, setLoading] = useState(!detailData);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (detailData) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    async function fetchDetail() {
      try {
        let res;
        if (isWaitlist) {
          res = await waitlistAPI.retrieve(id);
        } else {
          res = await bookingAPI.retrieve(id);
        }
        if (isMounted) {
          setDetailData(res);
        }
      } catch (err) {
        console.error("Error fetching confirmation details:", err);
        if (isMounted) {
          setError("Unable to load booking details.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (id) {
      fetchDetail();
    }
  }, [id, isWaitlist, detailData]);

  const flight = detailData?.flight_detail || location.state?.flight || {};
  const passengers = detailData?.passengers || location.state?.passengers || [];

  const unitFare = Number(flight.base_fare) || 0;
  const seatCount = detailData?.seat_count || passengers.length || 1;
  const totalBaseFare = Math.round(unitFare * seatCount);
  const taxesAndOther = Math.round(totalBaseFare * 0.12);
  const grandTotal = detailData?.total_price || detailData?.price || (totalBaseFare + taxesAndOther);

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-slate-50/60 pt-20 pb-16 px-4 max-w-3xl mx-auto w-full flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-slate-300 border-t-slate-900 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600">Generating Ticket Invoice...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen mt-16 pt-12 pb-16 px-4 sm:px-6 max-w-3xl mx-auto w-full flex flex-col items-center">
      {/* Top Circle Check Icon */}
      <div className="w-12 h-12 rounded-full border-2 border-slate-950 flex items-center justify-center bg-white shadow-2xs mb-4">
        <span className="material-symbols-outlined text-2xl text-slate-950 font-black select-none">
          check
        </span>
      </div>

      {/* Main Heading */}
      <h1 className="text-xl font-bold text-slate-950 text-center mb-6">
        {isWaitlist ? "Waitlist Confirmed!" : "Booking Confirmed!"}
      </h1>

      {/* Action Buttons Header Bar */}
      <div className="flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => navigate("/my-bookings")}
          className="btn-primary text-slate-950 px-6 py-2 rounded-xl text-sm font-bold shadow-2xs"
        >
          View Bookings
        </button>
        <button
          type="button"
          onClick={() => navigate("/flights")}
          className="bg-slate-950 text-white font-semibold px-6 py-2 rounded-xl hover:bg-slate-800 transition-all cursor-pointer text-sm shadow-2xs active:scale-95"
        >
          Back
        </button>
      </div>

      {/* Email Delivery Confirmation Banner */}
      <div className="px-5 flex items-center justify-center gap-2 text-sky-950 text-[10px] font-medium mb-8">
        <span className="material-symbols-outlined text-base text-sky-700 select-none flex-shrink-0 mt-0.5">
          mark_email_read
        </span>
          <p className="text-sky-900/90 mt-0.5">
            A detailed ticket invoice and confirmation receipt have been dispatched to <strong>{userEmail}</strong>.
          </p>
      </div>

      {/* Ticket Invoice Details Container Card (Reuses booking-container-card) */}
      <div className="booking-container-card w-full space-y-6 shadow-xs text-slate-900 animate-fade-in">
        {/* Invoice Card Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mx-5 border-b border-slate-300/80">
          <div>
            <span className="text-xs font-bold text-slate-500 tracking-wide block">
              {isWaitlist ? "Waitlist ID" : "Booking ID"}
            </span>
            <span className="text-xs font-bold text-slate-950">
              #{detailData?.id ? String(detailData.id).slice(0, 8).toUpperCase() : "BK-893041"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3.5 py-2 rounded-xl text-xs font-extrabold ${
              isWaitlist
                ? "bg-amber-100 border border-amber-300 text-amber-950"
                : "bg-emerald-100 border border-emerald-300 text-emerald-950"
            }`}>
              {isWaitlist ? `Waitlisted ${detailData?.queue_position ? `#${detailData.queue_position}` : ""}` : "Confirmed"}
            </span>
          </div>
        </div>

        {/* Reused Flight Itinerary Card */}
        <FlightItineraryCard flight={flight} showBadge={false} />

        {/* Passenger List Box (Reuses timeline-card) */}
        <div className="px-5 pb-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-500 tracking-wide mb-5">
            Passenger Details ({passengers.length || seatCount})
          </h4>
          <div className="flex flex-col gap-3">
            {passengers.length > 0 ? (
              passengers.map((p, idx) => (
                <div key={idx} className="timeline-card flex items-top gap-5 font-medium">
                  <span className="material-symbols-outlined text-slate-400 -mt-1 text-lg">
                    person
                  </span>
                  <div>
                    <p className="font-bold text-slate-950 text-sm">{p.name || `Passenger ${idx + 1}`}</p>
                    <p className="text-slate-500 text-[10px] mt-2">{p.gender}, {p.age} yrs</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs font-medium text-slate-600">
                {seatCount} Passenger(s)
              </div>
            )}
          </div>
        </div>

        {/* Fare Summary Breakdown (Reuses timeline-card) */}
        <div className="px-5 pb-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-500 tracking-wider mb-6">
            Payment Summary
          </h4>
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Base Fare ({seatCount} seat{seatCount > 1 ? "s" : ""})</span>
            <span className="font-bold text-slate-950">₹ {totalBaseFare.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium pb-3">
            <span>Taxes & Service Charges</span>
            <span className="font-bold text-slate-950">₹ {taxesAndOther.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center justify-between text-base font-extrabold text-slate-950 pt-3 border-t border-slate-200/80">
            <span>Total Paid</span>
            <span>₹ {Number(grandTotal).toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
