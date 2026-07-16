import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function DatePicker({ label, placeholder, value, onChange, variant, className = '' }) {
  const { t } = useTranslation();
  const MONTH_NAMES = t('datePicker.months', { returnObjects: true }) || [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const WEEKDAYS = t('datePicker.weekdays', { returnObjects: true }) || ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  
  // Parse initial date or default to today's date for calendar view state
  const initialDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0-indexed

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const isTransparent = variant === 'transparent';

  const updateDropdownPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    
    // Check if dropdown goes offscreen horizontally
    let left = rect.left;
    if (left + 280 > window.innerWidth) {
      left = Math.max(10, rect.right - 280);
    }
    
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 5,
      left: left,
      zIndex: 9999,
    });
  };

  // Close calendar on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recompute position on scroll / resize while open
  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen]);

  const handleOpen = () => {
    const activeDate = value ? new Date(value) : new Date();
    setViewYear(activeDate.getFullYear());
    setViewMonth(activeDate.getMonth());
    updateDropdownPosition();
    setIsOpen(true);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // Sunday = 0

  const days = [];
  // Empty paddings
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  // Days of month
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
    onChange(dateStr);
    setIsOpen(false);
  };

  // Helper to determine if a day is the selected day
  const isSelected = (day) => {
    if (!day || !value) return false;
    const d = new Date(value);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day;
  };

  return (
    <div ref={containerRef} className={`datepicker-container ${className}`} style={{ position: 'relative', width: '100%' }}>
      {label && !isTransparent && (
        <label style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 800,
          color: '#5e5e5e',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 8
        }}>
          {label}
        </label>
      )}
      
      <div ref={triggerRef} style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder={placeholder}
          value={value || ''}
          readOnly
          onClick={handleOpen}
          style={{
            width: '100%',
            padding: isTransparent ? '0 24px 0 0' : '12px 36px 12px 14px',
            background: isTransparent ? 'transparent' : 'rgba(255, 255, 255, 0.45)',
            border: isTransparent ? 'none' : '1px solid rgba(255, 255, 255, 0.6)',
            borderRadius: isTransparent ? 0 : 12,
            outline: 'none',
            fontSize: isTransparent ? '0.9375rem' : 14,
            fontWeight: 600,
            color: '#1a1c1d',
            cursor: 'pointer',
            backdropFilter: isTransparent ? 'none' : 'blur(8px)',
            WebkitBackdropFilter: isTransparent ? 'none' : 'blur(8px)',
            transition: 'all 0.2s',
            fontFamily: isTransparent ? 'Inter, sans-serif' : 'inherit',
          }}
          className="datepicker-input"
        />
        
        {value ? (
          <button
            type="button"
            aria-label="Clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            style={{
              position: 'absolute',
              right: isTransparent ? 0 : 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#9e9488',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 0,
            }}
          >
            <X size={16} />
          </button>
        ) : (
          <Calendar
            size={16}
            style={{
              position: 'absolute',
              right: isTransparent ? 0 : 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9e9488',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          className="glass-card"
          style={{
            ...dropdownStyle,
            width: 280,
            padding: 16,
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.9)',
            boxShadow: '0 8px 32px rgba(112, 93, 0, 0.08)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
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
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
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
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
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
                    color: active ? '#1a1c1d' : '#1a1c1d',
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
        </div>,
        document.body
      )}
    </div>
  );
}
