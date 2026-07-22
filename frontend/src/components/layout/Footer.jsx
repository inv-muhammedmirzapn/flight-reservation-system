import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer style={{
      borderTop: '1px solid rgba(255,215,0,0.2)',
      background: 'linear-gradient(to right, #1a1c1d, #25272a)',
      marginTop: 'auto',
    }}>
      <div style={{
        width: '95%',
        maxWidth: 1800,
        margin: '0 auto',
        padding: '0.85rem 1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}>
        {/* Brand logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src="/updated%20logo.png"
            alt="Passenger"
            style={{ height: '28px', objectFit: 'contain', filter: 'brightness(1.05)' }}
          />
        </div>

        {/* Links */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
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
                color: '#a0a0b0',
                textDecoration: 'none',
                transition: 'color 0.2s',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => e.target.style.color = '#ffd700'}
              onMouseLeave={e => e.target.style.color = '#a0a0b0'}
            >
              {t(`footer.${key}`, { defaultValue: label })}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <div style={{ fontSize: '0.78rem', color: '#6b6b80', fontWeight: 400 }}>
          {t("footer.copyright", { year: new Date().getFullYear(), defaultValue: `© ${new Date().getFullYear()} Passenger. All rights reserved.` })}
        </div>
      </div>
    </footer>
  );
}
