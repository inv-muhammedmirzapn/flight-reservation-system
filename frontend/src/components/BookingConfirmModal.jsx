import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createBooking, clearCreateState } from '@/store/bookingSlice';
import { Plane, X, ArrowRight, Clock, Users, AlertCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

import { INR, fmtTime, fmtDate, diffHM } from '@/utils/formatters';

import { useTranslation } from 'react-i18next';

/* ─────────────────────────────────────────────────── */

export default function BookingConfirmModal({ flight, totalPassengers = 1, onClose }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { createLoading, createError, lastCreated } = useSelector((s) => s.bookings);

  const [passengers, setPassengers] = useState(
    Array.from({ length: Math.max(1, totalPassengers) }, () => ({
      name: '',
      age: '',
      gender: 'M',
      phone_number: '',
    }))
  );

  // Clear any stale booking state when the modal opens or closes
  useEffect(() => {
    dispatch(clearCreateState());
    return () => { dispatch(clearCreateState()); };
  }, [dispatch]);

  // Navigate to confirmation page on success
  useEffect(() => {
    if (lastCreated) {
      toast.success(t('flights.bookingConfirmed', 'Booking confirmed! ✈️'));
      dispatch(clearCreateState());
      navigate(`/bookings/${lastCreated.id}/confirmation`, {
        state: { booking: lastCreated, flight },
      });
    }
  }, [lastCreated, dispatch, navigate, flight, t]);

  const [formError, setFormError] = useState(null);
  const handleConfirm = (e) => {
    e.preventDefault();
    setFormError(null);
    
    // Validate passengers
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      
      if (!p.name?.trim() || !p.age || !p.gender) {
        setFormError(t('flights.fillRequiredFields', 'Please fill all required fields for Passenger {{index}}', { index: i + 1 }));
        return;
      }
      
      const nameRegex = /^[a-zA-Z\s'-]+$/;
      if (!nameRegex.test(p.name.trim())) {
        setFormError(t('flights.invalidName', 'Please enter a valid name for Passenger {{index}} (only letters, spaces, hyphens, and apostrophes)', { index: i + 1 }));
        return;
      }
      
      const ageVal = parseInt(p.age, 10);
      if (isNaN(ageVal) || ageVal < 1 || ageVal > 120) {
        setFormError(t('flights.invalidAgeRange', 'Age must be between 1 and 120 for Passenger {{index}}', { index: i + 1 }));
        return;
      }
      
      if (p.phone_number?.trim()) {
        const phoneRegex = /^\+?[0-9]{7,15}$/;
        // Strip out spaces, hyphens, and parentheses for length/digit validation
        const cleanPhone = p.phone_number.trim().replace(/[\s\-\(\)]/g, '');
        if (!phoneRegex.test(cleanPhone)) {
          setFormError(t('flights.invalidPhone', 'Please enter a valid phone number (7-15 digits) for Passenger {{index}}', { index: i + 1 }));
          return;
        }
      }
    }
    
    const cleanedPassengers = passengers.map(p => ({
      ...p,
      name: p.name.trim(),
      phone_number: p.phone_number?.trim() || ''
    }));
    
    dispatch(createBooking({ flightId: flight.id, passengers: cleanedPassengers }));
  };

  const handlePassengerChange = (index, field, value) => {
    const newPassengers = [...passengers];
    
    if (field === 'age') {
      // Prevent non-digit characters
      if (value !== '' && !/^\d+$/.test(value)) {
        return;
      }
    }

    if (field === 'phone_number') {
      // Prevent arbitrary letters, but allow typical phone formatting characters
      if (value !== '' && !/^[\d\s\+\-\(\)]+$/.test(value)) {
        return;
      }
    }
    
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
                {t('flights.confirmBooking', 'Confirm Booking')}
              </h2>
            </div>
            <p style={{ fontSize: 13, color: '#5e5e5e', margin: 0 }}>
              {t('flights.reviewFlightDetails', 'Review your flight details before confirming')}
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
                <div style={{ fontSize: 10, color: '#705d00', fontWeight: 700 }}>{t('flights.nonStop', 'Non-stop')}</div>
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
                { label: t('flights.flightLabel', 'FLIGHT'), value: flight.flight_number },
                { label: t('flights.airlineLabel', 'AIRLINE'), value: flight.airline },
                { label: t('flights.aircraftLabel', 'AIRCRAFT'), value: flight.aircraft },
              ].map(({ label, value }) => (
                <div key={label} style={{ flex: '1 1 120px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#9e9488', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1c1d' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Passenger details */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1a1c1d' }}>{t('flights.passengerDetails', 'Passenger Details')}</h3>
              <button type="button" onClick={addPassenger} style={{
                background: 'transparent', border: '1px dashed rgba(112,93,0,0.4)', borderRadius: 8,
                padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#705d00', cursor: 'pointer'
              }}>
                {t('flights.addPassenger', '+ Add Passenger')}
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
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#5e5e5e' }}>{t('flights.passenger', 'Passenger')} {i + 1}</span>
                    {passengers.length > 1 && (
                      <button type="button" onClick={() => removePassenger(i)} style={{
                        background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontWeight: 600
                      }}>{t('common.remove', 'Remove')}</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <input
                      type="text" placeholder={t('flights.fullName', 'Full Name')} required
                      value={p.name} onChange={(e) => handlePassengerChange(i, 'name', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                    />
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]*" placeholder={t('flights.age', 'Age')} required
                      value={p.age} onChange={(e) => handlePassengerChange(i, 'age', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.04)', padding: 4, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                      {[
                        { id: 'M', label: t('flights.male', 'Male') },
                        { id: 'F', label: t('flights.female', 'Female') },
                        { id: 'O', label: t('flights.other', 'Other') }
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
                      type="tel" placeholder={t('flights.phoneOptional', 'Phone (Optional)')}
                      value={p.phone_number} onChange={(e) => handlePassengerChange(i, 'phone_number', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                    />
                  </div>
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
              <div style={{ fontSize: 11, color: '#5e5e5e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('flights.totalFare', 'Total Fare')}</div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', letterSpacing: '-0.02em' }}>
                {INR(flight.base_fare * passengers.length)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#065f46', fontSize: 12, fontWeight: 700 }}>
                <Users size={13} />{flight.available_seats} {t('flights.seatsLeft', 'seats left')}
              </div>
              <div style={{ fontSize: 11, color: '#5e5e5e', marginTop: 2 }}>{passengers.length} x {INR(flight.base_fare)}</div>
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
                {typeof createError === 'string' ? createError : t('flights.bookingFailed', 'Booking failed. Please try again.')}
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
              {t('common.cancel', 'Cancel')}
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
                  {t('flights.bookingProgress', 'Booking...')}
                </>
              ) : (
                <>
                  {t('flights.confirmBooking', 'Confirm Booking')} <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
