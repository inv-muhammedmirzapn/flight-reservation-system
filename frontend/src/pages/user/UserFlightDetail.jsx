import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, Link } from 'react-router-dom';
import { fetchFlightDetail, clearFlightDetail } from '../../store/flightSlice';
import { Plane, ArrowLeft, Clock, ShieldCheck, Tag, Users, ArrowRight } from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────── */
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
  } catch (_) {
    return 'N/A';
  }
};

/* ── status badge ─────────────────────────────────────────── */
const STATUS_STYLES = {
  SCHEDULED: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  DELAYED:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  CANCELLED: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  BOARDING:  { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  DEPARTED:  { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  ARRIVED:   { bg: '#f3e8ff', color: '#7c3aed', border: '#d8b4fe' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 9999, padding: '4px 14px',
      fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>
      {status}
    </span>
  );
}

/* ── Info Tile ───────────────────────────────────────────── */
function InfoTile({ icon, label, value, sub }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      background: 'rgba(255,255,255,0.55)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 16, padding: '18px 22px',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: 'rgba(255,215,0,0.12)',
        border: '1px solid rgba(255,215,0,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#5e5e5e', textTransform: 'uppercase', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1c1d', lineHeight: 1.1 }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 12, color: '#9e9488', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────── */
export default function UserFlightDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { detail: flight, detailLoading, error } = useSelector(state => state.flights);

  useEffect(() => {
    dispatch(fetchFlightDetail(id));
    return () => { dispatch(clearFlightDetail()); };
  }, [dispatch, id]);

  /* Loading */
  if (detailLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{
          width: 44, height: 44, border: '3px solid rgba(112,93,0,0.15)',
          borderTopColor: '#705d00', borderRadius: '50%', animation: 'spin 0.75s linear infinite',
        }} />
      </div>
    );
  }

  /* Error */
  if (error) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '88px 24px 48px' }}>
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16,
          padding: 24, color: '#b91c1c', textAlign: 'center', marginBottom: 24,
        }}>
          {error}
        </div>
        <Link to="/flights" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          color: '#705d00', fontWeight: 700, textDecoration: 'none', fontSize: 14,
        }}>
          <ArrowLeft size={16} /> Back to Flights
        </Link>
      </div>
    );
  }

  if (!flight) return null;

  const duration = diffHM(flight.departure_time, flight.arrival_time);

  return (
    <>
      <style>{`
        .book-btn:hover { background: #ffe333 !important; }
        .back-link:hover { color: #705d00 !important; }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '88px 24px 48px' }}>

        {/* Back link */}
        <Link
          to="/flights"
          className="back-link"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: '#1a1c1d', fontWeight: 700, textDecoration: 'none',
            fontSize: 14, marginBottom: 28, transition: 'color 0.2s',
          }}
        >
          <ArrowLeft size={16} /> Back to Listings
        </Link>

        {/* Main glass card */}
        <div className="glass-card" style={{
          borderRadius: 28, padding: '40px 48px',
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', gap: 36,
        }}>
          {/* Glow blobs */}
          <div style={{
            position: 'absolute', top: -48, right: -48, width: 200, height: 200,
            borderRadius: '50%', background: '#ffd700', filter: 'blur(90px)',
            opacity: 0.12, pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -40, left: -40, width: 160, height: 160,
            borderRadius: '50%', background: '#bfdbfe', filter: 'blur(80px)',
            opacity: 0.15, pointerEvents: 'none',
          }} />

          {/* ── Header ── */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            flexWrap: 'wrap', gap: 16,
            paddingBottom: 28, borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'rgba(255,215,0,0.15)',
                  border: '1px solid rgba(255,215,0,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Plane size={18} color="#705d00" style={{ transform: 'rotate(-45deg)' }} />
                </div>
                <h1 style={{
                  fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                  fontSize: 32, fontWeight: 800, color: '#1a1c1d', letterSpacing: '-0.02em',
                }}>
                  {flight.flight_number}
                </h1>
              </div>
              <p style={{ fontSize: 14, color: '#5e5e5e', marginLeft: 50 }}>
                {flight.airline} &bull; {flight.aircraft}
              </p>
            </div>
            <StatusBadge status={flight.status} />
          </div>

          {/* ── Route Timeline ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: 24,
            alignItems: 'center',
          }}>
            {/* Departure */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#5e5e5e', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                Departure
              </div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 52, fontWeight: 800, color: '#1a1c1d', lineHeight: 1 }}>
                {fmtTime(flight.departure_time)}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1c1d', marginTop: 4 }}>
                {flight.source_airport}
              </div>
              <div style={{ fontSize: 13, color: '#5e5e5e', marginTop: 4 }}>
                {fmtDate(flight.departure_time)}
              </div>
            </div>

            {/* Duration / flight path */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 140 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#5e5e5e', fontWeight: 600 }}>
                <Clock size={13} color="#705d00" />
                {duration}
              </div>
              <div style={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, height: 2, background: '#d0c6ab' }} />
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.9)',
                  border: '2px solid rgba(112,93,0,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 -1px', flexShrink: 0, zIndex: 1,
                }}>
                  <Plane size={16} color="#705d00" />
                </div>
                <div style={{ flex: 1, height: 2, background: '#d0c6ab' }} />
              </div>
              <div style={{ fontSize: 12, color: '#705d00', fontWeight: 600 }}>Non-stop</div>
            </div>

            {/* Arrival */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#5e5e5e', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                Arrival
              </div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 52, fontWeight: 800, color: '#1a1c1d', lineHeight: 1 }}>
                {fmtTime(flight.arrival_time)}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1c1d', marginTop: 4 }}>
                {flight.destination_airport}
              </div>
              <div style={{ fontSize: 13, color: '#5e5e5e', marginTop: 4 }}>
                {fmtDate(flight.arrival_time)}
              </div>
            </div>
          </div>

          {/* ── Info Tiles ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16,
            paddingTop: 28, borderTop: '1px solid rgba(0,0,0,0.06)',
          }}>
            <InfoTile
              icon={<span style={{ fontSize: 20 }}>₹</span>}
              label="Base Fare"
              value={INR(flight.base_fare)}
              sub="Per person · Economy"
            />
            <InfoTile
              icon={<Users size={20} color="#705d00" />}
              label="Available Seats"
              value={`${flight.available_seats} / ${flight.total_seats}`}
              sub="Economy class"
            />
            <InfoTile
              icon={<Clock size={20} color="#705d00" />}
              label="Flight Duration"
              value={duration}
              sub="Estimated"
            />
          </div>

          {/* ── Perks / Badges ── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              { icon: <ShieldCheck size={14} />, label: 'Refundable Ticket' },
              { icon: <Tag size={14} />, label: 'Best Price Guarantee' },
              { icon: <Plane size={14} style={{ transform: 'rotate(-45deg)' }} />, label: 'Direct Flight' },
            ].map(({ icon, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px',
                background: 'rgba(112,93,0,0.08)',
                border: '1px solid rgba(112,93,0,0.18)',
                borderRadius: 10,
                fontSize: 12, fontWeight: 700, color: '#705d00',
              }}>
                {icon} {label}
              </div>
            ))}
          </div>

          {/* ── CTA ── */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
            paddingTop: 20, borderTop: '1px solid rgba(0,0,0,0.06)',
            gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#5e5e5e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total per person
              </div>
              <div style={{
                fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                fontSize: 36, fontWeight: 800, color: '#1a1c1d', letterSpacing: '-0.02em', lineHeight: 1,
              }}>
                {INR(flight.base_fare)}
              </div>
            </div>
            <button
              className="book-btn"
              style={{
                background: '#ffd700', color: '#1a1c1d',
                fontWeight: 700, fontSize: 15,
                padding: '14px 36px', borderRadius: 14, border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(255,215,0,0.4)',
                transition: 'background 0.2s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              Book Now <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
