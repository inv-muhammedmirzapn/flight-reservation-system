import { useState } from 'react';

export function PasswordInput({ id = 'password', label = 'Password', error, ...props }) {
  const [show, setShow] = useState(false);

  return (
    <div className="field-group">
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <div className="field-input-wrap">
        <input
          className="field-input"
          id={id}
          name={id}
          type={show ? 'text' : 'password'}
          {...props}
        />
        <button type="button" tabIndex={-1} onClick={() => setShow(s => !s)} className="eye-btn" aria-label={show ? 'Hide' : 'Show'}>
          {show ? (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-5.523 0-10-4.477-10-8 0-1.48.42-2.87 1.15-4.06M6.06 6.06A9.956 9.956 0 0112 4c5.523 0 10 3.477 10 8a9.97 9.97 0 01-4.06 5.94M3 3l18 18" />
            </svg>
          ) : (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      {error && <p style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  );
}
