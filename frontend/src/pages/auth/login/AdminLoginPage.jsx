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
              {/* Logo */}
              <img src="/updated%20logo.png" alt="Passenger Logo" style={{ height: "44px", objectFit: "contain", marginBottom: '1.25rem' }} />
              {/* Workspace badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: '99px', padding: '3px 12px', marginBottom: '1rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffd700', display: 'inline-block' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', color: '#ffd700', textTransform: 'uppercase' }}>Admin Workspace</span>
              </div>
              <p className="auth-brand-tagline" style={{ color: '#a0a0b0', fontSize: '0.95rem' }}>
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
            <div className="auth-brand-footer" style={{ color: '#5e5e5e' }}>{t("footer.copyright", { year: 2026 }).replace("All rights reserved.", "Internal Operations")}</div>
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
