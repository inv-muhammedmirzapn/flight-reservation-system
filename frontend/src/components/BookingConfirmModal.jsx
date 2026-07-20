import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createBooking, clearCreateState } from '@/store/bookingSlice';
import { Plane, X, ArrowRight, Clock, Users, AlertCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

/* ── helpers ─────────────────────────────────────── */
const INR = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

const diffHM = (dep, arr) => {
  try {
    const ms = new Date(arr) - new Date(dep);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  } catch {
    return 'N/A';
  }
};

/* ─────────────────────────────────────────────────── */

export default function BookingConfirmModal({ flight, onClose }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { createLoading, createError, lastCreated } = useSelector((s) => s.bookings);

  // Clear any stale booking state when the modal opens or closes
  useEffect(() => {
    dispatch(clearCreateState());
    return () => { dispatch(clearCreateState()); };
  }, [dispatch]);

  // Navigate to confirmation page on success
  useEffect(() => {
    if (lastCreated) {
      toast.success('Booking confirmed! ✈️');
      dispatch(clearCreateState());
      navigate(`/bookings/${lastCreated.id}/confirmation`, {
        state: { booking: lastCreated, flight },
      });
    }
  }, [lastCreated, dispatch, navigate, flight]);

  const handleConfirm = (e) => {
    e.preventDefault();
    dispatch(createBooking(flight.id));
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const duration = diffHM(flight.departure_time, flight.arrival_time);

  return (
    <>
      <style>{`
        @keyframes modal-slide-in {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
        .confirm-modal { animation: modal-slide-in 0.28s cubic-bezier(.16,1,.3,1) both; }
        .confirm-btn:hover:not(:disabled) { background: #ffe333 !important; transform: translateY(-1px); }
        .confirm-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cancel-link:hover { color: #705d00 !important; }
      `}</style>

      {/* Backdrop */}
      <div
        id="booking-confirm-modal-backdrop"
        onClick={handleBackdropClick}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}
      >
        {/* Modal card */}
        <div
          className="confirm-modal glass-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
          style={{
            width: '100%', maxWidth: 520,
            borderRadius: 24, padding: '32px 36px',
            position: 'relative',
            boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
            overflow: 'hidden',
          }}
        >
          {/* Glow blob */}
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 160, height: 160,
            borderRadius: '50%', background: '#ffd700', filter: 'blur(80px)',
            opacity: 0.15, pointerEvents: 'none',
          }} />

          {/* Close button */}
          <button
            id="booking-modal-close"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(0,0,0,0.06)', border: 'none',
              borderRadius: 10, width: 34, height: 34,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}
          >
            <X size={16} color="#5e5e5e" />
          </button>

          {/* Header */}
          <div style={{ marginBottom: 24, paddingRight: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'rgba(255,215,0,0.15)',
                border: '1px solid rgba(255,215,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plane size={17} color="#705d00" style={{ transform: 'rotate(-45deg)' }} />
              </div>
              <h2
                id="booking-modal-title"
                style={{
                  fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                  fontSize: 22, fontWeight: 800, color: '#1a1c1d',
                  letterSpacing: '-0.02em', margin: 0,
                }}
              >
                Confirm Booking
              </h2>
            </div>
            <p style={{ fontSize: 13, color: '#5e5e5e', margin: 0 }}>
              Review your flight details before confirming
            </p>
          </div>

          {/* Flight summary card */}
          <div style={{
            background: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(255,255,255,0.7)',
            borderRadius: 16, padding: '20px 22px',
            marginBottom: 20,
          }}>
            {/* Route */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center', gap: 12, marginBottom: 16,
            }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1c1d', lineHeight: 1 }}>
                  {fmtTime(flight.departure_time)}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1c1d', marginTop: 2 }}>
                  {flight.source_airport}
                </div>
                <div style={{ fontSize: 11, color: '#5e5e5e', marginTop: 2 }}>
                  {fmtDate(flight.departure_time)}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#5e5e5e', fontWeight: 600 }}>
                  <Clock size={11} color="#705d00" />{duration}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', width: 80 }}>
                  <div style={{ flex: 1, height: 1.5, background: '#d0c6ab' }} />
                  <Plane size={13} color="#705d00" />
                  <div style={{ flex: 1, height: 1.5, background: '#d0c6ab' }} />
                </div>
                <div style={{ fontSize: 10, color: '#705d00', fontWeight: 700 }}>Non-stop</div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1c1d', lineHeight: 1 }}>
                  {fmtTime(flight.arrival_time)}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1c1d', marginTop: 2 }}>
                  {flight.destination_airport}
                </div>
                <div style={{ fontSize: 11, color: '#5e5e5e', marginTop: 2 }}>
                  {fmtDate(flight.arrival_time)}
                </div>
              </div>
            </div>

            {/* Details row */}
            <div style={{
              display: 'flex', gap: 12, flexWrap: 'wrap',
              paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.06)',
            }}>
              {[
                { label: 'Flight', value: flight.flight_number },
                { label: 'Airline', value: flight.airline },
                { label: 'Aircraft', value: flight.aircraft },
              ].map(({ label, value }) => (
                <div key={label} style={{ flex: '1 1 120px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#9e9488', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1c1d' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Price & seats */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 20, padding: '12px 16px',
            background: 'rgba(255,215,0,0.08)', borderRadius: 12,
            border: '1px solid rgba(255,215,0,0.2)',
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#5e5e5e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Fare</div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', letterSpacing: '-0.02em' }}>
                {INR(flight.base_fare)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#065f46', fontSize: 12, fontWeight: 700 }}>
                <Users size={13} />{flight.available_seats} seats left
              </div>
              <div style={{ fontSize: 11, color: '#5e5e5e', marginTop: 2 }}>Economy class</div>
            </div>
          </div>

          {/* Error message */}
          {createError && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
              padding: '10px 14px', marginBottom: 16,
              color: '#b91c1c', fontSize: 13,
            }}>
              <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>
                {/* Guard: never render raw HTML or server stack traces */}
                {typeof createError === 'string' && createError.length < 300 && !createError.startsWith('<')
                  ? createError
                  : 'Booking failed. Please try again.'}
              </span>
            </div>
          )}

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              id="booking-modal-cancel-btn"
              onClick={onClose}
              className="cancel-link"
              disabled={createLoading}
              style={{
                flex: 1, background: 'transparent', border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 12, padding: '13px 20px', cursor: 'pointer',
                fontWeight: 700, fontSize: 14, color: '#5e5e5e',
                transition: 'all 0.2s',
              }}
            >
              Cancel
            </button>
            <button
              id="booking-modal-confirm-btn"
              onClick={handleConfirm}
              className="confirm-btn"
              disabled={createLoading}
              style={{
                flex: 2, background: '#ffd700', color: '#1a1c1d',
                fontWeight: 700, fontSize: 15, border: 'none',
                borderRadius: 12, padding: '13px 20px', cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(255,215,0,0.4)',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {createLoading ? (
                <>
                  <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Booking...
                </>
              ) : (
                <>
                  Confirm Booking <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
