import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchMyBookings, cancelBooking } from '@/store/bookingSlice';
import {
  Plane, ArrowRight, AlertCircle, Loader,
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

/* ── Booking List Item ───────────────────────────── */
function BookingListItem({ booking, isSelected, onClick }) {
  const flight = booking.flight_detail;
  
  if (!flight) return null;

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? '#ffffff' : 'rgba(255,255,255,0.65)',
        border: `1px solid ${isSelected ? '#ffd700' : 'rgba(255,255,255,0.7)'}`,
        boxShadow: isSelected ? '0 4px 20px rgba(255,215,0,0.15)' : 'none',
        borderRadius: 16, padding: '16px 20px',
        cursor: 'pointer', transition: 'all 0.2s',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Plane size={12} color="#705d00" style={{ transform: 'rotate(-45deg)' }} />
          </div>
          <span style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 16, fontWeight: 800, color: '#1a1c1d' }}>
            {flight.flight_number}
          </span>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1c1d', lineHeight: 1 }}>{fmtTime(flight.departure_time)}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1c1d', marginTop: 2 }}>{flight.source_airport}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '0 16px' }}>
           <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 4 }}>
             <div style={{ flex: 1, height: 1, background: '#d0c6ab' }} />
             <Plane size={10} color="#705d00" />
             <div style={{ flex: 1, height: 1, background: '#d0c6ab' }} />
           </div>
           <div style={{ fontSize: 9, color: '#705d00', fontWeight: 700, marginTop: 4 }}>Direct</div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1c1d', lineHeight: 1 }}>{fmtTime(flight.arrival_time)}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1c1d', marginTop: 2 }}>{flight.destination_airport}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Booking Detail Card ─────────────────────────── */
function BookingDetailCard({ booking, onCancel, cancellingId }) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  
  // reset confirm state when booking changes
  useEffect(() => setShowCancelConfirm(false), [booking?.id]);

  if (!booking || !booking.flight_detail) return (
    <div style={{
      background: 'rgba(255,255,255,0.4)', borderRadius: 24, border: '1px dashed rgba(0,0,0,0.1)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: 400, color: '#9e9488'
    }}>
       <Plane size={32} opacity={0.2} style={{ marginBottom: 12 }} />
       <p style={{ fontSize: 14, fontWeight: 600 }}>Select a booking to view details</p>
    </div>
  );

  const flight = booking.flight_detail;
  const isConfirmed = booking.status === 'CONFIRMED';
  const isCancelling = cancellingId === booking.id;
  const isPast = new Date(flight.departure_time) < new Date();

  return (
    <div className="booking-detail-card" style={{
      background: '#fff',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 24,
      boxShadow: '0 12px 32px rgba(0,0,0,0.05)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header pattern */}
      <div style={{
        background: '#1a1c1d',
        height: 70, position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: '#ffd700', opacity: 0.1, filter: 'blur(30px)' }} />
      </div>

      <div style={{ padding: '0 20px 20px', position: 'relative', marginTop: -28 }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#5e5e5e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Booking Ref</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1c1d', letterSpacing: '0.04em' }}>{String(booking.id).slice(0, 8).toUpperCase()}</div>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
           <div style={{
             width: 36, height: 36, borderRadius: 12,
             background: 'rgba(255,215,0,0.15)',
             display: 'flex', alignItems: 'center', justifyContent: 'center',
           }}>
             <Plane size={16} color="#705d00" style={{ transform: 'rotate(-45deg)' }} />
           </div>
           <div>
             <div style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 18, fontWeight: 800, color: '#1a1c1d' }}>
               {flight.flight_number}
             </div>
             <div style={{ fontSize: 12, color: '#5e5e5e' }}>{flight.airline} · {flight.aircraft}</div>
           </div>
        </div>

        {/* Departure/Arrival Timeline */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
           <div>
             <div style={{ fontSize: 12, color: '#5e5e5e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Departure</div>
             <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1c1d', margin: '2px 0' }}>{fmtTime(flight.departure_time)}</div>
             <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1c1d' }}>{flight.source_airport}</div>
             <div style={{ fontSize: 13, color: '#5e5e5e' }}>{fmtDate(flight.departure_time)}</div>
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '0 24px' }}>
             <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
               <div style={{ flex: 1, height: 2, background: 'linear-gradient(to right, #1a1c1d 50%, transparent 50%)', backgroundSize: '12px 100%' }} />
               <Plane size={18} color="#1a1c1d" style={{ transform: 'rotate(90deg)' }} />
               <div style={{ flex: 1, height: 2, background: 'linear-gradient(to right, #1a1c1d 50%, transparent 50%)', backgroundSize: '12px 100%' }} />
             </div>
           </div>

           <div style={{ textAlign: 'right' }}>
             <div style={{ fontSize: 12, color: '#5e5e5e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Arrival</div>
             <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1c1d', margin: '2px 0' }}>{fmtTime(flight.arrival_time)}</div>
             <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1c1d' }}>{flight.destination_airport}</div>
             <div style={{ fontSize: 12, color: '#5e5e5e' }}>{fmtDate(flight.arrival_time)}</div>
           </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, padding: '12px 16px', background: '#f8f9fa', borderRadius: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Fare</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1c1d' }}>{INR(flight.base_fare)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Booked On</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1c1d' }}>{fmtBookingDate(booking.created_at)}</div>
          </div>
        </div>

        {/* Action */}
        {isConfirmed && !isPast && (
          <div style={{ marginTop: 4 }}>
            {!showCancelConfirm ? (
              <button
                id={`cancel-booking-btn-${booking.id}`}
                onClick={() => setShowCancelConfirm(true)}
                style={{
                  width: '100%',
                  background: '#fff1f2', border: 'none',
                  color: '#e11d48', fontWeight: 700, fontSize: 13,
                  padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                  transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#ffe4e6'}
                onMouseOut={(e) => e.currentTarget.style.background = '#fff1f2'}
              >
                <XCircle size={15} /> Cancel Reservation
              </button>
            ) : (
              <div style={{ background: '#fff1f2', borderRadius: 12, padding: 14 }}>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#be123c', fontWeight: 700, textAlign: 'center' }}>Confirm Cancellation?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    id={`cancel-confirm-yes-${booking.id}`}
                    onClick={() => onCancel(booking.id)}
                    disabled={isCancelling}
                    style={{
                      flex: 1, background: '#e11d48', border: 'none', color: '#fff',
                      fontWeight: 700, fontSize: 12, padding: '8px', borderRadius: 8,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {isCancelling ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Yes, Cancel'}
                  </button>
                  <button
                    id={`cancel-confirm-no-${booking.id}`}
                    onClick={() => setShowCancelConfirm(false)}
                    style={{
                      flex: 1, background: 'transparent', border: '1px solid rgba(225,29,72,0.3)',
                      color: '#e11d48', fontWeight: 700, fontSize: 12,
                      padding: '8px', borderRadius: 8, cursor: 'pointer',
                    }}
                  >
                    No, Keep it
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {isPast && isConfirmed && (
          <div style={{ textAlign: 'center', padding: '12px', background: '#f3f4f6', borderRadius: 12, color: '#5e5e5e', fontSize: 13, fontWeight: 600 }}>
            This flight has departed
          </div>
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
  const [selectedBookingId, setSelectedBookingId] = useState(null);

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

  // Auto-select first booking
  useEffect(() => {
    if (filtered.length > 0) {
      if (!selectedBookingId || !filtered.find(b => b.id === selectedBookingId)) {
        setSelectedBookingId(filtered[0].id);
      }
    } else {
      setSelectedBookingId(null);
    }
  }, [filtered, selectedBookingId]);

  const selectedBooking = filtered.find(b => b.id === selectedBookingId);

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
        
        /* Master-Detail Layout */
        @media (min-width: 900px) {
          .bookings-layout {
            display: grid;
            grid-template-columns: 1fr 480px;
            gap: 32px;
            align-items: start;
          }
          .booking-detail-wrapper {
            position: sticky;
            top: 100px;
          }
        }
        @media (max-width: 899px) {
          .bookings-layout {
            display: flex;
            flex-direction: column-reverse;
            gap: 24px;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>
        <div className={filtered.length > 0 ? "bookings-layout" : ""}>
          {/* Left Column */}
          <div>
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

            {/* Master List */}
            {filtered.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filtered.map((booking, i) => (
                  <div
                    key={booking.id}
                    className="booking-list-item"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <BookingListItem
                      booking={booking}
                      isSelected={selectedBookingId === booking.id}
                      onClick={() => setSelectedBookingId(booking.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div> {/* End Left Column */}

          {/* Right Column: Detail Card */}
          {filtered.length > 0 && (
            <div className="booking-detail-wrapper">
               <BookingDetailCard
                 booking={selectedBooking}
                 onCancel={handleCancel}
                 cancellingId={cancelLoadingId}
               />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
