export function Select({ id, label, options = [], ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#5e5e5e',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <select
          id={id}
          name={id}
          {...props}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.65)',
            border: '1.5px solid rgba(0,0,0,0.1)',
            borderRadius: 10,
            padding: '9px 36px 9px 13px',
            fontSize: 14,
            fontWeight: 500,
            color: '#1a1c1d',
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
            appearance: 'none',
            cursor: 'pointer',
            transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
            ...props.style,
          }}
          onFocus={e => {
            e.target.style.borderColor = '#705d00';
            e.target.style.background = 'rgba(255,255,255,0.92)';
            e.target.style.boxShadow = '0 0 0 3px rgba(112,93,0,0.1)';
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(0,0,0,0.1)';
            e.target.style.background = 'rgba(255,255,255,0.65)';
            e.target.style.boxShadow = 'none';
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: '#fff', color: '#1a1c1d' }}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Custom chevron */}
        <div style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', color: '#5e5e5e',
        }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
