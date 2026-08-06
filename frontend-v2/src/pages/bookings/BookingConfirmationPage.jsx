import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { bookingAPI } from "@/services/booking-service/bookingService";
import { waitlistAPI } from "@/services/waitlist-service/waitlistService";
import TicketInvoice from "@/components/bookings/TicketInvoice";

export default function BookingConfirmationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isWaitlist = location.pathname.includes("/waitlist");

  const auth = useSelector((state) => state?.auth) || {};
  const isAuthenticated = Boolean(auth.isAuthenticated || auth.token);
  const userEmail = auth.profile?.email || auth.decodedToken?.email || "your registered email";

  const [detailData, setDetailData] = useState(location.state?.booking || location.state?.waitlist || null);
  const [loading, setLoading] = useState(!detailData);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

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
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (id) {
      fetchDetail();
    }
  }, [id, isWaitlist, detailData, isAuthenticated, navigate]);

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
        {isWaitlist ? "Waitlist Ticket" : "Booking Confirmed!"}
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

      {/* Ticket Invoice Component */}
      <TicketInvoice
        detailData={detailData}
        isWaitlist={isWaitlist}
        locationStateFlight={location.state?.flight}
        locationStatePassengers={location.state?.passengers}
      />
    </div>
  );
}
