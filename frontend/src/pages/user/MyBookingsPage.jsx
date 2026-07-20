import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchMyBookings, cancelBooking } from '@/store/bookingSlice';
import {
  Plane, ArrowRight, Clock, Calendar, AlertCircle, Loader,
  CheckCircle, XCircle, RefreshCw, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ── helpers ─────────────────────────────────────── */
const INR = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

const fmtBookingDate = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

/* ── Status badge ────────────────────────────────── */
function StatusBadge({ status }) {
  const styles = {
    CONFIRMED: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', icon: <CheckCircle size={11} /> },
    CANCELLED: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', icon: <XCircle size={11} /> },
  };
  const s = styles[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db', icon: null };
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 9999, padding: '4px 12px',
      fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {s.icon}{status}
    </span>
  );
}

/* ── Booking Card ────────────────────────────────── */
function BookingCard({ booking, onCancel, cancellingId }) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const flight = booking.flight_detail;
  const isConfirmed = booking.status === 'CONFIRMED';
  const isCancelling = cancellingId === booking.id;

  if (!flight) return null;

  const isPast = new Date(flight.departure_time) < new Date();

  return (
    <div style={{
      background: 'rgba(255,255,255,0.65)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 20, padding: '22px 26px',
      transition: 'box-shadow 0.2s',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle glow */}
      {isConfirmed && (
        <div style={{
          position: 'absolute', top: -20, right: -20, width: 100, height: 100,
          borderRadius: '50%', background: '#ffd700', filter: 'blur(50px)',
          opacity: 0.12, pointerEvents: 'none',
        }} />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plane size={14} color="#705d00" style={{ transform: 'rotate(-45deg)' }} />
            </div>
            <span style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 18, fontWeight: 800, color: '#1a1c1d' }}>
              {flight.flight_number}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#5e5e5e', marginLeft: 40 }}>{flight.airline} · {flight.aircraft}</div>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Route timeline */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', gap: 12, marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1c1d', lineHeight: 1 }}>{fmtTime(flight.departure_time)}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1c1d', marginTop: 2 }}>{flight.source_airport}</div>
          <div style={{ fontSize: 11, color: '#5e5e5e', marginTop: 2 }}>{fmtDate(flight.departure_time)}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <div style={{ flex: 1, height: 1.5, background: '#d0c6ab' }} />
            <Plane size={12} color="#705d00" />
            <div style={{ flex: 1, height: 1.5, background: '#d0c6ab' }} />
          </div>
          <div style={{ fontSize: 10, color: '#705d00', fontWeight: 700 }}>Direct</div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1c1d', lineHeight: 1 }}>{fmtTime(flight.arrival_time)}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1c1d', marginTop: 2 }}>{flight.destination_airport}</div>
          <div style={{ fontSize: 11, color: '#5e5e5e', marginTop: 2 }}>{fmtDate(flight.arrival_time)}</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.06)',
        flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Fare</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1c1d' }}>{INR(flight.base_fare)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Booked</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5e5e5e' }}>{fmtBookingDate(booking.created_at)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Ref.</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1c1d', letterSpacing: '0.04em' }}>
              {String(booking.id).slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Cancel action */}
        {isConfirmed && !isPast && (
          !showCancelConfirm ? (
            <button
              id={`cancel-booking-btn-${booking.id}`}
              onClick={() => setShowCancelConfirm(true)}
              style={{
                background: 'transparent', border: '1px solid #fca5a5',
                color: '#b91c1c', fontWeight: 700, fontSize: 12,
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Cancel Booking
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#5e5e5e', fontWeight: 600 }}>Sure?</span>
              <button
                id={`cancel-confirm-yes-${booking.id}`}
                onClick={() => { setShowCancelConfirm(false); onCancel(booking.id); }}
                disabled={isCancelling}
                style={{
                  background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c',
                  fontWeight: 700, fontSize: 12, padding: '8px 14px', borderRadius: 10,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {isCancelling ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                Yes, Cancel
              </button>
              <button
                id={`cancel-confirm-no-${booking.id}`}
                onClick={() => setShowCancelConfirm(false)}
                style={{
                  background: 'transparent', border: '1px solid rgba(0,0,0,0.12)',
                  color: '#5e5e5e', fontWeight: 700, fontSize: 12,
                  padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          )
        )}

        {isPast && isConfirmed && (
          <span style={{ fontSize: 12, color: '#9e9488', fontWeight: 600 }}>Flight departed</span>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────── */
export default function MyBookingsPage() {
  const dispatch = useDispatch();
  const { list, listLoading, listError, cancelLoadingId, cancelError } = useSelector((s) => s.bookings);
  const [filter, setFilter] = useState('ALL'); // ALL | CONFIRMED | CANCELLED

  useEffect(() => {
    dispatch(fetchMyBookings());
  }, [dispatch]);

  useEffect(() => {
    if (cancelError) {
      toast.error(cancelError);
    }
  }, [cancelError]);

  const handleCancel = (bookingId) => {
    dispatch(cancelBooking(bookingId)).then((action) => {
      if (!action.error) toast.success('Booking cancelled.');
    });
  };

  const filtered = list.filter((b) => filter === 'ALL' || b.status === filter);

  return (
    <>
      <style>{`
        .filter-chip { transition: all 0.15s; cursor: pointer; border: none; }
        .filter-chip:hover { opacity: 0.8; }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .booking-list-item { animation: fade-up 0.3s ease both; }
      `}</style>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
            fontSize: 30, fontWeight: 800, color: '#1a1c1d',
            letterSpacing: '-0.02em', margin: '0 0 6px',
          }}>
            My Bookings
          </h1>
          <p style={{ fontSize: 14, color: '#5e5e5e', margin: 0 }}>
            Manage all your flight reservations in one place.
          </p>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { key: 'ALL',       label: 'All' },
            { key: 'CONFIRMED', label: 'Confirmed' },
            { key: 'CANCELLED', label: 'Cancelled' },
          ].map(({ key, label }) => (
            <button
              key={key}
              id={`filter-${key.toLowerCase()}`}
              className="filter-chip"
              onClick={() => setFilter(key)}
              style={{
                padding: '8px 18px', borderRadius: 10,
                fontSize: 13, fontWeight: 700,
                background: filter === key ? '#1a1c1d' : 'rgba(255,255,255,0.6)',
                color: filter === key ? '#fff' : '#5e5e5e',
                border: `1px solid ${filter === key ? '#1a1c1d' : 'rgba(0,0,0,0.1)'}`,
              }}
            >
              {label}
              {key !== 'ALL' && (
                <span style={{
                  marginLeft: 6,
                  background: filter === key ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
                  borderRadius: 9999, padding: '1px 7px', fontSize: 11,
                }}>
                  {list.filter((b) => b.status === key).length}
                </span>
              )}
            </button>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              id="refresh-bookings-btn"
              onClick={() => dispatch(fetchMyBookings())}
              disabled={listLoading}
              style={{
                background: 'transparent', border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                color: '#5e5e5e', fontWeight: 600, fontSize: 12,
              }}
            >
              <RefreshCw size={13} style={listLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              Refresh
            </button>
          </div>
        </div>

        {/* Loading */}
        {listLoading && !list.length && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '30vh' }}>
            <Loader size={36} color="#705d00" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {/* Error */}
        {listError && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14,
            padding: '18px 22px', color: '#b91c1c',
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 20,
          }}>
            <AlertCircle size={18} />
            <span>{listError}</span>
          </div>
        )}

        {/* Empty state */}
        {!listLoading && !listError && filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(255,215,0,0.1)',
              border: '1px solid rgba(255,215,0,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <Search size={30} color="#d0c6ab" />
            </div>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 20, fontWeight: 700, color: '#1a1c1d', margin: '0 0 8px' }}>
              {filter === 'ALL' ? 'No bookings yet' : `No ${filter.toLowerCase()} bookings`}
            </h3>
            <p style={{ fontSize: 14, color: '#5e5e5e', marginBottom: 24 }}>
              {filter === 'ALL'
                ? "Book a flight to see your reservations here."
                : "Switch filters or book a new flight."}
            </p>
            <Link
              to="/flights"
              id="explore-flights-empty-btn"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#ffd700', color: '#1a1c1d',
                fontWeight: 700, fontSize: 14,
                padding: '12px 24px', borderRadius: 12,
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(255,215,0,0.35)',
              }}
            >
              Explore Flights <ArrowRight size={15} />
            </Link>
          </div>
        )}

        {/* Booking list */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtered.map((booking, i) => (
              <div
                key={booking.id}
                className="booking-list-item"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <BookingCard
                  booking={booking}
                  onCancel={handleCancel}
                  cancellingId={cancelLoadingId}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
