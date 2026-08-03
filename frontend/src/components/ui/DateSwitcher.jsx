import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE_URL, getResponseData } from '@/services/apiClient';

/* ── helpers ──────────────────────────────────────────────── */
function addDays(base, n) {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function formatDayName(dateStr) {
  return new Date(dateStr + 'T00:00:00')
    .toLocaleDateString('en-IN', { weekday: 'short' })
    .toUpperCase();
}

function formatDayDate(dateStr) {
  return new Date(dateStr + 'T00:00:00')
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatFare(raw) {
  const n = parseFloat(raw);
  if (isNaN(n)) return '—';
  return '₹\u00a0' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const VISIBLE = 7;

/* ── Component ────────────────────────────────────────────── */
export default function DateSwitcher({ activeDate, onDateChange, source, destination, cabinClass }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const current = activeDate || todayStr;

  // Place active date at position 0 (left-most) on first render
  const [windowStart, setWindowStart] = useState(() => current);

  // fares map: dateStr → string (fare) | null (no flights) | undefined (not yet loaded)
  const [fares, setFares] = useState({});

  // Version counter — increment to invalidate all in-flight fetch callbacks
  const versionRef = useRef(0);

  const days = Array.from({ length: VISIBLE }, (_, i) => addDays(windowStart, i));

  /* ── Fetch min fares whenever the window or route changes ── */
  useEffect(() => {
    // Bump version so any previously in-flight fetches become stale
    const myVersion = ++versionRef.current;

    const visibleDays = Array.from(
      { length: VISIBLE },
      (_, i) => addDays(windowStart, i)
    );

    // Reset fares for the new window (show loading dots)
    setFares({});

    visibleDays.forEach(async (dateStr) => {
      try {
        const params = new URLSearchParams({
          date: dateStr,
          page_size: '100',
        });
        if (source) params.set('source', source);
        if (destination) params.set('destination', destination);

        const res = await fetch(`${API_BASE_URL}/flights/?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await getResponseData(res);

        let rawFare = null;
        if (data.results && data.results.length > 0) {
          const CLASS_MAP = { 'Economy': 'ECONOMY', 'Business': 'BUSINESS', 'First': 'FIRST' };
          const classKey = CLASS_MAP[cabinClass || 'Economy'] || 'ECONOMY';
          
          let minPrice = Infinity;
          data.results.forEach(flight => {
            const selectedFare = flight.fares?.[classKey];
            // If the specific fare exists, use it. Otherwise fallback to base_fare.
            const price = selectedFare ? parseFloat(selectedFare.price) : parseFloat(flight.base_fare);
            
            if (!isNaN(price) && price < minPrice) {
              minPrice = price;
            }
          });
          
          if (minPrice !== Infinity) {
            rawFare = minPrice;
          }
        }

        // Discard if a newer effect has already run
        if (versionRef.current !== myVersion) return;

        setFares(prev => ({ ...prev, [dateStr]: rawFare }));
      } catch {
        if (versionRef.current !== myVersion) return;
        setFares(prev => ({ ...prev, [dateStr]: null }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowStart, source, destination, cabinClass]);

  const shiftWindow = (n) => {
    setWindowStart(prev => addDays(prev, n));
  };

  // Re-center window when activeDate moves outside the visible strip
  useEffect(() => {
    if (!days.includes(current)) {
      setWindowStart(current); // put active date back at left
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      marginBottom: 20,
      width: '100%',
      background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(25px)',
      WebkitBackdropFilter: 'blur(25px)',
      border: '1px solid rgba(255,255,255,0.5)',
      borderRadius: 14,
      boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      overflow: 'hidden',
    }}>

      {/* ◀ Prev */}
      <button
        type="button"
        onClick={() => shiftWindow(-7)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, flexShrink: 0,
          background: 'transparent', border: 'none',
          borderRight: '1px solid rgba(0,0,0,0.06)',
          cursor: 'pointer', color: '#5e5e5e',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,215,0,0.12)'; e.currentTarget.style.color = '#705d00'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5e5e5e'; }}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Day pills */}
      {days.map((dateStr, idx) => {
        const isActive = dateStr === current;
        const fareVal = fares[dateStr];            // undefined = loading, null = no flights, string/number = fare
        const isLoading = fareVal === undefined;
        const hasFare = fareVal !== null && fareVal !== undefined;

        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => onDateChange(dateStr)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3,
              padding: '10px 4px',
              background: isActive ? 'rgba(255,215,0,0.1)' : 'transparent',
              border: 'none',
              borderLeft: idx > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
              borderBottom: isActive ? '3px solid #ffd700' : '3px solid transparent',
              cursor: 'pointer',
              transition: 'background 0.15s',
              fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
              minWidth: 0,
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,215,0,0.06)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
              color: isActive ? '#705d00' : '#9e9488',
            }}>
              {formatDayName(dateStr)}
            </span>

            <span style={{
              fontSize: 13,
              fontWeight: isActive ? 800 : 600,
              color: isActive ? '#1a1c1d' : '#5e5e5e',
              whiteSpace: 'nowrap',
            }}>
              {formatDayDate(dateStr)}
            </span>

            <span style={{
              fontSize: 11, fontWeight: 700,
              color: isLoading ? '#d4cfc6'
                : hasFare ? (isActive ? '#705d00' : '#3a8a3a')
                : '#d4cfc6',
              whiteSpace: 'nowrap',
              minHeight: 16,
            }}>
              {isLoading ? '···' : hasFare ? formatFare(fareVal) : '—'}
            </span>
          </button>
        );
      })}

      {/* ▶ Next */}
      <button
        type="button"
        onClick={() => shiftWindow(7)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, flexShrink: 0,
          background: 'transparent', border: 'none',
          borderLeft: '1px solid rgba(0,0,0,0.06)',
          cursor: 'pointer', color: '#5e5e5e',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,215,0,0.12)'; e.currentTarget.style.color = '#705d00'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5e5e5e'; }}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
