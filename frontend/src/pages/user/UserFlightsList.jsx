import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchAllFlights } from '../../store/flightSlice';
import { Plane, Search, ArrowRight } from 'lucide-react';
import DatePicker from '../../components/ui/DatePicker';
import DateSwitcher from '../../components/ui/DateSwitcher';
import PassengerSelector from '../../components/ui/PassengerSelector';
import { Pagination } from '../../components/ui/Pagination';

/* ── helpers ──────────────────────────────────────────────── */
const INR = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const diffHM = (dep, arr) => {
  const ms = new Date(arr) - new Date(dep);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
};

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
  const depTime = fmtTime(flight.departure_time);
  const arrTime = fmtTime(flight.arrival_time);
  const duration = diffHM(flight.departure_time, flight.arrival_time);

  return (
    <Link
      to={`/flights/${flight.id}`}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        border: '1px solid #1a1c1d',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1, minWidth: 0 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
          {/* Departure */}
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1c1d', lineHeight: 1.1, fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}>
              {depTime}
            </div>
            <div style={{ fontSize: 13, color: '#5e5e5e', marginTop: 2, fontWeight: 600 }}>
              {flight.source_airport}
            </div>
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
                ? 'Non-stop'
                : (flight.stops || []).length === 1
                  ? `1 Stop${(flight.stops || [])[0]?.stop_location ? ` (${(flight.stops || [])[0].stop_location})` : ''}`
                  : `${(flight.stops || []).length} Stops${(flight.stops || []).map(s => s.stop_location).filter(Boolean).length > 0 ? ` (${(flight.stops || []).map(s => s.stop_location).filter(Boolean).join(', ')})` : ''}`
              }
            </div>
          </div>

          {/* Arrival */}
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1c1d', lineHeight: 1.1, fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}>
              {arrTime}
            </div>
            <div style={{ fontSize: 13, color: '#5e5e5e', marginTop: 2, fontWeight: 600 }}>
              {flight.destination_airport}
            </div>
          </div>
        </div>

        {/* Flight meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160, marginLeft: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#1a1c1d', fontSize: 14 }}>{flight.flight_number}</span>
            <StatusBadge status={flight.status} />
          </div>
          <div style={{ fontSize: 12, color: '#5e5e5e' }}>{flight.airline} · {flight.aircraft}</div>
          <div style={{ fontSize: 12, color: '#5e5e5e' }}>{fmtDate(flight.departure_time)}</div>
          <div style={{ fontSize: 12, color: '#5e5e5e', marginTop: 2 }}>
            💺 {flight.available_seats} / {flight.total_seats} seats
          </div>
        </div>
      </div>

      {/* Right: Price + Select button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
        <div style={{
          fontSize: 28, fontWeight: 800,
          color: '#1a1c1d',
          fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
          letterSpacing: '-0.01em',
        }}>
          {INR(flight.base_fare)}
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
          Select <ArrowRight size={14} />
        </div>
      </div>
    </Link>
  );
}

/* ── Sidebar Filters ──────────────────────────────────────── */
function Sidebar({
  source, setSource,
  destination, setDestination,
  statusFilter, setStatusFilter,
  minFare, setMinFare, absMin,
  maxFare, setMaxFare, absMax,
  depDate, setDepDate,
  arrDate, setArrDate,
  adults, setAdults,
  childrenCount, setChildrenCount,
  infants, setInfants,
  stopsFilter, setStopsFilter
}) {
  const statuses = ['SCHEDULED', 'DELAYED', 'CANCELLED', 'BOARDING', 'DEPARTED', 'ARRIVED'];

  return (
    <aside style={{
      width: 260,
      flexShrink: 0,
      position: 'sticky',
      top: 88,
      alignSelf: 'flex-start',
    }}>
      <div className="glass-card" style={{ borderRadius: 20, padding: 28 }}>
        <h2 style={{
          fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
          fontSize: 22, fontWeight: 700, color: '#1a1c1d', marginBottom: 24,
        }}>
          Filters
        </h2>

        {/* Route inputs */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>Route</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)',
              borderRadius: 10, padding: '8px 12px',
            }}>
              <Search size={14} color="#5e5e5e" />
              <input
                type="text"
                placeholder="From (e.g. COK)"
                value={source}
                onChange={e => setSource(e.target.value)}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 13, color: '#1a1c1d', fontFamily: 'Inter, sans-serif',
                }}
              />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)',
              borderRadius: 10, padding: '8px 12px',
            }}>
              <Search size={14} color="#5e5e5e" />
              <input
                type="text"
                placeholder="To (e.g. DEL)"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 13, color: '#1a1c1d', fontFamily: 'Inter, sans-serif',
                }}
              />
            </div>
          </div>
        </div>

        {/* Dates filter */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>Dates</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DatePicker
              label="Departure"
              placeholder="Add departure"
              value={depDate}
              onChange={setDepDate}
            />
            <DatePicker
              label="Arrival"
              placeholder="Add arrival"
              value={arrDate}
              onChange={setArrDate}
            />
          </div>
        </div>

        {/* Passengers Selector */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>Passengers</h3>
          <PassengerSelector
            adults={adults}
            setAdults={setAdults}
            childrenCount={childrenCount}
            setChildrenCount={setChildrenCount}
            infants={infants}
            setInfants={setInfants}
            variant="default"
          />
        </div>

        {/* Price Range */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>Price Range</h3>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5e5e5e', textTransform: 'uppercase', marginBottom: 6 }}>Min Price</label>
            <input
              type="range"
              min={absMin}
              max={maxFare}
              value={minFare}
              onChange={e => setMinFare(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#705d00' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#5e5e5e', marginTop: 4 }}>
              <span>{INR(absMin)}</span>
              <span style={{ fontWeight: 700, color: '#705d00' }}>{INR(minFare)}</span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5e5e5e', textTransform: 'uppercase', marginBottom: 6 }}>Max Price</label>
            <input
              type="range"
              min={minFare}
              max={absMax}
              value={maxFare}
              onChange={e => setMaxFare(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#705d00' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#5e5e5e', marginTop: 4 }}>
              <span>{INR(minFare)}</span>
              <span style={{ fontWeight: 700, color: '#705d00' }}>{INR(maxFare)}</span>
            </div>
          </div>
        </div>

        {/* Stops filter */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>Stops</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Non-stop', value: 0 },
              { label: '1 Stop', value: 1 },
              { label: '2+ Stops', value: 2 },
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
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>Status</h3>
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
              <span style={{ color: '#1a1c1d' }}>All Statuses</span>
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
    </aside>
  );
}

/* ── Main Component ───────────────────────────────────────── */
export default function UserFlightsList() {
  const dispatch = useDispatch();
  const { list: flights, loading, error } = useSelector(state => state.flights);

  const [searchParams, setSearchParams] = useSearchParams();
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
      return next;
    }, { replace: true });
  };

  const setDestination = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set('to', val);
      else next.delete('to');
      return next;
    }, { replace: true });
  };

  const setStatusFilter = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set('status', val);
      else next.delete('status');
      return next;
    }, { replace: true });
  };

  const setMinFare = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val !== null && val !== undefined) next.set('minFare', val.toString());
      else next.delete('minFare');
      return next;
    }, { replace: true });
  };

  const setMaxFare = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val !== null && val !== undefined) next.set('maxFare', val.toString());
      else next.delete('maxFare');
      return next;
    }, { replace: true });
  };

  const setDepDate = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set('depDate', val);
      else next.delete('depDate');
      return next;
    }, { replace: true });
  };

  const setArrDate = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set('arrDate', val);
      else next.delete('arrDate');
      return next;
    }, { replace: true });
  };

  const setAdults = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('adults', val.toString());
      return next;
    }, { replace: true });
  };

  const setChildrenCount = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('children', val.toString());
      return next;
    }, { replace: true });
  };

  const setInfants = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('infants', val.toString());
      return next;
    }, { replace: true });
  };

  const setStopsFilter = (val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val && val.length > 0) next.set('stops', val.join(','));
      else next.delete('stops');
      return next;
    }, { replace: true });
  };

  // Client-side pagination state (independent of backend page)
  const [clientPage, setClientPage] = useState(1);
  const CLIENT_PAGE_SIZE = 10;

  useEffect(() => {
    // Fetch ALL flights for client-side filtering and pagination
    dispatch(fetchAllFlights());
  }, [dispatch]);

  const handlePageChange = (page) => {
    setClientPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Initialize min/max bounds from data
  const { absMin, absMax } = useMemo(() => {
    if (!flights.length) return { absMin: 0, absMax: 100000 };
    const fares = flights.map(f => Number(f.base_fare) || 0);
    return {
      absMin: Math.min(...fares),
      absMax: Math.max(...fares)
    };
  }, [flights]);

  useEffect(() => {
    if (minFare === null && flights.length) setMinFare(absMin);
    if (maxFare === null && flights.length) setMaxFare(absMax);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absMin, absMax, minFare, maxFare, flights.length]);

  useEffect(() => {
    if (!searchParams.get('depDate')) {
      const todayStr = new Date().toISOString().split('T')[0];
      setDepDate(todayStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredFlights = useMemo(() => flights.filter(flight => {
    const matchSource = !source || flight.source_airport.toLowerCase().includes(source.toLowerCase());
    const matchDest = !destination || flight.destination_airport.toLowerCase().includes(destination.toLowerCase());
    const matchStatus = !statusFilter || flight.status === statusFilter;
    
    // Fare bounds
    const currentMinFare = minFare !== null ? minFare : absMin;
    const currentMaxFare = maxFare !== null ? maxFare : absMax;
    const matchFare = Number(flight.base_fare) >= currentMinFare && Number(flight.base_fare) <= currentMaxFare;

    // Compare dates in local calendar time (not UTC) to avoid timezone boundary leaks
    const toLocalDate = (iso) => {
      const d = new Date(iso);
      // YYYY-MM-DD in the browser's local timezone
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const matchDepDate = !depDate || toLocalDate(flight.departure_time) === depDate;
    const matchArrDate = !arrDate || toLocalDate(flight.arrival_time) === arrDate;

    // Available seats >= passengers
    const totalPassengers = adults + childrenCount + infants;
    const matchSeats = flight.available_seats >= totalPassengers;

    // Stops filter (database based stops list length)
    const stopsCount = (flight.stops || []).length;
    const stopCategory = stopsCount >= 2 ? 2 : stopsCount;
    const matchStops = stopsFilter.length === 0 || stopsFilter.includes(stopCategory);

    return matchSource && matchDest && matchStatus && matchFare && matchDepDate && matchArrDate && matchSeats && matchStops;
  }), [flights, source, destination, statusFilter, minFare, maxFare, absMin, absMax, depDate, arrDate, adults, childrenCount, infants, stopsFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setClientPage(1);
  }, [source, destination, statusFilter, minFare, maxFare, depDate, arrDate, adults, childrenCount, infants, stopsFilter]);

  // Client-side pagination derived from filteredFlights
  const filteredTotalPages = Math.max(1, Math.ceil(filteredFlights.length / CLIENT_PAGE_SIZE));
  const pagedFlights = useMemo(() => {
    const start = (clientPage - 1) * CLIENT_PAGE_SIZE;
    return filteredFlights.slice(start, start + CLIENT_PAGE_SIZE);
  }, [filteredFlights, clientPage]);

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
        @media (max-width: 900px) {
          .flights-layout { flex-direction: column !important; }
          .sidebar-aside { width: 100% !important; position: static !important; }
          .flight-row-card { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '88px 24px 48px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

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
            Search and track flights globally. Experience luxury flight details with AeroGlass.
          </p>
        </div> */}

        {/* Layout: Sidebar + List */}
        <div className="flights-layout" style={{ display: 'flex', gap: 28, alignItems: 'stretch', flex: 1 }}>

          {/* Sidebar */}
          <Sidebar
            source={source} setSource={setSource}
            destination={destination} setDestination={setDestination}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            minFare={minFare ?? absMin} setMinFare={setMinFare}
            absMin={absMin}
            maxFare={maxFare ?? absMax} setMaxFare={setMaxFare}
            absMax={absMax}
            depDate={depDate} setDepDate={setDepDate}
            arrDate={arrDate} setArrDate={setArrDate}
            adults={adults} setAdults={setAdults}
            childrenCount={childrenCount} setChildrenCount={setChildrenCount}
            infants={infants} setInfants={setInfants}
            stopsFilter={stopsFilter} setStopsFilter={setStopsFilter}
          />

          {/* Flight list */}
          <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

            {/* Compact search summary bar */}
            <div className="glass-card" style={{
              borderRadius: 16, padding: '14px 24px', marginBottom: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: '#1a1c1d' }}>
                <span>{source || 'Any Origin'}</span>
                <Plane size={16} color="#705d00" />
                <span>{destination || 'Any Destination'}</span>
              </div>
              <div style={{ fontSize: 13, color: '#5e5e5e' }}>
                {filteredFlights.length} flight{filteredFlights.length !== 1 ? 's' : ''} found
                {statusFilter && ` · ${statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()}`}
              </div>
            </div>

            {/* Quick Date Switcher */}
            <DateSwitcher
              activeDate={depDate}
              onDateChange={setDepDate}
            />

            {/* States */}
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0' }}>
                <div style={{
                  width: 44, height: 44, border: '3px solid rgba(112,93,0,0.15)',
                  borderTopColor: '#705d00', borderRadius: '50%', animation: 'spin 0.75s linear infinite',
                }} />
              </div>
            ) : error ? (
              <div className="glass-card" style={{ borderRadius: 16, padding: 24, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', textAlign: 'center' }}>
                {error}
              </div>
            ) : filteredFlights.length === 0 ? (
              <div className="glass-card" style={{ borderRadius: 20, padding: 64, textAlign: 'center' }}>
                <Plane size={44} color="#d0c6ab" style={{ margin: '0 auto 16px' }} />
                <p style={{ fontWeight: 700, fontSize: 16, color: '#5e5e5e' }}>No flights found matching your criteria.</p>
                <p style={{ fontSize: 13, color: '#9e9488', marginTop: 6 }}>Try adjusting your filters.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
                {pagedFlights.map(flight => (
                  <FlightCard key={flight.id} flight={flight} />
                ))}

                {/* Client-side pagination bar — always based on filteredFlights */}
                {filteredFlights.length > 0 && (
                  <div style={{ paddingTop: 24, marginTop: 'auto' }}>
                    <Pagination
                      currentPage={clientPage}
                      totalPages={filteredTotalPages}
                      totalCount={filteredFlights.length}
                      pageSize={CLIENT_PAGE_SIZE}
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
