import { Plane } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer style={{
      borderTop: '1px solid #e2e2e4',
      background: '#f3f3f5',
      marginTop: 'auto',
    }}>
      <div style={{
        width: '95%',
        maxWidth: 1800,
        margin: '0 auto',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}>
        {/* Brand */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
          fontSize: '1.1rem',
          fontWeight: 700,
          color: '#1a1c1d',
          letterSpacing: '-0.02em',
        }}>
          <Plane size={18} color="#ffd700" style={{ transform: 'rotate(-45deg)' }} />
          {t("brand.name", { defaultValue: "AeroGlass" })}
        </div>

        {/* Links */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {[
            { key: 'privacyPolicy', label: 'Privacy Policy' },
            { key: 'termsOfService', label: 'Terms of Service' },
            { key: 'cookieSettings', label: 'Cookie Settings' },
            { key: 'contact', label: 'Contact' }
          ].map(({ key, label }) => (
            <a
              key={key}
              href="#"
              style={{
                fontSize: '0.8rem',
                color: '#5e5e5e',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.target.style.color = '#705d00'}
              onMouseLeave={e => e.target.style.color = '#5e5e5e'}
            >
              {t(`footer.${key}`, { defaultValue: label })}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <div style={{ fontSize: '0.8125rem', color: '#705d00', fontWeight: 500 }}>
          {t("footer.copyright", { year: new Date().getFullYear(), defaultValue: `© ${new Date().getFullYear()} AeroGlass Luxury Travel. All rights reserved.` })}
        </div>
      </div>
    </footer>
  );
}
