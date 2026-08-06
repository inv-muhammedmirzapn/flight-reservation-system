import React, { useState, useRef, useEffect, useId, useLayoutEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar, Clock } from 'lucide-react';

/* ─────────────────────────────────────────────
   TimeInput: custom HH : MM keyboard input
───────────────────────────────────────────── */
function TimeInput({ timeVal, onTimeChange, selectId }) {
  const [hRaw, setHRaw] = useState(() => timeVal.split(':')[0] || '00');
  const [mRaw, setMRaw] = useState(() => timeVal.split(':')[1] || '00');
  const [hFocused, setHFocused] = useState(false);
  const [mFocused, setMFocused] = useState(false);
  const minRef = useRef(null);

  // Sync inbound value changes (e.g. preset click)
  useEffect(() => {
    const [h, m] = timeVal.split(':');
    setHRaw(h || '00');
    setMRaw(m || '00');
  }, [timeVal]);

  const commit = (h, m) => {
    const hc = String(Math.min(23, Math.max(0, parseInt(h, 10) || 0))).padStart(2, '0');
    const mc = String(Math.min(59, Math.max(0, parseInt(m, 10) || 0))).padStart(2, '0');
    onTimeChange(`${hc}:${mc}`);
    return { hc, mc };
  };

  const segStyle = (focused) => ({
    width: 36,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 800,
    fontFamily: 'Inter, monospace',
    background: focused ? 'rgba(112,93,0,0.06)' : '#f5f5f3',
    border: focused ? '1.5px solid #705d00' : '1.5px solid rgba(0,0,0,0.12)',
    borderRadius: 7,
    padding: '5px 4px',
    outline: 'none',
    color: '#1a1c1d',
    cursor: 'text',
    boxShadow: focused ? '0 0 0 3px rgba(112,93,0,0.1)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
    letterSpacing: 1,
  });

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      onClick={e => e.stopPropagation()}
    >
      {/* Hours */}
      <input
        id={`${selectId}-h`}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={hFocused ? hRaw : hRaw.padStart(2, '0')}
        style={segStyle(hFocused)}
        onFocus={e => { setHFocused(true); e.target.select(); }}
        onBlur={() => {
          setHFocused(false);
          const { hc } = commit(hRaw || '00', mRaw || '00');
          setHRaw(hc);
        }}
        onChange={e => {
          const val = e.target.value.replace(/\D/g, '').slice(0, 2);
          setHRaw(val);
        }}
        onKeyDown={e => {
          const h = parseInt(hRaw, 10) || 0;
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = String((h + 1) % 24).padStart(2, '0');
            setHRaw(next);
            commit(next, mRaw);
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = String((h - 1 + 24) % 24).padStart(2, '0');
            setHRaw(next);
            commit(next, mRaw);
          }
        }}
      />

      <span style={{ fontSize: 15, fontWeight: 900, color: '#705d00', lineHeight: 1 }}>:</span>

      {/* Minutes */}
      <input
        ref={minRef}
        id={`${selectId}-m`}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={mFocused ? mRaw : (mRaw || '00').padStart(2, '0')}
        style={segStyle(mFocused)}
        onFocus={e => { setMFocused(true); e.target.select(); }}
        onBlur={() => {
          setMFocused(false);
          const { mc } = commit(hRaw || '00', mRaw || '00');
          setMRaw(mc);
        }}
        onChange={e => {
          const val = e.target.value.replace(/\D/g, '').slice(0, 2);
          setMRaw(val);
        }}
        onKeyDown={e => {
          const m = parseInt(mRaw, 10) || 0;
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = String((m + 5) % 60).padStart(2, '0');
            setMRaw(next);
            commit(hRaw, next);
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = String((m - 5 + 60) % 60).padStart(2, '0');
            setMRaw(next);
            commit(hRaw, next);
          }
        }}
      />
      <span style={{ fontSize: 10, fontWeight: 700, color: '#9e9488', marginLeft: 2, letterSpacing: '0.04em' }}>0–23h</span>
    </div>
  );
}

export default function DateTimePicker({
  id,
  name,
  label,
  placeholder = 'Select Date & Time',
  value,
  onChange,
  disabled = false,
  error,
  style = {},
  ...props
}) {
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const TIME_PRESETS = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];

  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({});

  const containerRef = useRef(null);
  const popoverRef = useRef(null);
  const uniqueId = useId();
  const selectId = id || uniqueId;
  const selectName = name || id;

  // Split value into date and time parts
  let dateVal = '';
  let timeVal = '12:00';

  if (value && typeof value === 'string') {
    if (value.includes('T')) {
      const parts = value.split('T');
      dateVal = parts[0];
      timeVal = parts[1].substring(0, 5) || '12:00';
    } else if (value.includes(' ')) {
      const parts = value.split(' ');
      dateVal = parts[0];
      timeVal = parts[1].substring(0, 5) || '12:00';
    } else {
      dateVal = value;
    }
  }

  const initialCalendarDate = dateVal ? new Date(dateVal) : new Date();
  const [viewYear, setViewYear] = useState(initialCalendarDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialCalendarDate.getMonth());

  // Update view month/year if value changes externally
  useEffect(() => {
    if (dateVal) {
      const parsed = new Date(dateVal);
      if (!isNaN(parsed.getTime())) {
        setViewYear(parsed.getFullYear());
        setViewMonth(parsed.getMonth());
      }
    }
  }, [dateVal]);

  // Compute fixed position for the popover so it never clips off-screen or off-modal
  const updatePopoverPosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const popoverHeight = 370; // approx popover height
    const spaceBelow = window.innerHeight - rect.bottom;

    let top;
    // Prefer opening downwards unless space below is constrained and space above is larger
    if (spaceBelow < popoverHeight && rect.top > spaceBelow) {
      top = rect.top - popoverHeight - 6;
    } else {
      top = rect.bottom + 6;
    }

    // Always clamp top to prevent overflowing above top of viewport
    top = Math.max(10, Math.min(top, window.innerHeight - popoverHeight - 10));

    let left = rect.left;
    if (left + 290 > window.innerWidth) {
      left = Math.max(10, window.innerWidth - 300);
    }

    setPopoverStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: '290px',
      zIndex: 99999,
    });
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePopoverPosition();
    }
  }, [isOpen]);

  // Handle window scroll/resize to update fixed position
  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => updatePopoverPosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  // Close calendar on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
    } else {
      const activeDate = dateVal ? new Date(dateVal) : new Date();
      setViewYear(activeDate.getFullYear());
      setViewMonth(activeDate.getMonth());
      setIsOpen(true);
    }
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day) => {
    if (!day) return;
    const formattedMonth = String(viewMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;
    if (onChange) {
      onChange({
        target: {
          id: selectId,
          name: selectName,
          value: `${dateStr}T${timeVal}`
        }
      });
    }
  };

  const handleTimeChange = (newTime) => {
    const formattedTime = newTime || '12:00';
    const finalDate = dateVal || new Date().toISOString().substring(0, 10);
    if (onChange) {
      onChange({
        target: {
          id: selectId,
          name: selectName,
          value: `${finalDate}T${formattedTime}`
        }
      });
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (onChange) {
      onChange({
        target: {
          id: selectId,
          name: selectName,
          value: ''
        }
      });
    }
    setIsOpen(false);
  };

  const isSelected = (day) => {
    if (!day || !dateVal) return false;
    const parts = dateVal.split('-');
    if (parts.length !== 3) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const date = parseInt(parts[2], 10);
    return year === viewYear && month === viewMonth && date === day;
  };

  const displayValue = value && typeof value === 'string' ? value.replace('T', ' ') : '';

  const triggerStyle = {
    width: '100%',
    background: disabled ? 'rgba(0,0,0,0.03)' : '#ffffff',
    border: error 
      ? '1.5px solid #b91c1c' 
      : (isFocused && !disabled ? '1.5px solid #705d00' : '1.5px solid rgba(0,0,0,0.15)'),
    borderRadius: 10,
    padding: '9px 13px',
    fontSize: 14,
    fontWeight: 500,
    color: disabled ? '#a09888' : '#1a1c1d',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: error 
      ? (isFocused ? '0 0 0 3px rgba(185,28,28,0.1)' : 'none')
      : (isFocused && !disabled ? '0 0 0 3px rgba(112,93,0,0.1)' : 'none'),
    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
    ...style,
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative', width: '100%' }}>
      {label && (
        <label
          htmlFor={selectId}
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#5e5e5e',
            userSelect: 'none',
          }}
        >
          {label}
        </label>
      )}
      
      <div style={{ position: 'relative', width: '100%' }}>
        <button
          id={selectId}
          data-testid="datetime-trigger"
          type="button"
          disabled={disabled}
          onClick={handleToggle}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={triggerStyle}
          {...props}
        >
          <span>{displayValue || placeholder}</span>
          
          {value && !disabled ? (
            <span
              role="button"
              aria-label="Clear"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  handleClear(e);
                }
              }}
              tabIndex={0}
              style={{
                background: 'none',
                border: 'none',
                color: '#9e9488',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0,
                marginLeft: 8,
                flexShrink: 0,
                outline: 'none',
              }}
            >
              <X size={14} />
            </span>
          ) : (
            <Calendar
              size={14}
              style={{
                color: '#9e9488',
                marginLeft: 8,
                flexShrink: 0,
              }}
            />
          )}
        </button>

        {isOpen && (
          <div
            ref={popoverRef}
            className="glass-card"
            style={{
              padding: 16,
              borderRadius: 16,
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.12)',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.18)',
              ...popoverStyle,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1a1c1d',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronLeft size={16} />
              </button>
              
              <span style={{ fontSize: 14, fontWeight: 800, color: '#1a1c1d' }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              
              <button
                type="button"
                onClick={handleNextMonth}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1a1c1d',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekdays */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', marginBottom: 8 }}>
              {WEEKDAYS.map(w => (
                <span key={w} style={{ fontSize: 11, fontWeight: 700, color: '#9e9488' }}>
                  {w}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div role="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {days.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} />;
                }
                const active = isSelected(day);
                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    style={{
                      background: active ? '#ffd700' : 'none',
                      border: 'none',
                      borderRadius: 8,
                      height: 30,
                      fontSize: 12,
                      fontWeight: active ? 800 : 600,
                      color: '#1a1c1d',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'none';
                      }
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Time selector section */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={13} style={{ color: '#9e9488' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e' }}>Time</span>
                </div>
                <TimeInput timeVal={timeVal} onTimeChange={handleTimeChange} selectId={selectId} />
              </div>
            </div>

            {/* Done button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: '#ffd700',
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: '#1a1c1d',
                cursor: 'pointer',
                width: '100%',
                marginTop: 12,
                textAlign: 'center',
                boxShadow: '0 2px 6px rgba(255,215,0,0.2)',
                transition: 'transform 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
