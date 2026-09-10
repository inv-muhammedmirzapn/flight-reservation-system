import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';

export function TimePicker({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  placeholder = 'HH:MM AM',
  ...props
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({});
  const [inputVal, setInputVal] = useState('');

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const popoverRef = useRef(null);
  const uniqueId = useId();
  const inputId = id || uniqueId;

  // Convert HH:MM (24h) to display HH:MM AM/PM
  const formatForDisplay = (val24) => {
    if (!val24) return '';
    let [h, m] = val24.split(':');
    if (!h || !m) return val24;
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    const hh = String(hour).padStart(2, '0');
    return `${hh}:${m} ${ampm}`;
  };

  // Parse various inputs into 24h format
  const parseTo24h = (displayVal) => {
    // Remove non-alphanumeric except colon
    let clean = displayVal.replace(/[^\d:ampAMP\s]/g, '').trim();
    
    // Auto-format raw numbers like "1044" -> "10:44"
    if (/^\d{3,4}$/.test(clean)) {
      if (clean.length === 3) clean = `0${clean[0]}:${clean.slice(1)}`;
      else clean = `${clean.slice(0, 2)}:${clean.slice(2)}`;
    }

    const match = clean.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)?$/i);
    if (!match) return null;
    
    let h = parseInt(match[1], 10);
    const m = match[2] || '00';
    let ampm = (match[3] || '').toUpperCase();
    
    // Guess AM/PM if not provided but hours are valid 12h
    if (!ampm) {
      if (h >= 12) {
        ampm = 'PM';
        if (h > 12) h -= 12; // Just normalize if they typed 14:00 without PM
      } else {
        ampm = 'AM';
      }
    }
    
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    
    // Ensure bounds
    h = Math.max(0, Math.min(23, h));
    const finalM = String(Math.max(0, Math.min(59, parseInt(m, 10)))).padStart(2, '0');
    
    return `${String(h).padStart(2, '0')}:${finalM}`;
  };

  useEffect(() => {
    if (value !== undefined && !isFocused) {
      setInputVal(formatForDisplay(value));
    }
  }, [value, isFocused]);

  const updatePopoverPosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const popoverHeight = 220; 
    const spaceBelow = window.innerHeight - rect.bottom;

    let top;
    // Prefer opening above (e.g. if we have enough space above, or if space below is too small)
    if (rect.top > popoverHeight || rect.top > spaceBelow) {
      top = rect.top - popoverHeight - 6;
    } else {
      top = rect.bottom + 6;
    }

    // Clamp top to viewport
    top = Math.max(10, Math.min(top, window.innerHeight - popoverHeight - 10));

    let left = rect.left;
    if (left + 220 > window.innerWidth) {
      left = window.innerWidth - 230;
    }

    setPopoverStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: '220px',
      zIndex: 99999,
    });
  };

  useLayoutEffect(() => {
    if (isOpen) updatePopoverPosition();
  }, [isOpen]);

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

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    let val = e.target.value;
    
    // Basic auto-colon insertion while typing if length is 2 and no colon
    if (val.length === 2 && !val.includes(':') && inputVal.length < val.length) {
      val += ':';
    }
    
    // Restrict length to 8 max (e.g. "12:00 AM")
    if (val.length > 8) {
      val = val.slice(0, 8);
    }
    
    setInputVal(val);
    if (!isOpen) setIsOpen(true);
    
    const parsed = parseTo24h(val);
    if (parsed) {
      onChange?.({ target: { id: inputId, value: parsed } });
    }
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    const parsed = parseTo24h(inputVal);
    if (parsed) {
      setInputVal(formatForDisplay(parsed));
      onChange?.({ target: { id: inputId, value: parsed } });
    } else {
      // Revert if invalid
      setInputVal(formatForDisplay(value || ''));
    }
  };

  const handleSelect = (type, val) => {
    let current = parseTo24h(inputVal) || value || '08:00';
    let [h, m] = current.split(':');
    let hour = parseInt(h, 10);
    const isPm = hour >= 12;
    
    if (type === 'hour') {
      let newH = parseInt(val, 10);
      if (isPm && newH < 12) newH += 12;
      if (!isPm && newH === 12) newH = 0;
      h = String(newH).padStart(2, '0');
    } else if (type === 'minute') {
      m = val.padStart(2, '0');
    } else if (type === 'ampm') {
      if (val === 'PM' && hour < 12) h = String(hour + 12).padStart(2, '0');
      if (val === 'AM' && hour >= 12) h = String(hour - 12).padStart(2, '0');
    }
    
    const newVal = `${h}:${m}`;
    setInputVal(formatForDisplay(newVal));
    onChange?.({ target: { id: inputId, value: newVal } });
  };

  const borderColor = error ? '#b91c1c' : (isFocused ? '#705d00' : 'rgba(0,0,0,0.1)');
  const boxShadow = error
    ? (isFocused ? '0 0 0 3px rgba(185,28,28,0.18)' : '0 0 0 3px rgba(185,28,28,0.1)')
    : (isFocused ? '0 0 0 3px rgba(112,93,0,0.1)' : 'none');

  const currentParsed = parseTo24h(inputVal) || value || '08:00';
  const [currH, currM] = currentParsed.split(':');
  const currHourInt = parseInt(currH, 10);
  const currAmPm = currHourInt >= 12 ? 'PM' : 'AM';
  const currHour12 = String(currHourInt % 12 || 12).padStart(2, '0');

  const hours = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  const renderList = (items, selected, type) => (
    <div className="flex-1 overflow-y-auto hidden-scrollbar" style={{ height: '180px', scrollBehavior: 'smooth' }}>
      <div className="flex flex-col gap-1 p-1">
        {items.map(item => (
          <div
            key={item}
            onClick={() => handleSelect(type, item)}
            className={`cursor-pointer text-center py-2 rounded-md text-sm transition-colors ${
              selected === item 
                ? 'bg-yellow-100 text-yellow-900 font-bold' 
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative' }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e' }}>
          {label}
        </label>
      )}
      
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          id={inputId}
          disabled={disabled}
          placeholder={placeholder}
          value={inputVal}
          onChange={handleInputChange}
          onClick={() => setIsOpen(true)}
          onFocus={() => { setIsFocused(true); setIsOpen(true); }}
          onBlur={handleInputBlur}
          className="w-full"
          style={{
            background: isFocused ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.65)',
            border: `1.5px solid ${borderColor}`,
            borderRadius: 10,
            padding: '9px 36px 9px 13px',
            fontSize: 14,
            fontWeight: 500,
            color: '#1a1c1d',
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
            boxShadow: boxShadow,
            transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
          }}
          {...props}
        />
        <Clock 
          size={16} 
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" 
        />
      </div>
      
      {error && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 2, paddingLeft: 2 }}>{error}</p>}

      {isOpen && !disabled && createPortal(
        <div 
          ref={popoverRef}
          className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
          style={popoverStyle}
        >
          <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Time</span>
          </div>
          <div className="flex bg-white" style={{ height: '180px' }}>
            {renderList(hours, currHour12, 'hour')}
            <div className="w-px bg-slate-100" />
            {renderList(minutes, currM, 'minute')}
            <div className="w-px bg-slate-100" />
            {renderList(['AM', 'PM'], currAmPm, 'ampm')}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
