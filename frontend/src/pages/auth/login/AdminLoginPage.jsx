import { AdminLoginForm } from '@/components/auth/AdminLoginForm';
import { useTranslation } from 'react-i18next';

const getFeatures = (t) => [
  { icon: 'admin_panel_settings', label: t("admin.auth.features.systemAdmin", { defaultValue: 'System Administration' }) },
  { icon: 'security',             label: t("admin.auth.features.secureAccess", { defaultValue: 'Secure Access' }) },
  { icon: 'insights',             label: t("admin.auth.features.flightMonitoring", { defaultValue: 'Flight Monitoring' }) },
  { icon: 'manage_accounts',      label: t("admin.auth.features.staffControls", { defaultValue: 'Staff Controls' }) },
];

export default function AdminLoginPage() {
  const { t } = useTranslation();
  return (
    <div className="auth-page">
      <div className="auth-page-bg" style={{ background: '#f5f5f7' }} />

      <main className="auth-page-main">
        <div className="auth-split-card" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
          {/* ── Left: Brand panel ── */}
          <div className="auth-split-brand" style={{ background: '#1a1c1d', color: '#ffffff' }}>
            <div>
              <div className="auth-brand-logo-wrap" style={{ background: 'rgba(255,215,0,0.2)', border: '1px solid rgba(255,215,0,0.4)' }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#ffd700" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <div className="auth-brand-name">{t("brand.name", { defaultValue: "AeroGlass" })} Workspace</div>
              <p className="auth-brand-tagline" style={{ color: '#d0c6ab' }}>
                Secure Admin Portal.<br />Authorized personnel only.
              </p>

              <ul className="auth-brand-features">
                {getFeatures(t).map(f => (
                  <li key={f.label} className="auth-brand-feature" style={{ color: '#f3f3f5' }}>
                    <span className="auth-brand-feature-dot" style={{ background: '#ffd700' }} />
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="auth-brand-footer" style={{ color: '#5e5e5e' }}>{t("footer.copyright", { year: 2025 }).replace("All rights reserved.", "Internal Operations")}</div>
          </div>

          {/* ── Right: Form panel ── */}
          <div className="auth-split-form">
            <AdminLoginForm />
          </div>
        </div>
      </main>
    </div>
  );
}
