import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { joinWaitlist, clearJoinState } from '@/store/waitlistSlice';
import { X, ArrowRight, Clock, Users, AlertCircle, Loader, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { INR } from '@/utils/formatters';

export default function WaitlistJoinModal({ flight, onClose, initialSeatCount = 1 }) {
  const dispatch = useDispatch();
  const { joinLoading, joinError, lastJoined } = useSelector((s) => s.waitlist);
  const [passengers, setPassengers] = useState(
    Array.from({ length: Math.max(1, initialSeatCount) }, () => ({
      name: '',
      age: '',
      gender: 'M',
      phone_number: '',
    }))
  );

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

  const [formError, setFormError] = useState(null);
  const handleConfirm = (e) => {
    e.preventDefault();
    setFormError(null);
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.name || !p.age || !p.gender) {
        setFormError(`Please fill all required fields for Passenger ${i + 1}`);
        return;
      }
    }
    dispatch(joinWaitlist({ flightId: flight.id, passengers }));
  };

  const handlePassengerChange = (index, field, value) => {
    const newPassengers = [...passengers];
    newPassengers[index] = { ...newPassengers[index], [field]: value };
    setPassengers(newPassengers);
  };

  const addPassenger = () => {
    setPassengers([...passengers, { name: '', age: '', gender: 'M', phone_number: '' }]);
  };

  const removePassenger = (index) => {
    if (passengers.length > 1) {
      setPassengers(passengers.filter((_, i) => i !== index));
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const totalPrice = flight.base_fare * passengers.length;

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
            width: '100%', maxWidth: 600,
            maxHeight: '90vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            boxSizing: 'border-box',
            borderRadius: 24, padding: '32px 36px',
            position: 'relative',
            boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
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

          {/* Passenger details */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1a1c1d' }}>Passenger Details</h3>
              <button type="button" onClick={addPassenger} style={{
                background: 'transparent', border: '1px dashed rgba(112,93,0,0.4)', borderRadius: 8,
                padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#705d00', cursor: 'pointer'
              }}>
                + Add Passenger
              </button>
            </div>
            
            {formError && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                padding: '10px 14px', marginBottom: 12,
                color: '#b91c1c', fontSize: 13,
              }}>
                <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {passengers.map((p, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: 12, padding: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#5e5e5e' }}>Passenger {i + 1}</span>
                    {passengers.length > 1 && (
                      <button type="button" onClick={() => removePassenger(i)} style={{
                        background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontWeight: 600
                      }}>Remove</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <input
                      type="text" placeholder="Full Name" required
                      value={p.name} onChange={(e) => handlePassengerChange(i, 'name', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                    />
                    <input
                      type="number" placeholder="Age" required min="1" max="120"
                      value={p.age} onChange={(e) => handlePassengerChange(i, 'age', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.04)', padding: 4, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                      {[
                        { id: 'M', label: 'Male' },
                        { id: 'F', label: 'Female' },
                        { id: 'O', label: 'Other' }
                      ].map(g => (
                        <button
                          key={g.id} type="button"
                          onClick={() => handlePassengerChange(i, 'gender', g.id)}
                          style={{
                            flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, fontSize: 12,
                            fontWeight: p.gender === g.id ? 700 : 500,
                            background: p.gender === g.id ? '#fff' : 'transparent',
                            color: p.gender === g.id ? '#705d00' : '#6b7280',
                            boxShadow: p.gender === g.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="tel" placeholder="Phone (Optional)"
                      value={p.phone_number} onChange={(e) => handlePassengerChange(i, 'phone_number', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(255,255,255,0.7)',
            borderRadius: 16,
            padding: '16px',
            marginBottom: 20,
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
                <Users size={13} /> {passengers.length} {passengers.length === 1 ? 'seat' : 'seats'} requested
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
