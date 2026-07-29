import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchFlightDetail, clearFlightDetail } from '@/store/flightSlice';
import { Plane, ArrowLeft, Clock, ShieldCheck, Tag, Users, ArrowRight, AlertCircle, Briefcase, Luggage, Plus, Gift, Percent } from 'lucide-react';
import toast from 'react-hot-toast';
import BookingConfirmModal from '@/components/BookingConfirmModal';
import WaitlistJoinModal from '@/components/WaitlistJoinModal';
import { fetchWaitlistFlightCount } from '@/store/waitlistSlice';

import { INR, fmtTime, fmtDate, diffHM } from '@/utils/formatters';

/* ── status badge ─────────────────────────────────────────── */
const STATUS_STYLES = {
  SCHEDULED: { bg: '#e6f4ea', color: '#137333', border: '#ceead6' },
  DELAYED:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  CANCELLED: { bg: '#fce8e6', color: '#c5221f', border: '#fad2cf' },
  BOARDING:  { bg: '#e8f0fe', color: '#1967d2', border: '#d2e3fc' },
  DEPARTED:  { bg: '#f3e8ff', color: '#681da8', border: '#e9d5ff' },
  ARRIVED:   { bg: '#e6f4ea', color: '#137333', border: '#ceead6' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { bg: '#f1f3f4', color: '#3c4043', border: '#dadce0' };
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 4, padding: '4px 8px',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>
      {status}
    </span>
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
  const [showCancelDetails, setShowCancelDetails] = useState(false);

  const [searchParams] = useSearchParams();
  const adults = Number(searchParams.get('adults')) || 1;
  const children = Number(searchParams.get('children')) || 0;
  const infants = Number(searchParams.get('infants')) || 0;
  const totalPassengers = adults + children + infants;
  const selectedClass = searchParams.get('class') || 'Economy';

  // Map display class name to model value
  const CLASS_MAP = { 'Economy': 'ECONOMY', 'Business': 'BUSINESS', 'First': 'FIRST' };
  const classKey = CLASS_MAP[selectedClass] || 'ECONOMY';

  // Compute isSoldOut early so we can trigger waitlist count fetch
  const isEnriched = !!flight?.fares;
  const faresData = flight?.fares || {};
  const selectedFare = faresData[classKey];
  const classAvailableSeats = selectedFare ? selectedFare.available_seats : (isEnriched ? 0 : (flight?.available_seats || 0));
  const isSoldOut = flight && classAvailableSeats <= 0;

  useEffect(() => {
    dispatch(fetchFlightDetail(id));
    return () => { dispatch(clearFlightDetail()); };
  }, [dispatch, id]);

  useEffect(() => {
    if (flight && isSoldOut) {
      dispatch(fetchWaitlistFlightCount(flight.id));
    }
  }, [dispatch, flight, isSoldOut]);

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
          width: 44, height: 44, border: '3px solid rgba(10, 25, 47, 0.15)',
          borderTopColor: '#0a192f', borderRadius: '50%', animation: 'spin 0.75s linear infinite',
        }} />
      </div>
    );
  }

  /* Error */
  if (error) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '120px 24px 48px' }}>
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: 24, color: '#b91c1c', textAlign: 'center', marginBottom: 24,
        }}>
          {error}
        </div>
        <a href="/flights" onClick={handleBack} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          color: '#0a192f', fontWeight: 700, textDecoration: 'none', fontSize: 14,
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
  
  // Use per-class price if available, fall back to base_fare
  const pricePerPax = selectedFare ? selectedFare.price : parseFloat(flight.base_fare);
  
  const canBook = !isPastDeparture && !isUnbookableStatus && !isSoldOut;

  let unavailableReason = '';
  if (isUnbookableStatus) {
    unavailableReason = t(`flights.status_${flight.status.toLowerCase()}`, `Flight ${flight.status.toLowerCase()}`);
  } else if (isPastDeparture) {
    unavailableReason = t('flights.pastDeparture', 'Past departure time');
  } else if (isSoldOut) {
    unavailableReason = t('flights.soldOut', 'Sold out');
  }


  // Baggage from real route data
  const baggageWeightKg = flight.baggage_weight_kg || 15;
  const baggageNumAllowed = flight.baggage_number_allowed || 1;
  const handbagWeightKg = flight.handbag_weight_kg || 7;

  // Fare calculations using per-class price
  const baseFareTotal = pricePerPax * totalPassengers;
  const taxesAndSurcharges = Math.round(pricePerPax * 0.1111) * totalPassengers;
  const totalAmount = baseFareTotal + taxesAndSurcharges;

  // Cancellation penalty calculations based on backend Fare data
  let penaltyAmount1 = 0;
  let penaltyAmount2 = 0;
  
  if (selectedFare) {
    if (selectedFare.refund_type === 'NON_REFUNDABLE') {
      penaltyAmount1 = totalAmount;
      penaltyAmount2 = totalAmount;
    } else if (selectedFare.refund_type === 'REFUNDABLE') {
      // For refundable, the penalty is simply the change_fee
      penaltyAmount1 = (selectedFare.change_fee || 0) * totalPassengers;
      penaltyAmount2 = (selectedFare.change_fee || 0) * totalPassengers;
    } else {
      // PARTIAL: base penalty is change_fee, increases closer to departure
      penaltyAmount1 = (selectedFare.change_fee || 0) * totalPassengers;
      penaltyAmount2 = Math.min(totalAmount, (selectedFare.change_fee || 0) * 1.5 * totalPassengers);
    }
  } else {
    // Fallback if no specific Fare model data is available
    penaltyAmount1 = Math.round(totalAmount * 0.56);
    penaltyAmount2 = totalAmount;
  }
  
  // Calculate cancellation timeline dates (e.g., 24 hours prior to departure)
  const departureDateObj = flight ? new Date(flight.departure_time) : new Date();
  const timelineDateObj = new Date(departureDateObj.getTime() - (24 * 60 * 60 * 1000));
  const timelineIsoString = timelineDateObj.toISOString();

  return (
    <>
      <style>{`
        body { margin: 0; font-family: 'Plus Jakarta Sans', Inter, sans-serif; }
        .detail-bg {
          background: linear-gradient(135deg, #fdfbf7 0%, #f4eee1 100%);
          min-height: 100vh;
          padding-top: 84px;
          padding-bottom: 64px;
        }
        .glass-panel {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 24px;
          box-shadow: 0 8px 32px rgba(112, 93, 0, 0.08);
          padding: 32px;
        }
        .book-btn {
          background: #ffd700;
          color: #1a1c1d;
          font-weight: 700;
          font-size: 16px;
          padding: 16px 32px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }
        .book-btn:hover {
          background: #e6c200;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
        }
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #1a1c1d;
          font-weight: 700;
          text-decoration: none;
          font-size: 14px;
          margin: 12px 0 24px;
          transition: opacity 0.2s ease;
        }
        .back-link:hover { opacity: 0.7; }
        .pill-badge {
          background: rgba(255, 215, 0, 0.15);
          color: #705d00;
          border: 1px solid rgba(255, 215, 0, 0.3);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .flight-time-large {
          font-size: 42px;
          font-weight: 800;
          color: #1a1c1d;
          line-height: 1;
          letter-spacing: -1px;
        }
        .flight-city-large {
          font-size: 20px;
          font-weight: 800;
          color: #1a1c1d;
          margin-top: 8px;
        }
        .flight-date-small {
          font-size: 13px;
          color: #705d00;
          font-weight: 600;
          margin-top: 4px;
        }
        .info-card {
          background: rgba(255,255,255,0.5);
          border-radius: 16px;
          padding: 16px;
          flex: 1;
          border: 1px solid rgba(255,255,255,0.6);
        }
        .info-label {
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 800;
          color: #9e9488;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 18px;
          font-weight: 800;
          color: #1a1c1d;
        }
        .coupon-tab {
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid rgba(112,93,0,0.2);
          color: #5e5e5e;
          background: rgba(255,255,255,0.5);
          transition: all 0.2s;
        }
        .coupon-tab.active {
          background: #ffd700;
          color: #1a1c1d;
          border-color: #ffd700;
        }
        .coupon-card {
          border: 1px solid rgba(112,93,0,0.15);
          border-radius: 12px;
          padding: 16px;
          background: rgba(255,255,255,0.6);
          margin-bottom: 12px;
        }
      `}</style>

      {/* Modals */}
      {showModal && flight && (
        <BookingConfirmModal
          flight={flight}
          totalPassengers={totalPassengers}
          onClose={() => setShowModal(false)}
          selectedClass={selectedClass}
          pricePerPax={pricePerPax}
          classAvailableSeats={classAvailableSeats}
        />
      )}
      {showWaitlistModal && flight && (
        <WaitlistJoinModal
          flight={flight}
          onClose={() => setShowWaitlistModal(false)}
          initialSeatCount={Math.max(1, Math.min(9, totalPassengers))}
          selectedClass={selectedClass}
          pricePerPax={pricePerPax}
        />
      )}

      <div className="detail-bg">
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 24px' }}>
          
          <a href="/flights" onClick={handleBack} className="back-link">
            <ArrowLeft size={16} /> Back to Listings
          </a>

          {/* Two Column Layout Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32, alignItems: 'start' }}>
            
            {/* LEFT COLUMN: Flight Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Main Flight Card */}
              <div className="glass-panel">
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, background: '#fcfaf6', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                       <Plane size={24} color="#d0c6ab" style={{ transform: 'rotate(-45deg)' }} />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1a1c1d' }}>{flight.airline} {flight.flight_number}</h2>
                      <div style={{ fontSize: 14, color: '#5e5e5e', marginTop: 4 }}>{selectedClass} Class</div>
                    </div>
                  </div>
                  <StatusBadge status={flight.status} />
                </div>

                {/* Timeline */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#9e9488', letterSpacing: '0.1em', marginBottom: 8 }}>DEPARTURE</div>
                    <div className="flight-time-large">{fmtTime(flight.departure_time)}</div>
                    <div className="flight-city-large">{flight.source_airport}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#5e5e5e', marginTop: 4, maxWidth: 160 }}>
                      {flight.source_airport_name || 'Airport'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#5e5e5e' }}>
                      {flight.source_terminals?.length > 0 ? `Terminal ${flight.source_terminals[0]}` : 'Terminal 1'}
                    </div>
                    <div className="flight-date-small">{fmtDate(flight.departure_time)}</div>
                  </div>
                  
                  <div style={{ flex: 1, padding: '0 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#705d00', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Clock size={14} /> {duration}
                    </div>
                    <div style={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d0c6ab' }}></div>
                      <div style={{ flex: 1, borderTop: '2px dashed #d0c6ab', margin: '0 4px' }}></div>
                      <Plane size={16} color="#d0c6ab" style={{ margin: '0 8px', transform: 'rotate(90deg)' }} />
                      <div style={{ flex: 1, borderTop: '2px dashed #d0c6ab', margin: '0 4px' }}></div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d0c6ab' }}></div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#9e9488', marginTop: 8 }}>Non-stop</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#9e9488', letterSpacing: '0.1em', marginBottom: 8 }}>ARRIVAL</div>
                    <div className="flight-time-large">{fmtTime(flight.arrival_time)}</div>
                    <div className="flight-city-large">{flight.destination_airport}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#5e5e5e', marginTop: 4, maxWidth: 160 }}>
                      {flight.destination_airport_name || 'Airport'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#5e5e5e' }}>
                      {flight.destination_terminals?.length > 0 ? `Terminal ${flight.destination_terminals[0]}` : 'Terminal 1'}
                    </div>
                    <div className="flight-date-small">{fmtDate(flight.arrival_time)}</div>
                  </div>
                </div>

                {/* Info Cards */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
                  <div className="info-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(255,215,0,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: '#705d00' }}>₹</span>
                    </div>
                    <div>
                      <div className="info-label">{selectedClass} Fare</div>
                      <div className="info-value">{INR(pricePerPax)}</div>
                    </div>
                  </div>
                  
                  <div className="info-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(255,215,0,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={18} color="#705d00" />
                    </div>
                    <div>
                      <div className="info-label">Available Seats</div>
                      <div className="info-value">{classAvailableSeats}</div>
                    </div>
                  </div>
                  
                  <div className="info-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(255,215,0,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={18} color="#705d00" />
                    </div>
                    <div>
                      <div className="info-label">Duration</div>
                      <div className="info-value">{duration}</div>
                    </div>
                  </div>
                </div>

                {/* Baggage Info — real data from FlightRoute */}
                <div style={{ display: 'flex', gap: 24, padding: '20px 24px', background: 'rgba(255,255,255,0.4)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Briefcase size={20} color="#705d00" />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#5e5e5e' }}>CABIN BAGGAGE</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1c1d' }}>{handbagWeightKg} Kgs (1 piece only) / Adult</div>
                    </div>
                  </div>
                  <div style={{ width: 1, background: 'rgba(112,93,0,0.1)' }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Luggage size={20} color="#705d00" />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#5e5e5e' }}>CHECK-IN BAGGAGE</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1c1d' }}>
                        {selectedFare?.baggage_allowance || baggageWeightKg} Kgs ({baggageNumAllowed} piece{baggageNumAllowed > 1 ? 's' : ''}) / Adult
                      </div>
                    </div>
                  </div>
                  {selectedFare?.meal_included && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Gift size={20} color="#705d00" />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#5e5e5e' }}>MEAL</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1c1d' }}>Included</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Cancellation Policy (Brand Style) */}
              <div className="glass-panel" style={{ padding: 24, transition: 'all 0.3s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, margin: 0, fontWeight: 800, color: '#1a1c1d' }}>Cancellation Policy</h3>
                  <div 
                    onClick={() => setShowCancelDetails(!showCancelDetails)}
                    style={{ color: '#705d00', fontSize: 13, fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
                  >
                    {showCancelDetails ? 'Hide Details' : 'View Details'}
                  </div>
                </div>
                
                <div style={{ position: 'relative', paddingTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
                    <span style={{ color: '#5e5e5e', fontWeight: 600 }}>Penalty:</span>
                    <span style={{ fontWeight: 800, color: '#1a1c1d' }}>{INR(penaltyAmount1)}</span>
                    <span style={{ fontWeight: 800, color: '#1a1c1d' }}>{INR(penaltyAmount2)}</span>
                  </div>
                  
                  {/* Timeline Bar matching theme */}
                  <div style={{ height: 8, display: 'flex', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ flex: 1, background: '#4caf50' }}></div>
                    <div style={{ width: 4, background: 'transparent' }}></div>
                    <div style={{ flex: 1, background: '#f44336' }}></div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: '#5e5e5e', fontWeight: 600 }}>
                    <span>Cancel Between (IST): Now</span>
                    <span style={{ textAlign: 'center' }}>
                      <div style={{ color: '#1a1c1d' }}>{fmtDate(timelineIsoString)}</div>
                      <div>{fmtTime(timelineIsoString)}</div>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <div style={{ color: '#1a1c1d' }}>{fmtDate(flight.departure_time)}</div>
                      <div>{fmtTime(flight.departure_time)}</div>
                    </span>
                  </div>
                  
                  {/* Expanded Details */}
                  {showCancelDetails && (
                    <div style={{ 
                      marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.05)',
                      fontSize: 13, color: '#5e5e5e', lineHeight: 1.6, animation: 'fadeIn 0.3s ease'
                    }}>
                      <div style={{ fontWeight: 700, color: '#1a1c1d', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={14} style={{ color: '#705d00' }} /> Important Information
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        <li>The penalties shown above apply to the total booking amount for all {totalPassengers} passengers.</li>
                        {selectedFare?.refund_type === 'NON_REFUNDABLE' && (
                          <li>This is a strictly <strong>Non-Refundable</strong> ticket. Cancellations will result in a 100% penalty.</li>
                        )}
                        {selectedFare?.refund_type === 'REFUNDABLE' && (
                          <li>This is a <strong>Refundable</strong> ticket. The penalty shown represents the fixed airline cancellation fee.</li>
                        )}
                        {selectedFare?.refund_type === 'PARTIAL' && (
                          <li>This is a <strong>Partially Refundable</strong> ticket. Penalties increase significantly as it gets closer to departure.</li>
                        )}
                        <li>A standard 5% payment processing fee is deducted from the final refunded amount during processing.</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Fare Summary & Booking */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Fare Summary Panel */}
              <div className="glass-panel" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 20, margin: '0 0 24px', fontWeight: 800, color: '#1a1c1d' }}>Fare Summary</h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 15, color: '#5e5e5e', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={14} style={{ color: '#705d00' }} /> Base Fare
                  </span>
                  <span style={{ color: '#1a1c1d', fontWeight: 700 }}>{INR(baseFareTotal)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, fontSize: 15, color: '#5e5e5e', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={14} style={{ color: '#705d00' }} /> Taxes & Surcharges
                  </span>
                  <span style={{ color: '#1a1c1d', fontWeight: 700 }}>{INR(taxesAndSurcharges)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px dashed rgba(112,93,0,0.2)', paddingTop: 20, marginBottom: 32, alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: 18, color: '#1a1c1d' }}>Total Amount</span>
                  <span style={{ fontWeight: 800, fontSize: 24, color: '#1a1c1d' }}>{INR(totalAmount)}</span>
                </div>

                {/* Action Button */}
                {canBook ? (
                  <button className="book-btn" onClick={handleBookNow}>
                    {t('flights.continue', 'Book Now')} <ArrowRight size={18} />
                  </button>
                ) : isSoldOut && !isPastDeparture && !isUnbookableStatus ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{
                      background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)',
                      borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12,
                      fontSize: 14, fontWeight: 700, color: '#705d00',
                    }}>
                      <Users size={20} />
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
                    >
                      {isAuthenticated ? t('flights.joinWaitingList', 'Join Waiting List') : t('flights.loginToJoinWaitlist', 'Login to Join Waitlist')}
                    </button>
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(112,93,0,0.1)', color: '#705d00',
                    fontWeight: 700, fontSize: 15, padding: 16, borderRadius: 12,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
                  }}>
                    <AlertCircle size={18} />
                    <span>{t('flights.notAvailable', 'Not Available')} <span style={{ opacity: 0.8, fontWeight: 500, marginLeft: 4 }}>({unavailableReason})</span></span>
                  </div>
                )}
              </div>

              {/* Coupons Panel */}
              <div className="glass-panel" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, margin: 0, fontWeight: 800, color: '#1a1c1d' }}>Offers</h3>
                  <Gift size={20} color="#705d00" />
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <div className="coupon-tab active">All</div>
                  <div className="coupon-tab">Bank</div>
                  <div className="coupon-tab">Special</div>
                </div>

                <div className="coupon-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#1a1c1d', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Percent size={14} color="#4caf50" /> MMTSECURE
                    </span>
                    <span style={{ color: '#4caf50', fontWeight: 800, fontSize: 14 }}>₹ 567 off</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#5e5e5e', fontWeight: 600, lineHeight: 1.4 }}>
                    Instant discount on your flight booking and Trip Secure combo
                  </div>
                  <div style={{ textAlign: 'right', marginTop: 12, color: '#705d00', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>
                    APPLY
                  </div>
                </div>

                <div className="coupon-card" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#1a1c1d', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Percent size={14} color="#e91e63" /> AXISEMI
                    </span>
                    <span style={{ color: '#e91e63', fontWeight: 800, fontSize: 14 }}>₹ 944 off</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#5e5e5e', fontWeight: 600, lineHeight: 1.4 }}>
                    Additional savings on Axis bank Credit Card EMI.
                  </div>
                  <div style={{ textAlign: 'right', marginTop: 12, color: '#705d00', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>
                    APPLY
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </>
  );
}
