import { useState } from 'react';

export function Input({ id, label, type = 'text', error, onFocus, onBlur, ...props }) {
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? '#b91c1c'
    : (isFocused ? '#705d00' : 'rgba(0,0,0,0.1)');

  const boxShadow = error
    ? (isFocused ? '0 0 0 3px rgba(185,28,28,0.18)' : '0 0 0 3px rgba(185,28,28,0.1)')
    : (isFocused ? '0 0 0 3px rgba(112,93,0,0.1)' : 'none');

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
          background: isFocused ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.65)',
          border: `1.5px solid ${borderColor}`,
          borderRadius: 10,
          padding: '9px 13px',
          fontSize: 14,
          fontWeight: 500,
          color: '#1a1c1d',
          fontFamily: 'Inter, sans-serif',
          outline: 'none',
          boxShadow: boxShadow,
          transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
          ...props.style,
        }}
        onFocus={e => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={e => {
          setIsFocused(false);
          onBlur?.(e);
        }}
      />
      {error && (
        <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 2, paddingLeft: 2 }}>{error}</p>
      )}
    </div>
  );
}
