import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { bookingAPI } from "@/services/booking-service/bookingService";
import { waitlistAPI } from "@/services/waitlist-service/waitlistService";
import TicketCard from "@/components/bookings/TicketCard";

export default function MyBookingsPage() {
  const navigate = useNavigate();
  const auth = useSelector((state) => state?.auth) || {};
  const isAuthenticated = Boolean(auth.isAuthenticated || auth.token);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    let isMounted = true;
    setLoading(true);

    async function fetchBookingsAndWaitlist() {
      try {
        const [bookingsRes, waitlistRes] = await Promise.allSettled([
          bookingAPI.list(),
          waitlistAPI.list(),
        ]);

        const rawBookings = bookingsRes.status === "fulfilled" ? (Array.isArray(bookingsRes.value) ? bookingsRes.value : bookingsRes.value?.results || []) : [];
        const rawWaitlist = waitlistRes.status === "fulfilled" ? (Array.isArray(waitlistRes.value) ? waitlistRes.value : waitlistRes.value?.results || []) : [];

        const taggedBookings = rawBookings.map((b) => ({ ...b, itemType: "BOOKING" }));
        const taggedWaitlist = rawWaitlist.map((w) => ({ ...w, itemType: "WAITLIST" }));

        // Merge both lists
        const combined = [...taggedBookings, ...taggedWaitlist];

        // Sort newest first by created_at
        combined.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        if (isMounted) {
          setItems(combined);
        }
      } catch (err) {
        console.error("Error fetching bookings & waitlists:", err);
        if (isMounted) {
          setError("Failed to load your bookings. Please try again.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchBookingsAndWaitlist();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, navigate]);

  return (
    <div className="flex-1 min-h-screen mt-12 pt-12 pb-16 px-4 md:px-6 max-w-5xl mx-auto w-full">
      {/* Heading */}
      <h1 className="text-2xl font-bold text-slate-950 mb-6 ml-2">
        My Bookings
      </h1>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-36 bg-slate-200/70 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="plain-card rounded-3xl p-8 text-center space-y-3">
          <span className="material-symbols-outlined text-3xl text-rose-500">error</span>
          <p className="text-sm font-semibold text-slate-700">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="plain-card rounded-3xl p-10 text-center space-y-4 max-w-md mx-auto mt-6">
          <span className="material-symbols-outlined text-4xl text-slate-400">
            airplane_ticket
          </span>
          <h3 className="text-base font-bold text-slate-900">No Bookings Found</h3>
          <p className="text-xs text-slate-500">
            You don&apos;t have any active flight bookings or waitlisted tickets yet.
          </p>
          <button
            type="button"
            onClick={() => navigate("/flights")}
            className="btn-primary text-slate-950 px-5 py-2.5 rounded-full text-xs font-bold shadow-2xs"
          >
            Search Flights
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {items.map((item) => (
            <TicketCard key={`${item.itemType}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
