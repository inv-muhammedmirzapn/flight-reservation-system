import { useState, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchFlights, clearFlightsList } from '@/store/flightSlice';
import { API_BASE_URL } from '@/services/apiClient';
import { Plane, Search, ArrowRight, Filter, X, ArrowLeftRight, Users, ChevronDown } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';
import DateSwitcher from '@/components/ui/DateSwitcher';
import PassengerSelector from '@/components/ui/PassengerSelector';
import { Pagination } from '@/components/ui/Pagination';
import LocationAutocomplete from '@/components/ui/LocationAutocomplete';

import { INR, fmtTime, fmtDate, diffHM } from '@/utils/formatters';

/* ── status badge ─────────────────────────────────────────── */
const STATUS_STYLES = {
  SCHEDULED: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  DELAYED: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  CANCELLED: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  BOARDING: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  DEPARTED: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  ARRIVED: { bg: '#f3e8ff', color: '#7c3aed', border: '#d8b4fe' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: 9999,
      padding: '2px 10px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

/* ── FlightCard (horizontal Stitch style) ─────────────────── */
function FlightCard({ flight }) {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const depTime = fmtTime(flight.departure_time);
  const arrTime = fmtTime(flight.arrival_time);
  const duration = diffHM(flight.departure_time, flight.arrival_time);
  const cabinClass = searchParams.get('class') || 'Economy';
  const selectedClassObj = flight.classes?.find(c => c.class_name.toUpperCase() === cabinClass.toUpperCase()) || flight.classes?.[0];
  const displayPrice = selectedClassObj ? parseFloat(selectedClassObj.price) : flight.base_fare;
  const displaySeats = selectedClassObj ? selectedClassObj.available_seats : flight.available_seats;

  return (
    <Link
      to={`/flights/${flight.id}?${searchParams.toString()}`}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        border: '1px solid rgba(255,255,255,0.5)',
        borderRadius: 16,
        padding: '24px 32px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
      }}
      className="flight-row-card"
    >
      {/* Left: Airline logo + route info */}
      <div className="flight-card-main" style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1, minWidth: 0, width: '100%', flexWrap: 'wrap' }}>
        {/* Airline Icon placeholder */}
        <div style={{
          width: 56, height: 56,
          borderRadius: '50%',
          background: '#eeeef0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Plane size={22} color="#705d00" />
        </div>

        {/* Route timeline */}
        <div className="flight-card-timeline" style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '1 1 260px', minWidth: 260 }}>
          {/* Departure */}
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1c1d', lineHeight: 1.1, fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}>
              {depTime}
            </div>
            <div style={{ fontSize: 14, color: '#1a1c1d', marginTop: 2, fontWeight: 800 }}>
              {flight.source_airport}
            </div>
            {flight.source_airport_name && (
              <div style={{ fontSize: 11, color: '#705d00', fontWeight: 600, maxWidth: 120, margin: '0 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={flight.source_airport_name}>
                {flight.source_airport_name}
              </div>
            )}
          </div>

          {/* Duration line */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5e5e5e', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
              {duration}
            </div>
            <div style={{ width: '100%', position: 'relative', height: 2, background: '#d0c6ab' }}>
              {(flight.stops || []).map((stop, index) => {
                const stopsCount = (flight.stops || []).length;
                const leftPercent = `${((index + 1) / (stopsCount + 1)) * 100}%`;
                return (
                  <div
                    key={`stop-dot-${index}`}
                    style={{
                      position: 'absolute', top: -4, left: leftPercent, transform: 'translateX(-50%)',
                      width: 10, height: 10, borderRadius: '50%', background: '#ffd700',
                      border: '2px solid #705d00',
                    }}
                    title={stop.stop_location || `Stop ${index + 1}`}
                  />
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: '#705d00', marginTop: 4, fontWeight: 600, textAlign: 'center' }}>
              {(flight.stops || []).length === 0
                ? t("flights.nonStop", { defaultValue: 'Non-stop' })
                : (flight.stops || []).length === 1
                  ? t("flights.oneStop", { defaultValue: '1 Stop' }) + ((flight.stops || [])[0]?.stop_location ? ` (${(flight.stops || [])[0].stop_location})` : '')
                  : `${(flight.stops || []).length} Stops${(flight.stops || []).map(s => s.stop_location).filter(Boolean).length > 0 ? ` (${(flight.stops || []).map(s => s.stop_location).filter(Boolean).join(', ')})` : ''}`
              }
            </div>
          </div>

          {/* Arrival */}
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1c1d', lineHeight: 1.1, fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}>
              {arrTime}
            </div>
            <div style={{ fontSize: 14, color: '#1a1c1d', marginTop: 2, fontWeight: 800 }}>
              {flight.destination_airport}
            </div>
            {flight.destination_airport_name && (
              <div style={{ fontSize: 11, color: '#705d00', fontWeight: 600, maxWidth: 120, margin: '0 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={flight.destination_airport_name}>
                {flight.destination_airport_name}
              </div>
            )}
          </div>
        </div>

        {/* Flight meta */}
        <div className="flight-card-meta" style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 240px' }}>
          <div className="flight-card-meta-top" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#1a1c1d', fontSize: 14 }}>{flight.flight_number}</span>
            <StatusBadge status={flight.status} />
            {displaySeats === 0 && (
              <span style={{
                background: '#ffedd5',
                color: '#9a3412',
                border: '1px solid #fed7aa',
                borderRadius: 9999,
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}>
                {t("flights.waitingList", { defaultValue: 'Waiting List' })}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#5e5e5e' }}>{flight.airline} · {flight.aircraft}</div>
          <div style={{ fontSize: 12, color: '#5e5e5e' }}>{fmtDate(flight.departure_time)}</div>
          <div style={{ fontSize: 12, color: '#5e5e5e', marginTop: 2 }}>
            💺 {displaySeats} {selectedClassObj ? (selectedClassObj.class_name.charAt(0) + selectedClassObj.class_name.slice(1).toLowerCase()) : ''} seats available
          </div>
        </div>
      </div>

      {/* Right: Price + Select button */}
      <div className="flight-card-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
        <div style={{
          fontSize: 28, fontWeight: 800,
          color: '#1a1c1d',
          fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
          letterSpacing: '-0.01em',
        }}>
          {INR(displayPrice)}
        </div>
        <div style={{
          background: '#ffd700',
          color: '#1a1c1d',
          fontWeight: 700,
          fontSize: 14,
          padding: '10px 28px',
          borderRadius: 12,
          border: 'none',
          cursor: 'pointer',
          transition: 'background 0.2s',
          boxShadow: '0 4px 14px rgba(255,215,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
          className="select-btn"
        >
          {t("flights.select", { defaultValue: 'Select' })} <ArrowRight size={14} />
        </div>
      </div>
    </Link>
  );
}

const FieldWrap = ({ label, children, center }) => (
  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, alignItems: center ? 'center' : 'flex-start', textAlign: center ? 'center' : 'left' }}>
    <span style={{ fontSize: 10, fontWeight: 800, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{label}</span>
    {children}
  </div>
);

/* ── Fixed Top Search Bar ────────────────────────────────── */
function SearchBar({ source, setSource, destination, setDestination, depDate, setDepDate, arrDate, setArrDate, adults, setAdults, childrenCount, setChildrenCount, infants, setInfants, cabinClass, setCabinClass }) {
  const [showPax, setShowPax] = useState(false);
  const paxRef = useRef(null);
  const [showClass, setShowClass] = useState(false);
  const classRef = useRef(null);

  useEffect(() => {
    function outside(e) {
      if (paxRef.current && !paxRef.current.contains(e.target)) setShowPax(false);
      if (classRef.current && !classRef.current.contains(e.target)) setShowClass(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const paxLabel = `${adults} Adult${adults > 1 ? 's' : ''}${childrenCount ? `, ${childrenCount} Child` : ''}${infants ? `, ${infants} Infant` : ''}`;

  const swap = () => { const t = source; setSource(destination); setDestination(t); };

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(1rem + 64px + 10px)',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '95%',
      maxWidth: 1800,
      zIndex: 49,
      borderRadius: '1rem',
      border: '1px solid rgba(255,255,255,0.4)',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.07)',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      padding: '0 1rem',
      gap: 0,
    }}>
      {/* All search fields in one flex row */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', height: '100%', minWidth: 0 }}>

        {/* FROM */}
        <div style={{ flex: 2, minWidth: 0, padding: '0 14px', borderRight: '1px solid #e8e4da', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FieldWrap label="From" center>
            <LocationAutocomplete
              placeholder="City or Airport"
              value={source}
              onChange={setSource}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontWeight: 700, color: '#1a1c1d', width: '100%', fontFamily: 'Inter,sans-serif', textAlign: 'center' }}
            />
          </FieldWrap>
        </div>

        {/* Swap Button — inline flex item */}
        <button onClick={swap} style={{
          flexShrink: 0, width: 32, alignSelf: 'center',
          background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.4)',
          borderRadius: '50%', height: 32,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 4px',
        }}>
          <ArrowLeftRight size={13} color="#705d00" />
        </button>

        {/* TO */}
        <div style={{ flex: 2, minWidth: 0, padding: '0 14px', borderRight: '1px solid #e8e4da', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FieldWrap label="To" center>
            <LocationAutocomplete
              placeholder="City or Airport"
              value={destination}
              onChange={setDestination}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontWeight: 700, color: '#1a1c1d', width: '100%', fontFamily: 'Inter,sans-serif', textAlign: 'center' }}
            />
          </FieldWrap>
        </div>

        {/* DEPARTURE DATE */}
        <div style={{ flex: 1.4, minWidth: 0, padding: '0 14px', borderRight: '1px solid #e8e4da', display: 'flex', alignItems: 'center' }}>
          <FieldWrap label="Departure">
            <DatePicker
              value={depDate}
              onChange={setDepDate}
              placeholder="Add date"
              variant="transparent"
            />
          </FieldWrap>
        </div>

        {/* RETURN DATE */}
        <div style={{ flex: 1.2, minWidth: 0, padding: '0 14px', borderRight: '1px solid #e8e4da', display: 'flex', alignItems: 'center' }}>
          <FieldWrap label="Return">
            <DatePicker
              value={arrDate}
              onChange={setArrDate}
              placeholder="Add return"
              variant="transparent"
            />
          </FieldWrap>
        </div>

        {/* PASSENGERS */}
        <div ref={paxRef} style={{ flex: 1.1, minWidth: 0, padding: '0 14px', borderRight: '1px solid #e8e4da', position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setShowPax(v => !v)}>
          <FieldWrap label="Travellers">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1c1d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{paxLabel}</span>
              <ChevronDown size={13} color="#9e9488" style={{ flexShrink: 0 }} />
            </div>
          </FieldWrap>
          {showPax && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 9999,
              background: '#fff', borderRadius: 16, padding: 20, minWidth: 280,
              boxShadow: '0 12px 40px rgba(0,0,0,0.14)', border: '1px solid #f0ede5',
            }} onClick={e => e.stopPropagation()}>
              {[['Adults', adults, setAdults, [1, 2, 3, 4, 5, 6, 7, 8, 9], 'Age 12+'], ['Children', childrenCount, setChildrenCount, [0, 1, 2, 3, 4, 5, 6], 'Age 2-11'], ['Infants', infants, setInfants, [0, 1, 2, 3, 4, 5, 6], 'Under 2']].map(([lbl, val, setter, opts, sub]) => (
                <div key={lbl} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1c1d' }}>{lbl} <span style={{ fontSize: 10, color: '#9e9488', fontWeight: 400 }}>({sub})</span></div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {opts.map(o => (
                      <button key={o} onClick={() => setter(o)} style={{
                        width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: val === o ? '#ffd700' : '#f5f5f5',
                        color: val === o ? '#1a1c1d' : '#5e5e5e',
                        fontWeight: 700, fontSize: 13,
                      }}>{o}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CLASS */}
        <div ref={classRef} style={{ flex: 1, minWidth: 0, padding: '0 14px', position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setShowClass(v => !v)}>
          <FieldWrap label="Class">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1c1d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cabinClass}</span>
              <ChevronDown size={13} color="#9e9488" style={{ flexShrink: 0 }} />
            </div>
          </FieldWrap>
          {showClass && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 9999,
              background: '#fff', borderRadius: 16, padding: 14, minWidth: 160,
              boxShadow: '0 12px 40px rgba(0,0,0,0.14)', border: '1px solid #f0ede5',
              display: 'flex', flexDirection: 'column', gap: 6
            }} onClick={e => e.stopPropagation()}>
              {['Economy', 'Business', 'First'].map(c => (
                <button key={c} onClick={() => { setCabinClass(c); setShowClass(false); }} style={{
                  padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: cabinClass === c ? '#ffd700' : 'transparent',
                  color: cabinClass === c ? '#1a1c1d' : '#5e5e5e',
                  fontWeight: cabinClass === c ? 800 : 600, fontSize: 13,
                  textAlign: 'left', transition: 'all 0.15s ease'
                }}
                  onMouseEnter={e => { if (cabinClass !== c) e.currentTarget.style.background = '#f5f5f5' }}
                  onMouseLeave={e => { if (cabinClass !== c) e.currentTarget.style.background = 'transparent' }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SEARCH BUTTON */}
      <button style={{
        marginLeft: 12, padding: '0 20px', height: 42, borderRadius: 10,
        background: '#ffd700', border: 'none', cursor: 'pointer',
        fontWeight: 800, fontSize: 14, color: '#1a1c1d',
        boxShadow: '0 4px 16px rgba(255,215,0,0.4)',
        display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0, whiteSpace: 'nowrap',
        transition: 'background 0.2s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = '#ffe333'}
        onMouseLeave={e => e.currentTarget.style.background = '#ffd700'}
      >
        <Search size={14} /> Search
      </button>
    </div>
  );
}

/* ── Sidebar Filters ──────────────────────────────────────── */
function Sidebar({
  statusFilter, setStatusFilter,
  minFare, setMinFare, absMin,
  maxFare, setMaxFare, absMax,
  stopsFilter, setStopsFilter,
  airlinesFilter, setAirlinesFilter,
  baggageFilter, setBaggageFilter,
  availableAirlines,
  onClearFilters,
  mobileFiltersOpen, setMobileFiltersOpen
}) {
  const { t } = useTranslation();
  const statuses = ['SCHEDULED', 'DELAYED', 'CANCELLED', 'BOARDING', 'DEPARTED', 'ARRIVED'];

  const [localMinFare, setLocalMinFare] = useState(minFare);
  const [localMaxFare, setLocalMaxFare] = useState(maxFare);

  useEffect(() => {
    setLocalMinFare(minFare);
  }, [minFare]);

  useEffect(() => {
    setLocalMaxFare(maxFare);
  }, [maxFare]);

  const commitMinFare = (val) => {
    if (val !== minFare) {
      setMinFare(val);
    }
  };

  const commitMaxFare = (val) => {
    if (val !== maxFare) {
      setMaxFare(val);
    }
  };

  return (
    <>
      {/* Overlay for mobile drawer */}
      <div className={`sidebar-overlay ${mobileFiltersOpen ? 'open' : ''}`} onClick={() => setMobileFiltersOpen(false)} />

      <aside className={`sidebar-aside ${mobileFiltersOpen ? 'open' : ''}`} style={{
        width: 260,
        flexShrink: 0,
        position: 'sticky',
        top: 88,
        alignSelf: 'flex-start',
        zIndex: 10,
      }}>
        <div className="glass-card" style={{
          borderRadius: 20,
          maxHeight: 'calc(100vh - 120px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* Close button (mobile only) */}
          <button
            className="mobile-close-btn"
            onClick={() => setMobileFiltersOpen(false)}
            style={{
              display: 'none', background: 'rgba(0,0,0,0.05)', border: 'none',
              position: 'absolute', top: 12, right: 12, cursor: 'pointer',
              borderRadius: '50%', padding: 6, zIndex: 10
            }}
          >
            <X size={20} color="#1a1c1d" />
          </button>

          <div className="sidebar-scroll" style={{
            padding: 28,
            overflowY: 'auto',
            flex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{
                fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                fontSize: 22, fontWeight: 700, color: '#1a1c1d',
              }}>
                {t("flights.filters", { defaultValue: 'Filters' })}
              </h2>
              <button
                onClick={onClearFilters}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#705d00',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(112,93,0,0.1)'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
              >
                {t("flights.clearAll", { defaultValue: 'Clear All' })}
              </button>
            </div>

            {/* Airline Filter */}
            {availableAirlines.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>Airlines</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {availableAirlines.map(airline => (
                    <label key={airline} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={airlinesFilter.includes(airline)}
                        onChange={() => {
                          if (airlinesFilter.includes(airline)) setAirlinesFilter(airlinesFilter.filter(a => a !== airline));
                          else setAirlinesFilter([...airlinesFilter, airline]);
                        }}
                        style={{ accentColor: '#705d00' }}
                      />
                      <span style={{ color: '#1a1c1d' }}>{airline}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Baggage Filter */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>Baggage</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[{ label: 'Check-in Baggage', value: 'checkin' }, { label: 'Cabin Baggage', value: 'cabin' }].map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={baggageFilter.includes(opt.value)}
                      onChange={() => {
                        if (baggageFilter.includes(opt.value)) setBaggageFilter(baggageFilter.filter(b => b !== opt.value));
                        else setBaggageFilter([...baggageFilter, opt.value]);
                      }}
                      style={{ accentColor: '#705d00' }}
                    />
                    <span style={{ color: '#1a1c1d' }}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>{t("flights.priceRange", { defaultValue: 'Price Range' })}</h3>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="min-price-slider" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5e5e5e', textTransform: 'uppercase', marginBottom: 6 }}>{t("flights.minPrice", { defaultValue: 'Min Price' })}</label>
                <input
                  id="min-price-slider"
                  type="range"
                  min={absMin}
                  max={localMaxFare}
                  value={localMinFare}
                  onChange={e => setLocalMinFare(Number(e.target.value))}
                  onMouseUp={() => commitMinFare(localMinFare)}
                  onTouchEnd={() => commitMinFare(localMinFare)}
                  onKeyUp={() => commitMinFare(localMinFare)}
                  style={{ width: '100%', accentColor: '#705d00' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#5e5e5e', marginTop: 4 }}>
                  <span>{INR(absMin)}</span>
                  <span style={{ fontWeight: 700, color: '#705d00' }}>{INR(localMinFare)}</span>
                </div>
              </div>

              <div>
                <label htmlFor="max-price-slider" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5e5e5e', textTransform: 'uppercase', marginBottom: 6 }}>{t("flights.maxPrice", { defaultValue: 'Max Price' })}</label>
                <input
                  id="max-price-slider"
                  type="range"
                  min={localMinFare}
                  max={absMax}
                  value={localMaxFare}
                  onChange={e => setLocalMaxFare(Number(e.target.value))}
                  onMouseUp={() => commitMaxFare(localMaxFare)}
                  onTouchEnd={() => commitMaxFare(localMaxFare)}
                  onKeyUp={() => commitMaxFare(localMaxFare)}
                  style={{ width: '100%', accentColor: '#705d00' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#5e5e5e', marginTop: 4 }}>
                  <span>{INR(localMinFare)}</span>
                  <span style={{ fontWeight: 700, color: '#705d00' }}>{INR(localMaxFare)}</span>
                </div>
              </div>
            </div>

            {/* Stops filter */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>{t("flights.stops", { defaultValue: 'Stops' })}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: t("flights.nonStop", { defaultValue: 'Non-stop' }), value: 0 },
                  { label: t("flights.oneStop", { defaultValue: '1 Stop' }), value: 1 },
                  { label: t("flights.twoPlusStops", { defaultValue: '2+ Stops' }), value: 2 },
                ].map(opt => {
                  const isChecked = stopsFilter.includes(opt.value);
                  return (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setStopsFilter(stopsFilter.filter(v => v !== opt.value));
                          } else {
                            setStopsFilter([...stopsFilter, opt.value]);
                          }
                        }}
                        style={{ accentColor: '#705d00' }}
                      />
                      <span style={{ color: '#1a1c1d' }}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Status filter */}
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>{t("flights.status", { defaultValue: 'Status' })}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="radio"
                    name="status"
                    value=""
                    checked={statusFilter === ''}
                    onChange={() => setStatusFilter('')}
                    style={{ accentColor: '#705d00' }}
                  />
                  <span style={{ color: '#1a1c1d' }}>{t("flights.allStatuses", { defaultValue: 'All Statuses' })}</span>
                </label>
                {statuses.map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="radio"
                      name="status"
                      value={s}
                      checked={statusFilter === s}
                      onChange={() => setStatusFilter(s)}
                      style={{ accentColor: '#705d00' }}
                    />
                    <span style={{ color: '#1a1c1d' }}>{s.charAt(0) + s.slice(1).toLowerCase()}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ── Main Component ───────────────────────────────────────── */
export default function UserFlightsList() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { list: flights, count, totalPages, loading, error } = useSelector(state => state.flights);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [airlinesFilter, setAirlinesFilter] = useState([]);
  const [baggageFilter, setBaggageFilter] = useState([]);

  // Sorting fallback to ensure flight entries are sorted chronologically by departure time
  const sortedFlights = useMemo(() => {
    if (!flights) return [];
    let result = [...flights].sort((a, b) => new Date(a.departure_time) - new Date(b.departure_time));
    if (airlinesFilter.length > 0) result = result.filter(f => airlinesFilter.includes(f.airline));
    return result;
  }, [flights, airlinesFilter]);

  // Derive available airlines from current flight list
  const availableAirlines = useMemo(() => {
    if (!flights) return [];
    return [...new Set(flights.map(f => f.airline).filter(Boolean))].sort();
  }, [flights]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [cabinClass, setCabinClass] = useState(searchParams.get('class') || 'Economy');
  const source = searchParams.get('from') || '';
  const destination = searchParams.get('to') || '';
  const statusFilter = searchParams.get('status') || '';

  const minFareParam = searchParams.get('minFare');
  const minFare = minFareParam !== null ? Number(minFareParam) : null;
  const maxFareParam = searchParams.get('maxFare');
  const maxFare = maxFareParam !== null ? Number(maxFareParam) : null;

  const depDate = searchParams.get('depDate') || '';
  const arrDate = searchParams.get('arrDate') || '';

  const adults = Number(searchParams.get('adults')) || 1;
  const childrenCount = Number(searchParams.get('children')) || 0;
  const infants = Number(searchParams.get('infants')) || 0;

  const stopsParam = searchParams.get('stops');
  const stopsFilter = useMemo(() => stopsParam ? stopsParam.split(',').map(Number) : [], [stopsParam]);

  const setSource = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set('from', val);
      else next.delete('from');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setDestination = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set('to', val);
      else next.delete('to');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setStatusFilter = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set('status', val);
      else next.delete('status');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setMinFare = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val !== null && val !== undefined) next.set('minFare', val.toString());
      else next.delete('minFare');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setMaxFare = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val !== null && val !== undefined) next.set('maxFare', val.toString());
      else next.delete('maxFare');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setDepDate = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set('depDate', val);
      else next.delete('depDate');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setArrDate = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set('arrDate', val);
      else next.delete('arrDate');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setAdults = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('adults', val.toString());
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setChildrenCount = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('children', val.toString());
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setInfants = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('infants', val.toString());
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const updateCabinClass = (val) => {
    setCabinClass(val);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('class', val);
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setStopsFilter = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val && val.length > 0) next.set('stops', val.join(','));
      else next.delete('stops');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  // Server-side pagination state
  const pageParam = Number(searchParams.get('page')) || 1;
  const setPage = (page) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (page > 1) next.set('page', page.toString());
      else next.delete('page');
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    let nextParams = null;

    if (searchParams.toString() === '') {
      nextParams = new URLSearchParams({
        adults: '1'
      });
    }

    if (nextParams) {
      setSearchParams(nextParams, { replace: true });
      return;
    }

    // Fetch flights for server-side filtering and pagination
    dispatch(fetchFlights({
      page: pageParam,
      params: {
        search: searchParams.get('search') || undefined,
        status: statusFilter || undefined,
        source: source || undefined,
        destination: destination || undefined,
        date: depDate || undefined,
        arrival_date: arrDate || undefined,
        min_fare: minFare || undefined,
        max_fare: maxFare || undefined,
        stops: stopsFilter.length > 0 ? stopsFilter.join(',') : undefined,
        class: cabinClass || undefined,
        ordering: 'departure_time',
      }
    }));
  }, [dispatch, pageParam, statusFilter, source, destination, depDate, arrDate, minFare, maxFare, stopsFilter, cabinClass, searchParams]);

  // Clear flights on unmount to prevent showing old data briefly
  useEffect(() => {
    return () => {
      dispatch(clearFlightsList());
    };
  }, [dispatch]);

  const handlePageChange = (page) => {
    setPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearFilters = () => {
    setAirlinesFilter([]);
    setBaggageFilter([]);
    setSearchParams(new URLSearchParams({
      adults: '1'
    }), { replace: true });
  };

  // Dynamic bounds for server-side pagination slider
  const [absMin, setAbsMin] = useState(0);
  const [absMax, setAbsMax] = useState(100000);

  useEffect(() => {
    let active = true;

    async function fetchBounds() {
      try {
        const params = new URLSearchParams();
        if (source) params.set('source', source);
        if (destination) params.set('destination', destination);
        if (depDate) params.set('date', depDate);
        params.set('page_size', '1');

        // Fetch Min fare
        params.set('ordering', 'base_fare');
        const minRes = await fetch(`${API_BASE_URL}/flights/?${params}`);
        if (!minRes.ok) return;
        const minData = await minRes.json();
        const minVal = minData.results?.[0]?.base_fare;

        // Fetch Max fare
        params.set('ordering', '-base_fare');
        const maxRes = await fetch(`${API_BASE_URL}/flights/?${params}`);
        if (!maxRes.ok) return;
        const maxData = await maxRes.json();
        const maxVal = maxData.results?.[0]?.base_fare;

        if (active) {
          const parsedMin = minVal ? Math.floor(parseFloat(minVal)) : 0;
          let parsedMax = maxVal ? Math.ceil(parseFloat(maxVal)) : 100000;

          if (parsedMax <= parsedMin && parsedMin > 0) {
            parsedMax = parsedMin + 1000; // ensure max is always strictly > min if there's data
          }

          setAbsMin(parsedMin);
          setAbsMax(parsedMax);
        }
      } catch (err) {
        console.error("Failed to fetch absolute fare bounds", err);
      }
    }

    fetchBounds();
    return () => { active = false; };
  }, [source, destination, depDate]);



  return (
    <>
      <style>{`
        .flight-row-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 20px 48px rgba(0,0,0,0.09) !important;
        }
        .select-btn:hover {
          background: #ffe333 !important;
        }
        .sidebar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.15);
          border-radius: 10px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.25);
        }
        .sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.15) transparent;
        }
        .mobile-filter-btn { display: none; }
        .sidebar-overlay { display: none; }
        
        @media (max-width: 1150px) {
          /* Medium screens: gracefully wrap the flight meta under the timeline */
          .flight-card-main {
            flex-wrap: wrap !important;
            gap: 16px 24px !important; /* vertical gap 16, horizontal 24 */
          }
          .flight-card-timeline {
            min-width: 200px !important;
          }
          .flight-card-meta {
            flex: 0 0 100% !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding-top: 16px;
            border-top: 1px dashed rgba(0,0,0,0.1);
          }
          .flight-card-meta > div:not(.flight-card-meta-top) {
            /* Keep secondary meta info inline on medium screens */
            display: flex;
            align-items: center;
            gap: 12px;
          }
        }
        
        @media (max-width: 900px) {
          .flights-layout { flex-direction: column !important; }
          .flight-row-card { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
          
          /* Flight Card Mobile Refinements */
          .flight-card-meta {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 8px !important;
          }
          .flight-card-meta > div:not(.flight-card-meta-top) {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
          .flight-card-right {
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: center !important;
            width: 100% !important;
            padding-top: 12px;
            border-top: 1px solid rgba(0,0,0,0.06);
          }
          
          /* Mobile Filter Button */
          .mobile-filter-btn { display: flex !important; }
          
          /* Drawer Overlay */
          .sidebar-overlay {
            display: block;
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            z-index: 150;
            opacity: 0; pointer-events: none;
            transition: opacity 0.3s;
          }
          .sidebar-overlay.open { opacity: 1; pointer-events: auto; }
          
          /* Drawer Panel */
          .sidebar-aside { 
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 85vw !important; max-width: 340px !important;
            height: 100vh !important;
            background: rgba(255,255,255,0.98) !important;
            backdrop-filter: blur(20px) !important;
            z-index: 200 !important;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
            box-shadow: 8px 0 32px rgba(0,0,0,0.1) !important;
          }
          .sidebar-aside.open {
            transform: translateX(0);
          }
          .sidebar-aside .glass-card {
            border-radius: 0 !important;
            max-height: 100vh !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
          }
          .mobile-close-btn { display: block !important; }
        }
      `}</style>

      <SearchBar
        source={source} setSource={setSource}
        destination={destination} setDestination={setDestination}
        depDate={depDate} setDepDate={setDepDate}
        arrDate={arrDate} setArrDate={setArrDate}
        adults={adults} setAdults={setAdults}
        childrenCount={childrenCount} setChildrenCount={setChildrenCount}
        infants={infants} setInfants={setInfants}
        cabinClass={cabinClass} setCabinClass={updateCabinClass}
      />
      <div style={{ width: '95%', maxWidth: 1800, margin: '0 auto', padding: '170px 0 48px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* Page Header
        <div className="glass-card" style={{
          borderRadius: 28,
          padding: '48px 56px',
          marginBottom: 32,
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -40, left: -40, width: 160, height: 160,
            borderRadius: '50%', background: '#ffd700', filter: 'blur(80px)', opacity: 0.18, pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -40, right: -40, width: 160, height: 160,
            borderRadius: '50%', background: '#bfdbfe', filter: 'blur(80px)', opacity: 0.2, pointerEvents: 'none',
          }} />
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
            fontSize: 42, fontWeight: 800, color: '#1a1c1d', letterSpacing: '-0.02em', lineHeight: 1.1,
            position: 'relative',
          }}>
            Explore Flight Paths
          </h1>
          <p style={{ fontSize: 15, color: '#5e5e5e', marginTop: 10, maxWidth: 480, margin: '10px auto 0', position: 'relative' }}>
            Search and track flights globally. Experience luxury flight details with Passenger.
          </p>
        </div> */}

        {/* Layout: Sidebar + List */}
        <div className="flights-layout" style={{ display: 'flex', gap: 28, alignItems: 'stretch', flex: 1 }}>

          {/* Sidebar */}
          <Sidebar
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            minFare={minFare ?? absMin} setMinFare={setMinFare}
            absMin={absMin}
            maxFare={maxFare ?? absMax} setMaxFare={setMaxFare}
            absMax={absMax}
            stopsFilter={stopsFilter} setStopsFilter={setStopsFilter}
            airlinesFilter={airlinesFilter} setAirlinesFilter={setAirlinesFilter}
            baggageFilter={baggageFilter} setBaggageFilter={setBaggageFilter}
            availableAirlines={availableAirlines}
            onClearFilters={handleClearFilters}
            mobileFiltersOpen={mobileFiltersOpen} setMobileFiltersOpen={setMobileFiltersOpen}
          />

          {/* Flight list */}
          <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

            {/* Compact search summary bar */}
            <div className="glass-card" style={{
              borderRadius: 16, padding: '14px 24px', marginBottom: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
            }}>
              {/* Spacer to balance the right-side count */}
              <div style={{ flex: 1 }} />
              {/* Centered route label */}
              <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: '#1a1c1d' }}>
                <span>{source || t("flights.anyOrigin", { defaultValue: 'Any Origin' })}</span>
                <Plane size={16} color="#705d00" />
                <span>{destination || t("flights.anyDestination", { defaultValue: 'Any Destination' })}</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16 }}>
                <div style={{ fontSize: 13, color: '#5e5e5e' }}>
                  {t(count === 1 ? "flights.flightsFound_one" : "flights.flightsFound_other", { count: count, defaultValue: `${count} flights found` })}
                  {statusFilter && ` · ${statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()}`}
                </div>
                {/* Mobile Filter Button */}
                <button
                  className="mobile-filter-btn"
                  onClick={() => setMobileFiltersOpen(true)}
                  style={{
                    display: 'none', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 10,
                    background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)',
                    color: '#705d00', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  <Filter size={14} /> Filters
                </button>
              </div>
            </div>

            {/* Quick Date Switcher */}
            <DateSwitcher
              activeDate={depDate}
              onDateChange={setDepDate}
              source={source}
              destination={destination}
            />

            {/* States */}
            {loading ? (
              <div style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                padding: '48px 0', gap: 16,
              }}>
                <div style={{
                  width: 40, height: 40, border: '3px solid rgba(112,93,0,0.15)',
                  borderTopColor: '#705d00', borderRadius: '50%', animation: 'spin 0.75s linear infinite',
                }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#5e5e5e', fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}>
                  {t("flights.fetching", { defaultValue: 'Fetching flight details...' })}
                </div>
              </div>
            ) : error ? (
              <div className="glass-card" style={{ borderRadius: 16, padding: 24, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', textAlign: 'center' }}>
                {error}
              </div>
            ) : sortedFlights.length === 0 ? (
              <div className="glass-card" style={{ borderRadius: 20, padding: 64, textAlign: 'center' }}>
                <Plane size={44} color="#d0c6ab" style={{ margin: '0 auto 16px' }} />
                <p style={{ fontWeight: 700, fontSize: 16, color: '#5e5e5e' }}>{t("flights.noFlightsFound", { defaultValue: 'No flights found matching your criteria.' })}</p>
                <p style={{ fontSize: 13, color: '#9e9488', marginTop: 6 }}>{t("flights.tryAdjusting", { defaultValue: 'Try adjusting your filters.' })}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
                {sortedFlights.map(flight => (
                  <FlightCard key={flight.id} flight={flight} />
                ))}

                {/* Server-side pagination bar */}
                {count > 0 && (
                  <div style={{ paddingTop: 24, marginTop: 'auto' }}>
                    <Pagination
                      currentPage={pageParam}
                      totalPages={totalPages}
                      totalCount={count}
                      pageSize={10}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
