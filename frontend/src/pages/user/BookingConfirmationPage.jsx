import { useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, Plane, Calendar, Clock, ArrowRight, List } from 'lucide-react';

/* ── helpers ────────────────────────────────────── */
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
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

const fmtBookingDate = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

/* ─────────────────────────────────────────────── */

export default function BookingConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Scroll to top when the page mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Booking data passed via navigation state
  const booking = location.state?.booking;
  const flight  = location.state?.flight ?? booking?.flight_detail;

  // If someone lands here without booking data, redirect
  if (!booking || !flight) {
    return (
      <div style={{ maxWidth: 600, margin: '120px auto', textAlign: 'center', padding: '0 24px' }}>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 24, color: '#1a1c1d' }}>
          No booking data found.
        </h2>
        <p style={{ color: '#5e5e5e', marginBottom: 24 }}>
          You may have navigated here directly. View your bookings instead.
        </p>
        <button
          onClick={() => navigate('/my-bookings')}
          style={{
            background: '#ffd700', color: '#1a1c1d',
            fontWeight: 700, fontSize: 14,
            padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
          }}
        >
          View My Bookings
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes check-pop {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .check-icon  { animation: check-pop 0.55s cubic-bezier(.16,1,.3,1) 0.1s both; }
        .fade-up-1   { animation: fade-up 0.45s ease 0.25s both; }
        .fade-up-2   { animation: fade-up 0.45s ease 0.4s  both; }
        .fade-up-3   { animation: fade-up 0.45s ease 0.55s both; }
        .action-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,215,0,0.4) !important; }
        .sec-btn:hover    { background: rgba(0,0,0,0.05) !important; }
      `}</style>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* Success hero */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="check-icon" style={{
            width: 80, height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #d1fae5, #6ee7b7)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 40px rgba(16,185,129,0.25)',
            marginBottom: 20,
          }}>
            <CheckCircle size={40} color="#065f46" strokeWidth={2.5} />
          </div>

          <h1
            className="fade-up-1"
            style={{
              fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
              fontSize: 30, fontWeight: 800, color: '#1a1c1d',
              letterSpacing: '-0.02em', margin: '0 0 8px',
            }}
          >
            Booking Confirmed!
          </h1>
          <p className="fade-up-1" style={{ fontSize: 15, color: '#5e5e5e', margin: 0 }}>
            Your seat is secured. Have a great flight ✈️
          </p>
        </div>

        {/* Booking reference card */}
        <div
          className="glass-card fade-up-2"
          style={{ borderRadius: 22, padding: '28px 32px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}
        >
          <div style={{
            position: 'absolute', top: -30, right: -30, width: 120, height: 120,
            borderRadius: '50%', background: '#ffd700', filter: 'blur(60px)', opacity: 0.15,
          }} />

          {/* Booking ID */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid rgba(0,0,0,0.06)',
            flexWrap: 'wrap', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Booking Reference
              </div>
              <div style={{
                fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                fontSize: 18, fontWeight: 800, color: '#1a1c1d', letterSpacing: '0.02em',
              }}>
                {String(booking.id).slice(0, 8).toUpperCase()}
              </div>
            </div>
            <span style={{
              background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7',
              borderRadius: 9999, padding: '5px 16px',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              {booking.status}
            </span>
          </div>

          {/* Route */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center', gap: 16, marginBottom: 20,
          }}>
            <div>
              <div style={{ fontSize: 38, fontWeight: 800, color: '#1a1c1d', lineHeight: 1 }}>{fmtTime(flight.departure_time)}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1c1d', marginTop: 4 }}>{flight.source_airport}</div>
              <div style={{ fontSize: 12, color: '#5e5e5e', marginTop: 3 }}>{fmtDate(flight.departure_time)}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', width: 80 }}>
                <div style={{ flex: 1, height: 2, background: '#d0c6ab' }} />
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Plane size={14} color="#705d00" />
                </div>
                <div style={{ flex: 1, height: 2, background: '#d0c6ab' }} />
              </div>
              <div style={{ fontSize: 11, color: '#705d00', fontWeight: 700 }}>Non-stop</div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 38, fontWeight: 800, color: '#1a1c1d', lineHeight: 1 }}>{fmtTime(flight.arrival_time)}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1c1d', marginTop: 4 }}>{flight.destination_airport}</div>
              <div style={{ fontSize: 12, color: '#5e5e5e', marginTop: 3 }}>{fmtDate(flight.arrival_time)}</div>
            </div>
          </div>

          {/* Details grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 12, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)',
          }}>
            {[
              { icon: <Plane size={14} color="#705d00" />,   label: 'Flight No.', value: flight.flight_number },
              { icon: <span style={{ fontSize: 14 }}>🛩️</span>, label: 'Airline',    value: flight.airline },
              { icon: <Calendar size={14} color="#705d00" />, label: 'Booked On',  value: fmtBookingDate(booking.created_at) },
              { icon: <span style={{ fontSize: 12 }}>₹</span>, label: 'Fare Paid',  value: INR(flight.base_fare) },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.5)', borderRadius: 12, padding: '12px 14px',
                border: '1px solid rgba(255,255,255,0.7)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  {icon}
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1c1d' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="fade-up-3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            to="/my-bookings"
            id="view-bookings-btn"
            style={{
              flex: 1, minWidth: 180,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#ffd700', color: '#1a1c1d',
              fontWeight: 700, fontSize: 14,
              padding: '14px 20px', borderRadius: 12,
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(255,215,0,0.35)',
              transition: 'all 0.2s',
            }}
            className="action-btn"
          >
            <List size={16} /> My Bookings
          </Link>

          <Link
            to="/flights"
            id="explore-flights-btn"
            style={{
              flex: 1, minWidth: 180,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(0,0,0,0.1)',
              color: '#1a1c1d', fontWeight: 700, fontSize: 14,
              padding: '14px 20px', borderRadius: 12,
              textDecoration: 'none', transition: 'all 0.2s',
            }}
            className="sec-btn"
          >
            Explore More Flights <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </>
  );
}
