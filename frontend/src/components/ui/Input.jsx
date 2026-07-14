export function Input({ id, label, type = 'text', error, ...props }) {
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
      <input
        id={id}
        name={id}
        type={type}
        {...props}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.65)',
          border: '1.5px solid rgba(0,0,0,0.1)',
          borderRadius: 10,
          padding: '9px 13px',
          fontSize: 14,
          fontWeight: 500,
          color: '#1a1c1d',
          fontFamily: 'Inter, sans-serif',
          outline: 'none',
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
      />
      {error && (
        <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 2, paddingLeft: 2 }}>{error}</p>
      )}
    </div>
  );
}
