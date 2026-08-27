/**
 * ComboInput — free-text input + dropdown suggestions.
 * User can type any value OR pick from the suggestions list.
 * The dropdown uses position:fixed + dynamic placement so it escapes
 * any parent overflow:hidden or modal stacking context.
 *
 * Props:
 *   id, label, placeholder, value, onChange, options (string[] | {value,label}[]), error, disabled
 */
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export function ComboInput({ id, label, placeholder, value = '', onChange, options = [], error, disabled }) {
  const [open, setOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Keep inputVal in sync when parent changes value (e.g. edit form prefill)
  useEffect(() => { setInputVal(value ?? ''); }, [value]);

  // Recalculate dropdown position whenever it opens or window scrolls/resizes
  useLayoutEffect(() => {
    if (!open || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        !e.target.closest('[data-comboinput-dropdown]')
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const normalised = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  );

  const filtered = inputVal
    ? normalised.filter((o) => o.label.toLowerCase().includes(inputVal.toLowerCase()))
    : normalised;

  const handleInput = (e) => {
    const v = e.target.value;
    setInputVal(v);
    setOpen(true);
    onChange?.({ target: { id, value: v } });
  };

  const handleSelect = (val) => {
    setInputVal(val);
    setOpen(false);
    onChange?.({ target: { id, value: val } });
  };

  const borderColor = error
    ? '#b91c1c'
    : (isFocused ? '#705d00' : 'rgba(0,0,0,0.1)');

  const boxShadow = error
    ? (isFocused ? '0 0 0 3px rgba(185,28,28,0.18)' : '0 0 0 3px rgba(185,28,28,0.1)')
    : (isFocused ? '0 0 0 3px rgba(112,93,0,0.1)' : 'none');

  const dropdown = open && filtered.length > 0 ? createPortal(
    <ul
      data-comboinput-dropdown
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 99999,
        background: '#fff',
        border: '1.5px solid rgba(0,0,0,0.1)',
        borderRadius: 10,
        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
        margin: 0,
        padding: 4,
        listStyle: 'none',
        maxHeight: 200,
        overflowY: 'auto',
      }}
    >
      {filtered.map((opt) => (
        <li
          key={opt.value}
          onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value); }}
          style={{
            padding: '9px 12px',
            borderRadius: 7,
            fontSize: 13,
            fontWeight: String(opt.value) === String(inputVal) ? 700 : 500,
            color: String(opt.value) === String(inputVal) ? '#705d00' : '#1a1c1d',
            background: String(opt.value) === String(inputVal) ? 'rgba(255,215,0,0.12)' : 'transparent',
            cursor: 'pointer',
            transition: 'background 0.12s',
            fontFamily: 'Inter, sans-serif',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,215,0,0.2)'; }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = String(opt.value) === String(inputVal) ? 'rgba(255,215,0,0.12)' : 'transparent';
          }}
        >
          {opt.label}
        </li>
      ))}
    </ul>,
    document.body
  ) : null;

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative' }}>
      {label && (
        <label
          htmlFor={id}
          style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e' }}
        >
          {label}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={inputVal}
          onChange={handleInput}
          onFocus={() => {
            setOpen(true);
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
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
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
        {/* chevron icon */}
        <span
          onClick={() => !disabled && setOpen((o) => !o)}
          style={{
            position: 'absolute', right: 11, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
            transition: 'transform 0.2s', cursor: 'pointer', color: '#888', lineHeight: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      {dropdown}

      {error && (
        <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 2, paddingLeft: 2 }}>{error}</p>
      )}
    </div>
  );
}
