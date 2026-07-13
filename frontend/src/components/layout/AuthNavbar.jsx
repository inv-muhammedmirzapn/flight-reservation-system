import { Link, useNavigate } from 'react-router-dom';

// Shared floating glassmorphism navbar used on login & register pages
export function AuthNavbar() {
  const navigate = useNavigate();
  return (
    <nav className="landing-nav">
      <div className="landing-nav-inner">
        <Link className="landing-logo" to="/">
          <div className="nav-logo-icon">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          AeroGlass
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
