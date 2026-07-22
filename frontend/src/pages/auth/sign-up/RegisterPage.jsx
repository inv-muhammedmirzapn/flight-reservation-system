import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RegisterForm } from '@/components/auth/RegisterForm';

const getStats = (t) => [
  { value: '2M+',   label: t("auth.travelers")   },
  { value: '150+',  label: t("auth.airlines")    },
  { value: '500+',  label: t("auth.destinations")},
];

export default function RegisterPage() {
  const { t } = useTranslation();
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
              {/* Logo */}
              <img src="/updated%20logo.png" alt="Passenger Logo" style={{ height: "44px", objectFit: "contain", marginBottom: '1.25rem' }} />
              <p className="auth-brand-tagline" style={{ fontSize: '1.05rem', lineHeight: 1.6, fontWeight: 500 }}>
                {t("auth.joinMillions")}
              </p>

              {/* Stats */}
              <div className="auth-brand-stats">
                {getStats(t).map(s => (
                  <div key={s.label} className="auth-brand-stat">
                    <span className="auth-brand-stat-value">{s.value}</span>
                    <span className="auth-brand-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="auth-brand-footer">{t("footer.copyright", { year: 2025 })}</div>
          </div>

          {/* ── Right: Register form ── */}
          <div className="auth-split-form auth-split-form--register">
            <RegisterForm onSuccess={handleSuccess} />
            <div className="auth-toggle">
              {t("auth.alreadyHaveAccount")}
              <Link className="auth-toggle-btn" to="/login">{t("auth.signInInstead")}</Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
