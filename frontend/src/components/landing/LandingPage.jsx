export function LandingPage() {
  return (
    <div className="landing-wrapper">

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

    </div>
  );
}
