import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react';

export default function DateTimePicker({
  id,
  name,
  label,
  placeholder = 'Select Date & Time',
  value,
  onChange,
  disabled = false,
  style = {},
  ...props
}) {
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef(null);
  const uniqueId = useId();
  const selectId = id || uniqueId;
  const selectName = name || id;

  // Split value into date and time parts
  let dateVal = '';
  let timeVal = '12:00';

  if (value) {
    if (value.includes('T')) {
      const parts = value.split('T');
      dateVal = parts[0];
      timeVal = parts[1].substring(0, 5);
    } else if (value.includes(' ')) {
      const parts = value.split(' ');
      dateVal = parts[0];
      timeVal = parts[1].substring(0, 5);
    } else {
      dateVal = value;
    }
  }

  const initialCalendarDate = dateVal ? new Date(dateVal) : new Date();
  const [viewYear, setViewYear] = useState(initialCalendarDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialCalendarDate.getMonth());

  // Close calendar on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
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

  const handleOpen = () => {
    if (disabled) return;
    const activeDate = dateVal ? new Date(dateVal) : new Date();
    setViewYear(activeDate.getFullYear());
    setViewMonth(activeDate.getMonth());
    setIsOpen(true);
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

  const displayValue = value ? value.replace('T', ' ') : '';

  const triggerStyle = {
    width: '100%',
    background: disabled ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.65)',
    border: isFocused && !disabled ? '1.5px solid #705d00' : '1.5px solid rgba(0,0,0,0.1)',
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
    boxShadow: isFocused && !disabled ? '0 0 0 3px rgba(112,93,0,0.1)' : 'none',
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
          onClick={handleOpen}
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
            className="glass-card"
            style={{
              position: 'absolute',
              top: 'calc(100% + 5px)',
              left: 0,
              zIndex: 2000,
              width: 280,
              padding: 16,
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
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

            {/* Time selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <label htmlFor={`${selectId}-time-input`} style={{ fontSize: 12, fontWeight: 700, color: '#5e5e5e' }}>Time</label>
              <input
                id={`${selectId}-time-input`}
                type="time"
                value={timeVal}
                onChange={(e) => handleTimeChange(e.target.value)}
                style={{
                  border: '1.5px solid rgba(0,0,0,0.1)',
                  borderRadius: 8,
                  padding: '5px 8px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: '#fff',
                  outline: 'none',
                  color: '#1a1c1d',
                }}
              />
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
