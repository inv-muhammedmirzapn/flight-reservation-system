import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthNavbar } from '../layout/AuthNavbar';
import { LoginForm } from './LoginForm';

const features = [
  { icon: 'flight_takeoff', label: 'Smart flight search' },
  { icon: 'radar',          label: 'Real-time tracking'  },
  { icon: 'bolt',           label: 'Instant booking'     },
  { icon: 'price_check',    label: 'Price predictions'   },
];

export function LoginPage() {
  const [successMsg] = useState(() => {
    const msg = sessionStorage.getItem('registerSuccess') || '';
    sessionStorage.removeItem('registerSuccess');
    return msg;
  });

  return (
    <div className="auth-page">
      <div className="auth-page-bg" />
      <AuthNavbar />

      <main className="auth-page-main">
        <div className="auth-split-card">

          {/* ── Left: Brand panel ── */}
          <div className="auth-split-brand">
            <div>
              {/* Logo */}
              <div className="auth-brand-logo-wrap">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#1a1c1d" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <div className="auth-brand-name">AeroGlass</div>
              <p className="auth-brand-tagline">
                Travel smarter.<br />Book with confidence.
              </p>

              {/* Features */}
              <ul className="auth-brand-features">
                {features.map(f => (
                  <li key={f.label} className="auth-brand-feature">
                    <span className="auth-brand-feature-dot" />
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="auth-brand-footer">© 2025 AeroGlass · All rights reserved</div>
          </div>

          {/* ── Right: Form panel ── */}
          <div className="auth-split-form">
            {successMsg && (
              <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
                <span>✅</span> {successMsg}
              </div>
            )}
            <LoginForm />
            <div className="auth-toggle">
              Don't have an account?
              <Link className="auth-toggle-btn" to="/register">Join Club</Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
