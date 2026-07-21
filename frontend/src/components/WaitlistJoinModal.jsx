import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { joinWaitlist, clearJoinState } from '@/store/waitlistSlice';
import { X, ArrowRight, Clock, Users, AlertCircle, Loader, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { INR } from '@/utils/formatters';

export default function WaitlistJoinModal({ flight, onClose, initialSeatCount = 1 }) {
  const dispatch = useDispatch();
  const { joinLoading, joinError, lastJoined } = useSelector((s) => s.waitlist);
  const [seatCount, setSeatCount] = useState(initialSeatCount);

  // Clear stale state on load/unload
  useEffect(() => {
    dispatch(clearJoinState());
    return () => {
      dispatch(clearJoinState());
    };
  }, [dispatch]);

  // Handle successful join
  useEffect(() => {
    if (lastJoined) {
      toast.success('Successfully joined the waitlist! ✈️');
      dispatch(clearJoinState());
      onClose();
    }
  }, [lastJoined, dispatch, onClose]);

  const handleConfirm = (e) => {
    e.preventDefault();
    dispatch(joinWaitlist({ flightId: flight.id, seatCount }));
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const totalPrice = flight.base_fare * seatCount;

  return (
    <>
      <style>{`
        @keyframes modal-slide-in {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
        .waitlist-modal { animation: modal-slide-in 0.28s cubic-bezier(.16,1,.3,1) both; }
        .confirm-btn:hover:not(:disabled) { background: #ffe333 !important; transform: translateY(-1px); }
        .confirm-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cancel-link:hover { color: #705d00 !important; }
      `}</style>

      {/* Backdrop */}
      <div
        id="waitlist-join-modal-backdrop"
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
          className="waitlist-modal glass-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="waitlist-modal-title"
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
            id="waitlist-modal-close"
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
                <Clock size={17} color="#705d00" />
              </div>
              <h2
                id="waitlist-modal-title"
                style={{
                  fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                  fontSize: 22, fontWeight: 800, color: '#1a1c1d',
                  letterSpacing: '-0.02em', margin: 0,
                }}
              >
                Join Flight Waiting List
              </h2>
            </div>
            <p style={{ fontSize: 13, color: '#5e5e5e', margin: 0 }}>
              This flight is fully booked. Join the queue for automatic seat allocation if booking spots open up.
            </p>
          </div>

          {/* Selection of seat count */}
          <div style={{
            background: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(255,255,255,0.7)',
            borderRadius: 16, padding: '20px 22px',
            marginBottom: 20,
          }}>
            <label
              htmlFor="seat-count-select"
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: '#9e9488',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8
              }}
            >
              Number of Seats to Reserve
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <select
                id="seat-count-select"
                value={seatCount}
                onChange={(e) => setSeatCount(Number(e.target.value))}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: 'rgba(255,255,255,0.8)',
                  fontSize: 14,
                  fontWeight: 600,
                  outline: 'none',
                  color: '#1a1c1d'
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'Seat' : 'Seats'}
                  </option>
                ))}
              </select>
            </div>

            <div style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 11,
              color: '#6b7280'
            }}>
              <ShieldAlert size={14} style={{ color: '#b45309', flexShrink: 0, marginTop: 1 }} />
              <div>
                Auto-allocation is FIFO. If a booking is cancelled, seats will be allocated to the first waitlist entry that fits within the released capacity.
              </div>
            </div>
          </div>

          {/* Pricing Info */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 20, padding: '12px 16px',
            background: 'rgba(255,215,0,0.08)', borderRadius: 12,
            border: '1px solid rgba(255,215,0,0.2)',
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#5e5e5e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pre-authorized Fare</div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', letterSpacing: '-0.02em' }}>
                {INR(totalPrice)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#b45309', fontSize: 12, fontWeight: 700 }}>
                <Users size={13} /> {seatCount} {seatCount === 1 ? 'seat' : 'seats'} requested
              </div>
              <div style={{ fontSize: 11, color: '#5e5e5e', marginTop: 2 }}>
                Refundable processing
              </div>
            </div>
          </div>

          {/* Rules / Policy alert */}
          <div style={{
            background: 'rgba(0,0,0,0.02)',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: 12,
            padding: '12px 14px',
            fontSize: 12,
            color: '#4b5563',
            marginBottom: 20,
            lineHeight: 1.5,
          }}>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              <li>If you cancel your waitlist request, a <strong>5% processing fee</strong> will be deducted from your refund.</li>
              <li>If the flight departs and you are not promoted, a <strong>100% refund</strong> will be automatically credited.</li>
              <li>You can view and track your queue position from <strong>My Bookings</strong> &gt; <strong>My Waitlist</strong>.</li>
            </ul>
          </div>

          {/* Error message */}
          {joinError && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
              padding: '10px 14px', marginBottom: 16,
              color: '#b91c1c', fontSize: 13,
            }}>
              <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>
                {typeof joinError === 'string' ? joinError : 'Failed to join waitlist. Please try again.'}
              </span>
            </div>
          )}

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              id="waitlist-modal-cancel-btn"
              onClick={onClose}
              className="cancel-link"
              disabled={joinLoading}
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
              id="waitlist-modal-confirm-btn"
              onClick={handleConfirm}
              className="confirm-btn"
              disabled={joinLoading}
              style={{
                flex: 2, background: '#ffd700', color: '#1a1c1d',
                fontWeight: 700, fontSize: 15, border: 'none',
                borderRadius: 12, padding: '13px 20px', cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(255,215,0,0.4)',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {joinLoading ? (
                <>
                  <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Joining Queue...
                </>
              ) : (
                <>
                  Join Waitlist <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
