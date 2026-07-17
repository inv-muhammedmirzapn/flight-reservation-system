import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginForm } from '@/components/auth/LoginForm';

const getFeatures = (t) => [
  { icon: 'flight_takeoff', label: t("auth.smartSearch") },
  { icon: 'radar',          label: t("auth.realTime")  },
  { icon: 'bolt',           label: t("auth.instantBooking")     },
  { icon: 'price_check',    label: t("auth.pricePredictions")   },
];

export default function LoginPage() {
  const { t } = useTranslation();
  const [successMsg] = useState(() => {
    const msg = sessionStorage.getItem('registerSuccess') || '';
    sessionStorage.removeItem('registerSuccess');
    return msg;
  });

  return (
    <div className="auth-page">
      <div className="auth-page-bg" />

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
              <div className="auth-brand-name">{t("brand.name", { defaultValue: "AeroGlass" })}</div>
              <p className="auth-brand-tagline">
                {t("auth.travelSmarter")}<br />{t("auth.bookConfidence")}
              </p>

              {/* Features */}
              <ul className="auth-brand-features">
                {getFeatures(t).map(f => (
                  <li key={f.label} className="auth-brand-feature">
                    <span className="auth-brand-feature-dot" />
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="auth-brand-footer">{t("footer.copyright", { year: 2025 })}</div>
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
              {t("auth.dontHaveAccount")}
              <Link className="auth-toggle-btn" to="/register">{t("auth.joinClub")}</Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
