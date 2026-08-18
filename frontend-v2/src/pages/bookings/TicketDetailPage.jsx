import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { bookingAPI } from "@/services/booking-service/bookingService";
import { waitlistAPI } from "@/services/waitlist-service/waitlistService";
import TicketInvoice from "@/components/bookings/TicketInvoice";
import toast from "react-hot-toast";

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isWaitlist = location.pathname.includes("/waitlist");

  const auth = useSelector((state) => state?.auth) || {};
  const isAuthenticated = Boolean(auth.isAuthenticated || auth.token);

  const [detailData, setDetailData] = useState(location.state?.booking || location.state?.waitlist || null);
  const [loading, setLoading] = useState(!detailData);
  const [pdfLoading, setPdfLoading] = useState(false);

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
        console.error("Error fetching ticket details:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (id) {
      fetchDetail();
    }
  }, [id, isWaitlist, detailData, isAuthenticated, navigate]);

  const formatBookedAt = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    const day = d.getDate();
    
    const getOrdinal = (n) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    
    const month = d.toLocaleString("en-US", { month: "long" });
    const year = d.getFullYear();
    return `${hours}:${mins} on ${getOrdinal(day)} ${month}, ${year}`;
  };

  const bookedAtTimestamp = detailData?.created_at || location.state?.booking?.created_at || location.state?.waitlist?.created_at;
  const bookedAtText = formatBookedAt(bookedAtTimestamp);

  const ticketStatus = String(detailData?.status || "").toUpperCase();
  const isCancelledOrExpired = ticketStatus === "CANCELLED" || ticketStatus === "EXPIRED";
  const isConfirmed = ticketStatus === "CONFIRMED";

  const handleDownloadPdf = async () => {
    if (!detailData) return;
    setPdfLoading(true);
    try {
      const refCode = String(detailData.id).replace(/-/g, '').toUpperCase().slice(0, 8);
      await bookingAPI.downloadPdf(detailData.id, refCode);
      toast.success('Ticket PDF downloaded!');
    } catch (err) {
      toast.error(err.message || 'Failed to download PDF.');
    } finally {
      setPdfLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-slate-50/60 pt-20 pb-16 px-4 max-w-3xl mx-auto w-full flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-slate-300 border-t-slate-900 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600">Loading Ticket Details...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen mt-16 pt-12 pb-16 px-4 sm:px-6 max-w-3xl mx-auto w-full flex flex-col items-center">
      {/* Header bar with Back to Bookings and Download PDF */}
      <div className="w-full flex flex-wrap items-center justify-between gap-4 mb-6 px-1">
        <button
          type="button"
          onClick={() => navigate("/my-bookings", { state: { showPastBookings: location.state?.showPastBookings } })}
          className="text-xs font-semibold text-slate-600 hover:text-slate-950 cursor-pointer transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to bookings
        </button>

        <div className="flex items-center gap-3">
          {bookedAtText && (
            <span className="text-xs font-semibold text-slate-500">
              Booked at {bookedAtText}
            </span>
          )}

          {/* Download PDF — confirmed bookings only */}
          {!isWaitlist && isConfirmed && (
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-900 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pdfLoading ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-700 border-t-transparent animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-sm">download</span>
              )}
              {pdfLoading ? 'Generating…' : 'Download PDF'}
            </button>
          )}
        </div>
      </div>

      {/* Ticket Invoice Component */}
      <TicketInvoice
        detailData={detailData}
        isWaitlist={isWaitlist}
        locationStateFlight={location.state?.flight}
        locationStatePassengers={location.state?.passengers}
      />


      {!isCancelledOrExpired && (
        <div className="w-full mt-6 flex justify-center">
          <button
            type="button"
            onClick={() =>
              navigate(
                isWaitlist
                  ? `/my-bookings/cancel/waitlist/${id}`
                  : `/my-bookings/cancel/${id}`,
                {
                  state: {
                    booking: detailData,
                    waitlist: detailData,
                    flight: detailData?.flight_detail || location.state?.flight,
                    showPastBookings: location.state?.showPastBookings,
                  },
                }
              )
            }
            className="btn-danger text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 animate-fade-in"
          >
            <span className="material-symbols-outlined text-base">cancel</span>
            Cancel Ticket
          </button>
        </div>
      )}
    </div>
  );
}
