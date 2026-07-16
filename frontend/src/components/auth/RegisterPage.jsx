import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RegisterForm } from './RegisterForm';

const getStats = (t) => [
  { value: '2M+',   label: t("auth.travelers")   },
  { value: '150+',  label: t("auth.airlines")    },
  { value: '500+',  label: t("auth.destinations")},
];

export function RegisterPage() {
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
              <div className="auth-brand-logo-wrap">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#1a1c1d" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <div className="auth-brand-name">{t("brand.name", { defaultValue: "AeroGlass" })}</div>
              <p className="auth-brand-tagline">
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
