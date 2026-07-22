import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Shared floating glassmorphism navbar used on login & register pages
export function AuthNavbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <nav className="landing-nav">
      <div className="landing-nav-inner">
        <Link className="landing-logo" to="/" style={{ display: "flex", alignItems: "center" }}>
          <img src="/mainlogo.png" alt="Passenger Logo" style={{ height: "36px", objectFit: "contain" }} />
        </Link>
        <div className="landing-nav-links">
          <a className="landing-nav-link" href="/#explore">Explore</a>
          <a className="landing-nav-link" href="/#bookings">Bookings</a>
          <a className="landing-nav-link" href="/#rewards">Rewards</a>
          <a className="landing-nav-link" href="/#support">Support</a>
        </div>
        <div className="landing-nav-actions">
          <button className="landing-nav-signin" onClick={() => navigate('/login')}>Sign In</button>
          <button className="landing-nav-join" onClick={() => navigate('/register')}>Join Club</button>
        </div>
      </div>
    </nav>
  );
}
