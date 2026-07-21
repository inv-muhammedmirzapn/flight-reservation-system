import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchMyBookings, cancelBooking } from '@/store/bookingSlice';
import { fetchWaitlistEntries, cancelWaitlistEntry } from '@/store/waitlistSlice';
import {
  Plane, ArrowRight, AlertCircle, Loader,
  CheckCircle, XCircle, Search, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { INR, fmtTime, fmtDate } from '@/utils/formatters';

/* ── helpers ─────────────────────────────────────── */

const fmtBookingDate = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

/* ── Status badges ────────────────────────────────── */
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

function WaitlistStatusBadge({ status }) {
  const styles = {
    PENDING: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', icon: <Clock size={11} /> },
    CONFIRMED: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', icon: <CheckCircle size={11} /> },
    CANCELLED: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', icon: <XCircle size={11} /> },
    EXPIRED: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd', icon: <XCircle size={11} /> },
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

/* ── Waitlist List Item ──────────────────────────── */
function WaitlistListItem({ entry, isSelected, onClick }) {
  const flight = entry.flight_detail;
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {entry.status === 'PENDING' && entry.queue_position !== undefined && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: 6 }}>
              Pos #{entry.queue_position}
            </span>
          )}
          <WaitlistStatusBadge status={entry.status} />
        </div>
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
           <div style={{ fontSize: 9, color: '#705d00', fontWeight: 700, marginTop: 4 }}>
             {entry.seat_count} {entry.seat_count === 1 ? 'seat' : 'seats'}
           </div>
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
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Fare Paid</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1c1d' }}>{INR(booking.total_price || flight.base_fare)}</div>
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

/* ── Waitlist Detail Card ────────────────────────── */
function WaitlistDetailCard({ entry, onCancel, cancellingId }) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => setShowCancelConfirm(false), [entry?.id]);

  if (!entry || !entry.flight_detail) return (
    <div style={{
      background: 'rgba(255,255,255,0.4)', borderRadius: 24, border: '1px dashed rgba(0,0,0,0.1)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: 400, color: '#9e9488'
    }}>
       <Clock size={32} opacity={0.2} style={{ marginBottom: 12 }} />
       <p style={{ fontSize: 14, fontWeight: 600 }}>Select a waitlist entry to view details</p>
    </div>
  );

  const flight = entry.flight_detail;
  const isPending = entry.status === 'PENDING';
  const isCancelling = cancellingId === entry.id;
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
            <div style={{ fontSize: 11, color: '#5e5e5e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Waitlist ID</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1c1d', letterSpacing: '0.04em' }}>{String(entry.id).slice(0, 8).toUpperCase()}</div>
          </div>
          <WaitlistStatusBadge status={entry.status} />
        </div>

        {/* Queue position badge for PENDING waitlist entries */}
        {isPending && entry.queue_position !== undefined && (
          <div style={{
            background: 'rgba(217,119,6,0.1)',
            border: '1px solid rgba(217,119,6,0.2)',
            borderRadius: 14, padding: '12px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} color="#d97706" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>Current Queue Position</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#b45309' }}>#{entry.queue_position}</span>
          </div>
        )}

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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20, padding: '12px 16px', background: '#f8f9fa', borderRadius: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Base Fare</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1c1d' }}>{INR(flight.base_fare)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Seats</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1c1d' }}>{entry.seat_count}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Pre-auth Total</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#705d00' }}>{INR(entry.price)}</div>
          </div>
        </div>

        {/* Action */}
        {isPending && !isPast && (
          <div style={{ marginTop: 4 }}>
            {!showCancelConfirm ? (
              <button
                id={`cancel-waitlist-btn-${entry.id}`}
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
                <XCircle size={15} /> Cancel Waitlist Request
              </button>
            ) : (
              <div style={{ background: '#fff1f2', borderRadius: 12, padding: 14 }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#be123c', fontWeight: 700, textAlign: 'center' }}>Confirm Cancellation?</p>
                <p style={{ margin: '0 0 10px', fontSize: 11, color: '#be123c', textAlign: 'center' }}>A 5% processing fee ({INR(entry.price * 0.05)}) will be deducted from your refund.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    id={`cancel-waitlist-confirm-yes-${entry.id}`}
                    onClick={() => onCancel(entry.id)}
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
                    id={`cancel-waitlist-confirm-no-${entry.id}`}
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
        {isPast && isPending && (
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
  const [activeTab, setActiveTab] = useState('BOOKINGS'); // BOOKINGS | WAITLIST

  // Bookings state
  const { list: bookingsList, listLoading: bookingsLoading, listError: bookingsError, cancelLoadingId: bookingsCancelLoadingId, cancelError: bookingsCancelError } = useSelector((s) => s.bookings);
  const [bookingsFilter, setBookingsFilter] = useState('ALL'); // ALL | CONFIRMED | CANCELLED
  const [selectedBookingId, setSelectedBookingId] = useState(null);

  // Waitlist state
  const { list: waitlistList, listLoading: waitlistLoading, listError: waitlistError, cancelLoadingId: waitlistCancelLoadingId, cancelError: waitlistCancelError } = useSelector((s) => s.waitlist);
  const [waitlistFilter, setWaitlistFilter] = useState('ALL'); // ALL | PENDING | CONFIRMED | CANCELLED | EXPIRED
  const [selectedWaitlistId, setSelectedWaitlistId] = useState(null);

  useEffect(() => {
    dispatch(fetchMyBookings());
    dispatch(fetchWaitlistEntries());
  }, [dispatch]);

  // Display errors if any
  useEffect(() => {
    if (bookingsCancelError) {
      toast.error(bookingsCancelError);
    }
  }, [bookingsCancelError]);

  useEffect(() => {
    if (waitlistCancelError) {
      toast.error(waitlistCancelError);
    }
  }, [waitlistCancelError]);

  // Cancel Handlers
  const handleCancelBooking = (bookingId) => {
    dispatch(cancelBooking(bookingId)).then((action) => {
      if (!action.error) toast.success('Booking cancelled.');
    });
  };

  const handleCancelWaitlist = (waitlistId) => {
    dispatch(cancelWaitlistEntry(waitlistId)).then((action) => {
      if (!action.error) toast.success('Waitlist request cancelled.');
    });
  };

  // Filter lists
  const filteredBookings = bookingsList.filter((b) => bookingsFilter === 'ALL' || b.status === bookingsFilter);
  const filteredWaitlist = waitlistList.filter((w) => waitlistFilter === 'ALL' || w.status === waitlistFilter);

  // Auto-selection of first booking
  useEffect(() => {
    if (filteredBookings.length > 0) {
      if (!selectedBookingId || !filteredBookings.find(b => b.id === selectedBookingId)) {
        setSelectedBookingId(filteredBookings[0].id);
      }
    } else {
      setSelectedBookingId(null);
    }
  }, [filteredBookings, selectedBookingId]);

  // Auto-selection of first waitlist entry
  useEffect(() => {
    if (filteredWaitlist.length > 0) {
      if (!selectedWaitlistId || !filteredWaitlist.find(w => w.id === selectedWaitlistId)) {
        setSelectedWaitlistId(filteredWaitlist[0].id);
      }
    } else {
      setSelectedWaitlistId(null);
    }
  }, [filteredWaitlist, selectedWaitlistId]);

  const selectedBooking = filteredBookings.find(b => b.id === selectedBookingId);
  const selectedWaitlist = filteredWaitlist.find(w => w.id === selectedWaitlistId);

  // Determine current active lists and loaders
  const isBookings = activeTab === 'BOOKINGS';
  const currentList = isBookings ? filteredBookings : filteredWaitlist;
  const currentLoading = isBookings ? bookingsLoading : waitlistLoading;
  const currentError = isBookings ? bookingsError : waitlistError;

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
        {/* Page Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
            fontSize: 30, fontWeight: 800, color: '#1a1c1d',
            letterSpacing: '-0.02em', margin: '0 0 6px',
          }}>
            My Bookings & Waitlist
          </h1>
          <p style={{ fontSize: 14, color: '#5e5e5e', margin: 0 }}>
            Manage your booked reservations and active queue positions in one place.
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid rgba(0,0,0,0.08)', marginBottom: 24 }}>
          <button
            id="tab-bookings"
            onClick={() => setActiveTab('BOOKINGS')}
            style={{
              padding: '12px 8px', background: 'transparent', border: 'none',
              borderBottom: `3px solid ${activeTab === 'BOOKINGS' ? '#1a1c1d' : 'transparent'}`,
              fontWeight: 800, fontSize: 15, color: activeTab === 'BOOKINGS' ? '#1a1c1d' : '#8e8e93',
              cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            My Bookings
          </button>
          <button
            id="tab-waitlist"
            onClick={() => setActiveTab('WAITLIST')}
            style={{
              padding: '12px 8px', background: 'transparent', border: 'none',
              borderBottom: `3px solid ${activeTab === 'WAITLIST' ? '#1a1c1d' : 'transparent'}`,
              fontWeight: 800, fontSize: 15, color: activeTab === 'WAITLIST' ? '#1a1c1d' : '#8e8e93',
              cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            My Waitlist
          </button>
        </div>

        <div className={currentList.length > 0 ? "bookings-layout" : ""}>
          {/* Left Column */}
          <div>
            {/* Filter Chips */}
            {isBookings ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL',       label: 'All Bookings' },
                  { key: 'CONFIRMED', label: 'Confirmed' },
                  { key: 'CANCELLED', label: 'Cancelled' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    id={`filter-bookings-${key.toLowerCase()}`}
                    className="filter-chip"
                    onClick={() => setBookingsFilter(key)}
                    style={{
                      padding: '8px 18px', borderRadius: 10,
                      fontSize: 13, fontWeight: 700,
                      background: bookingsFilter === key ? '#1a1c1d' : 'rgba(255,255,255,0.6)',
                      color: bookingsFilter === key ? '#fff' : '#5e5e5e',
                      border: `1px solid ${bookingsFilter === key ? '#1a1c1d' : 'rgba(0,0,0,0.1)'}`,
                    }}
                  >
                    {label}
                    {key !== 'ALL' && (
                      <span style={{
                        marginLeft: 6,
                        background: bookingsFilter === key ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
                        borderRadius: 9999, padding: '1px 7px', fontSize: 11,
                      }}>
                        {bookingsList.filter((b) => b.status === key).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL',       label: 'All Waitlist' },
                  { key: 'PENDING',   label: 'Pending' },
                  { key: 'CONFIRMED', label: 'Confirmed' },
                  { key: 'CANCELLED', label: 'Cancelled' },
                  { key: 'EXPIRED',   label: 'Expired' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    id={`filter-waitlist-${key.toLowerCase()}`}
                    className="filter-chip"
                    onClick={() => setWaitlistFilter(key)}
                    style={{
                      padding: '8px 18px', borderRadius: 10,
                      fontSize: 13, fontWeight: 700,
                      background: waitlistFilter === key ? '#1a1c1d' : 'rgba(255,255,255,0.6)',
                      color: waitlistFilter === key ? '#fff' : '#5e5e5e',
                      border: `1px solid ${waitlistFilter === key ? '#1a1c1d' : 'rgba(0,0,0,0.1)'}`,
                    }}
                  >
                    {label}
                    {key !== 'ALL' && (
                      <span style={{
                        marginLeft: 6,
                        background: waitlistFilter === key ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
                        borderRadius: 9999, padding: '1px 7px', fontSize: 11,
                      }}>
                        {waitlistList.filter((w) => w.status === key).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Loading */}
            {currentLoading && !currentList.length && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '30vh' }}>
                <Loader size={36} color="#705d00" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            {/* Error */}
            {currentError && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14,
                padding: '18px 22px', color: '#b91c1c',
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 20,
              }}>
                <AlertCircle size={18} />
                <span>{currentError}</span>
              </div>
            )}

            {/* Empty state */}
            {!currentLoading && !currentError && currentList.length === 0 && (
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
                  {isBookings
                    ? (bookingsFilter === 'ALL' ? 'No bookings yet' : `No ${bookingsFilter.toLowerCase()} bookings`)
                    : (waitlistFilter === 'ALL' ? 'No waitlist requests yet' : `No ${waitlistFilter.toLowerCase()} waitlist requests`)
                  }
                </h3>
                <p style={{ fontSize: 14, color: '#5e5e5e', marginBottom: 24 }}>
                  {isBookings
                    ? (bookingsFilter === 'ALL' ? "Book a flight to see your reservations here." : "Switch filters or book a new flight.")
                    : (waitlistFilter === 'ALL' ? "Join a flight waitlist to see your requests here." : "Switch filters or search for another flight.")
                  }
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
            {currentList.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {isBookings ? (
                  filteredBookings.map((booking, i) => (
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
                  ))
                ) : (
                  filteredWaitlist.map((entry, i) => (
                    <div
                      key={entry.id}
                      className="booking-list-item"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <WaitlistListItem
                        entry={entry}
                        isSelected={selectedWaitlistId === entry.id}
                        onClick={() => setSelectedWaitlistId(entry.id)}
                      />
                    </div>
                  ))
                )}
              </div>
            )}
          </div> {/* End Left Column */}

          {/* Right Column: Detail Card */}
          {currentList.length > 0 && (
            <div className="booking-detail-wrapper">
              {isBookings ? (
                <BookingDetailCard
                  booking={selectedBooking}
                  onCancel={handleCancelBooking}
                  cancellingId={bookingsCancelLoadingId}
                />
              ) : (
                <WaitlistDetailCard
                  entry={selectedWaitlist}
                  onCancel={handleCancelWaitlist}
                  cancellingId={waitlistCancelLoadingId}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
