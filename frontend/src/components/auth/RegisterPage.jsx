import { Link, useNavigate } from 'react-router-dom';
import { RegisterForm } from './RegisterForm';

const stats = [
  { value: '2M+',   label: 'Travelers'   },
  { value: '150+',  label: 'Airlines'    },
  { value: '500+',  label: 'Destinations'},
];

export function RegisterPage() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    sessionStorage.setItem('registerSuccess', 'Account created! You can now sign in.');
    navigate('/login');
  };

  return (
    <div className="auth-page">
      <div className="auth-page-bg" />

      <main className="auth-page-main">
        <div className="auth-split-card auth-split-card--wide">

          {/* ── Left: Brand panel ── */}
          <div className="auth-split-brand">
            <div>
              <div className="auth-brand-logo-wrap">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#1a1c1d" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <div className="auth-brand-name">AeroGlass</div>
              <p className="auth-brand-tagline">
                Join millions of travelers<br />who fly smarter.
              </p>

              {/* Stats */}
              <div className="auth-brand-stats">
                {stats.map(s => (
                  <div key={s.label} className="auth-brand-stat">
                    <span className="auth-brand-stat-value">{s.value}</span>
                    <span className="auth-brand-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="auth-brand-footer">© 2025 AeroGlass · All rights reserved</div>
          </div>

          {/* ── Right: Register form ── */}
          <div className="auth-split-form auth-split-form--register">
            <RegisterForm onSuccess={handleSuccess} />
            <div className="auth-toggle">
              Already have an account?
              <Link className="auth-toggle-btn" to="/login">Sign In</Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
