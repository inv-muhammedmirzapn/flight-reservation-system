import { useNavigate } from 'react-router-dom';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-wrapper">

      {/* ── Navbar ── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <a className="landing-logo" href="/">
            <div className="nav-logo-icon">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            AeroGlass
          </a>
          <div className="landing-nav-links">
            <a className="landing-nav-link landing-nav-link-active" href="#">Explore</a>
            <a className="landing-nav-link" href="#">Bookings</a>
            <a className="landing-nav-link" href="#">Rewards</a>
            <a className="landing-nav-link" href="#">Support</a>
          </div>
          <div className="landing-nav-actions">
            <button className="landing-nav-signin" onClick={() => navigate('/login')}>Sign In</button>
            <button className="landing-nav-join" onClick={() => navigate('/register')}>Join Club</button>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <header className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <div className="landing-search-card">
            <h1 className="landing-hero-title">Where to next?</h1>
            <form className="landing-search-form" onSubmit={e => e.preventDefault()}>
              <div className="landing-search-row">
                <div className="landing-search-input-wrap">
                  <span className="material-symbols-outlined landing-search-icon">flight_takeoff</span>
                  <div className="landing-search-field">
                    <label>FROM</label>
                    <input placeholder="City or Airport" type="text" autoComplete="off" />
                  </div>
                </div>
                <div className="landing-search-input-wrap">
                  <span className="material-symbols-outlined landing-search-icon">flight_land</span>
                  <div className="landing-search-field">
                    <label>TO</label>
                    <input placeholder="Destination" type="text" autoComplete="off" />
                  </div>
                </div>
              </div>
              <div className="landing-search-row three-col">
                <div className="landing-search-input-wrap">
                  <span className="material-symbols-outlined landing-search-icon">calendar_today</span>
                  <div className="landing-search-field">
                    <label>DEPARTURE</label>
                    <input placeholder="Add dates" type="text" autoComplete="off" />
                  </div>
                </div>
                <div className="landing-search-input-wrap">
                  <span className="material-symbols-outlined landing-search-icon">event_repeat</span>
                  <div className="landing-search-field">
                    <label>RETURN</label>
                    <input placeholder="Add dates" type="text" autoComplete="off" />
                  </div>
                </div>
                <div className="landing-search-input-wrap">
                  <span className="material-symbols-outlined landing-search-icon">group</span>
                  <div className="landing-search-field">
                    <label>PASSENGERS</label>
                    <input placeholder="1 Adult" type="text" autoComplete="off" />
                  </div>
                </div>
              </div>
              <button className="landing-search-btn" type="button">
                <span className="material-symbols-outlined">search</span>
                Search Flights
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Popular Destinations ── */}
      <section className="landing-destinations">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">Popular Destinations</h2>
          <div className="landing-dest-grid">
            {[
              {
                city: 'London', sub: 'Direct flights', price: 'From $540',
                img: '/images/dest_london.png',
              },
              {
                city: 'Tokyo', sub: 'Non-stop available', price: 'From $890',
                img: '/images/dest_tokyo.png',
              },
              {
                city: 'Paris', sub: 'Premium economy', price: 'From $620',
                img: '/images/dest_paris.png',
              },
            ].map(({ city, sub, price, img }) => (
              <div className="landing-dest-card" key={city}>
                <img className="landing-dest-img" src={img} alt={city} />
                <div className="landing-dest-overlay" />
                <div className="landing-dest-info">
                  <div className="landing-dest-info-card">
                    <div>
                      <div className="landing-dest-city">{city}</div>
                      <div className="landing-dest-sub">{sub}</div>
                    </div>
                    <div className="landing-dest-price">{price}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">AeroGlass</div>
          <div className="landing-footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Cookie Settings</a>
            <a href="#">Contact</a>
          </div>
          <div className="landing-footer-copy">© 2025 AeroGlass Luxury Travel. All rights reserved.</div>
        </div>
      </footer>

    </div>
  );
}
