import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchFlightDetail, clearFlightDetail } from '@/store/flightSlice';
import { Plane, ArrowLeft, Clock, ShieldCheck, Tag, Users, ArrowRight, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import BookingConfirmModal from '@/components/BookingConfirmModal';
import WaitlistJoinModal from '@/components/WaitlistJoinModal';
import { fetchWaitlistFlightCount } from '@/store/waitlistSlice';

import { INR, fmtTime, fmtDate, diffHM } from '@/utils/formatters';

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

const DEFAULT_WAITLIST = { counts: {} };

import { useTranslation } from 'react-i18next';

/* ── Main Component ───────────────────────────────────────── */
export default function UserFlightDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { detail: flight, detailLoading, error } = useSelector(state => state.flights);
  const { isAuthenticated } = useSelector(state => state.auth);
  const [showModal, setShowModal] = useState(false);
  const { counts } = useSelector(state => state.waitlist || DEFAULT_WAITLIST);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  const [searchParams] = useSearchParams();
  const adults = Number(searchParams.get('adults')) || 1;
  const children = Number(searchParams.get('children')) || 0;
  const infants = Number(searchParams.get('infants')) || 0;
  const totalPassengers = adults + children + infants;

  useEffect(() => {
    if (flight && flight.id) {
      dispatch(fetchWaitlistFlightCount(flight.id));
    }
  }, [dispatch, flight]);

  useEffect(() => {
    dispatch(fetchFlightDetail(id));
    return () => { dispatch(clearFlightDetail()); };
  }, [dispatch, id]);

  const handleBack = (e) => {
    e.preventDefault();
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/flights');
    }
  };

  const handleBookNow = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('You need to login for booking');
      navigate('/login');
      return;
    }
    setShowModal(true);
  };

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
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '120px 24px 48px' }}>
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16,
          padding: 24, color: '#b91c1c', textAlign: 'center', marginBottom: 24,
        }}>
          {error}
        </div>
        <a href="/flights" onClick={handleBack} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          color: '#705d00', fontWeight: 700, textDecoration: 'none', fontSize: 14,
        }}>
          <ArrowLeft size={16} /> Back to Flights
        </a>
      </div>
    );
  }

  if (!flight) return null;

  const duration = diffHM(flight.departure_time, flight.arrival_time);
  
  const isPastDeparture = new Date(flight.departure_time) < new Date();
  const unbookableStatuses = ['CANCELLED', 'DEPARTED', 'ARRIVED', 'BOARDING'];
  const isUnbookableStatus = unbookableStatuses.includes(flight.status);
  const isSoldOut = flight.available_seats <= 0;
  
  const canBook = !isPastDeparture && !isUnbookableStatus && !isSoldOut;

  let unavailableReason = '';
  if (isUnbookableStatus) {
    unavailableReason = t(`flights.status_${flight.status.toLowerCase()}`, `Flight ${flight.status.toLowerCase()}`);
  } else if (isPastDeparture) {
    unavailableReason = t('flights.pastDeparture', 'Past departure time');
  } else if (isSoldOut) {
    unavailableReason = t('flights.soldOut', 'Sold out');
  }

  return (
    <>
      <style>{`
        .book-btn:hover { background: #ffe333 !important; }
        .back-link:hover { color: #705d00 !important; }
      `}</style>

      {/* Booking Confirm Modal */}
      {showModal && flight && (
        <BookingConfirmModal
          flight={flight}
          totalPassengers={totalPassengers}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Waitlist Join Modal */}
      {showWaitlistModal && flight && (
        <WaitlistJoinModal
          flight={flight}
          onClose={() => setShowWaitlistModal(false)}
          initialSeatCount={Math.max(1, Math.min(9, totalPassengers))}
        />
      )}

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '120px 24px 48px' }}>

        {/* Back link */}
        <a
          href="/flights"
          onClick={handleBack}
          className="back-link"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: '#1a1c1d', fontWeight: 700, textDecoration: 'none',
            fontSize: 14, marginBottom: 28, transition: 'color 0.2s',
          }}
        >
          <ArrowLeft size={16} /> {t('flights.backToListings', 'Back to Listings')}
        </a>

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
                {t('flights.departure', 'Departure')}
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
              <div style={{ fontSize: 12, color: '#705d00', fontWeight: 600 }}>{t('flights.nonStop', 'Non-stop')}</div>
            </div>

            {/* Arrival */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#5e5e5e', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                {t('flights.arrival', 'Arrival')}
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
              label={t('flights.baseFare', 'Base Fare')}
              value={INR(flight.base_fare)}
              sub={t('flights.perPersonEconomy', 'Per person · Economy')}
            />
            <InfoTile
              icon={<Users size={20} color="#705d00" />}
              label={t('flights.availableSeats', 'Available Seats')}
              value={`${flight.available_seats} / ${flight.total_seats}`}
              sub={t('flights.economyClass', 'Economy class')}
            />
            <InfoTile
              icon={<Clock size={20} color="#705d00" />}
              label={t('flights.flightDuration', 'Flight Duration')}
              value={duration}
              sub={t('flights.estimated', 'Estimated')}
            />
          </div>

          {/* ── Perks / Badges ── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              { icon: <ShieldCheck size={14} />, label: t('flights.refundableTicket', 'Refundable Ticket') },
              { icon: <Tag size={14} />, label: t('flights.bestPriceGuarantee', 'Best Price Guarantee') },
              { icon: <Plane size={14} style={{ transform: 'rotate(-45deg)' }} />, label: t('flights.directFlight', 'Direct Flight') },
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
                {t('flights.totalPerPerson', 'Total per person')}
              </div>
              <div style={{
                fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                fontSize: 36, fontWeight: 800, color: '#1a1c1d', letterSpacing: '-0.02em', lineHeight: 1,
              }}>
                {INR(flight.base_fare)}
              </div>
            </div>
            
            {canBook ? (
              <button
                className="book-btn"
                onClick={handleBookNow}
                style={{
                  background: '#ffd700', color: '#1a1c1d',
                  fontWeight: 700, fontSize: 15,
                  padding: '14px 36px', borderRadius: 14, border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(255,215,0,0.4)',
                  transition: 'background 0.2s',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {t('flights.bookNow', 'Book Now')} <ArrowRight size={16} />
              </button>
            ) : isSoldOut && !isPastDeparture && !isUnbookableStatus ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{
                  background: 'rgba(255,215,0,0.08)',
                  border: '1px solid rgba(255,215,0,0.2)',
                  borderRadius: 12, padding: '8px 16px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 13, fontWeight: 700, color: '#705d00',
                }}>
                  <Users size={15} />
                  <span>{t('flights.waitlistSize', 'Waitlist Size')}: {counts[flight.id] !== undefined ? `${counts[flight.id]} ${t('flights.passengers_lower', 'passengers')}` : t('flights.checking', 'Checking...')}</span>
                </div>

                <button
                  className="book-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isAuthenticated) {
                      toast.error('You need to login to join the waitlist');
                      navigate('/login');
                      return;
                    }
                    setShowWaitlistModal(true);
                  }}
                  style={{
                    background: '#ffd700', color: '#1a1c1d',
                    fontWeight: 700, fontSize: 15,
                    padding: '14px 36px', borderRadius: 14, border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(255,215,0,0.4)',
                    transition: 'background 0.2s',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  {isAuthenticated ? t('flights.joinWaitingList', 'Join Waiting List') : t('flights.loginToJoinWaitlist', 'Login to Join Waitlist')} <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div style={{
                background: 'rgba(0,0,0,0.03)', color: '#5e5e5e', border: '1px solid rgba(0,0,0,0.08)',
                fontWeight: 700, fontSize: 14,
                padding: '10px 20px', borderRadius: 12,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertCircle size={16} style={{ opacity: 0.7 }} />
                <span>{t('flights.notAvailable', 'Not Available')} <span style={{ opacity: 0.6, fontWeight: 500, marginLeft: 4 }}>({unavailableReason})</span></span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
