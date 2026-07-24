import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchFlights, clearFlightsList } from '@/store/flightSlice';
import { Plane, Search, ArrowRight } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';
import DateSwitcher from '@/components/ui/DateSwitcher';
import PassengerSelector from '@/components/ui/PassengerSelector';
import { Pagination } from '@/components/ui/Pagination';

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
            <div style={{ fontSize: 13, color: '#5e5e5e', marginTop: 2, fontWeight: 600 }}>
              {flight.destination_airport}
            </div>
          </div>
        </div>

        {/* Flight meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#1a1c1d', fontSize: 14 }}>{flight.flight_number}</span>
            <StatusBadge status={flight.status} />
            {flight.available_seats === 0 && (
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
          {t("flights.select", { defaultValue: 'Select' })} <ArrowRight size={14} />
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
  stopsFilter, setStopsFilter,
  onClearFilters
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
    <aside className="sidebar-aside" style={{
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
      }}>
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

        {/* Route inputs */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>{t("flights.route", { defaultValue: 'Route' })}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)',
              borderRadius: 10, padding: '8px 12px',
            }}>
              <Search size={14} color="#5e5e5e" />
              <input
                type="text"
                placeholder={t("flights.fromLabel", { defaultValue: 'From (e.g. COK)' })}
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
                placeholder={t("flights.toLabel", { defaultValue: 'To (e.g. DEL)' })}
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
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>{t("flights.dates", { defaultValue: 'Dates' })}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DatePicker
              label={t("flights.departure", { defaultValue: 'Departure' })}
              placeholder={t("flights.addDeparture", { defaultValue: 'Add departure' })}
              value={depDate}
              onChange={setDepDate}
            />
            <DatePicker
              label={t("flights.arrival", { defaultValue: 'Arrival' })}
              placeholder={t("flights.addArrival", { defaultValue: 'Add arrival' })}
              value={arrDate}
              onChange={setArrDate}
            />
          </div>
        </div>

        {/* Passengers Selector */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', marginBottom: 12 }}>{t("flights.passengers", { defaultValue: 'Passengers' })}</h3>
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
);
}

/* ── Main Component ───────────────────────────────────────── */
export default function UserFlightsList() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { list: flights, count, totalPages, loading, error } = useSelector(state => state.flights);

  // Sorting fallback to ensure flight entries are sorted chronologically by departure time
  const sortedFlights = useMemo(() => {
    if (!flights) return [];
    return [...flights].sort((a, b) => new Date(a.departure_time) - new Date(b.departure_time));
  }, [flights]);

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
    const todayStr = new Date().toISOString().split('T')[0];

    if (searchParams.toString() === '') {
      nextParams = new URLSearchParams({
        adults: '1',
        depDate: todayStr
      });
    } else if (!searchParams.get('depDate')) {
      nextParams = new URLSearchParams(searchParams);
      nextParams.set('depDate', todayStr);
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
        ordering: 'departure_time',
      }
    }));
  }, [dispatch, pageParam, statusFilter, source, destination, depDate, arrDate, minFare, maxFare, stopsFilter]);

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
    const todayStr = new Date().toISOString().split('T')[0];
    setSearchParams(new URLSearchParams({
      adults: '1',
      depDate: todayStr
    }), { replace: true });
  };

  // Static bounds for server-side pagination slider
  const absMin = 0;
  const absMax = 100000;



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
        @media (max-width: 900px) {
          .flights-layout { flex-direction: column !important; }
          .sidebar-aside { width: 100% !important; position: static !important; }
          .flight-row-card { flex-direction: column !important; align-items: flex-start !important; }
          .sidebar-scroll { max-height: none !important; overflow-y: visible !important; }
        }
      `}</style>

      <div style={{ width: '95%', maxWidth: 1800, margin: '0 auto', padding: '120px 24px 48px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

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
            onClearFilters={handleClearFilters}
          />

          {/* Flight list */}
          <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

            {/* Compact search summary bar */}
            <div className="glass-card" style={{
              borderRadius: 16, padding: '14px 24px', marginBottom: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: '#1a1c1d' }}>
                <span>{source || t("flights.anyOrigin", { defaultValue: 'Any Origin' })}</span>
                <Plane size={16} color="#705d00" />
                <span>{destination || t("flights.anyDestination", { defaultValue: 'Any Destination' })}</span>
              </div>
              <div style={{ fontSize: 13, color: '#5e5e5e' }}>
                {t(count === 1 ? "flights.flightsFound_one" : "flights.flightsFound_other", { count: count, defaultValue: `${count} flights found` })}
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
