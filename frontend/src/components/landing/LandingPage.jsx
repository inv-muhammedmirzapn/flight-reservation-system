import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DatePicker from '../ui/DatePicker';
import PassengerSelector from '../ui/PassengerSelector';

export function LandingPage() {
  const { t } = useTranslation();
  const todayStr = new Date().toISOString().split('T')[0];
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [depDate, setDepDate] = useState(todayStr);
  const [arrDate, setArrDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [infants, setInfants] = useState(0);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from.trim()) params.set('from', from.trim());
    if (to.trim()) params.set('to', to.trim());
    if (depDate) params.set('depDate', depDate);
    if (arrDate) params.set('arrDate', arrDate);
    params.set('adults', adults);
    params.set('children', childrenCount);
    params.set('infants', infants);
    navigate(`/flights?${params.toString()}`);
  };

  return (
    <div className="landing-wrapper">

      {/* ── Hero Section ── */}
      <header className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <div className="landing-search-card">
            <h1 className="landing-hero-title">{t("landing.heroTitle")}</h1>
            <form className="landing-search-form" onSubmit={handleSearch}>
              <div className="landing-search-row">
                <div className="landing-search-input-wrap">
                  <span className="material-symbols-outlined landing-search-icon">flight_takeoff</span>
                  <div className="landing-search-field">
                    <label>{t("landing.from")}</label>
                    <input
                      placeholder={t("landing.cityOrAirport")}
                      type="text"
                      autoComplete="off"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </div>
                </div>
                <div className="landing-search-input-wrap">
                  <span className="material-symbols-outlined landing-search-icon">flight_land</span>
                  <div className="landing-search-field">
                    <label>{t("landing.to")}</label>
                    <input
                      placeholder={t("landing.destination")}
                      type="text"
                      autoComplete="off"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="landing-search-row three-col">
                <div className="landing-search-input-wrap">
                  <span className="material-symbols-outlined landing-search-icon">calendar_today</span>
                  <div className="landing-search-field">
                    <label>{t("landing.departure")}</label>
                    <DatePicker
                      placeholder={t("landing.addDates", { defaultValue: "Add dates" })}
                      value={depDate}
                      onChange={setDepDate}
                      variant="transparent"
                    />
                  </div>
                </div>
                <div className="landing-search-input-wrap">
                  <span className="material-symbols-outlined landing-search-icon">event_repeat</span>
                  <div className="landing-search-field">
                    <label>{t("landing.returnDate")}</label>
                    <DatePicker
                      placeholder={t("landing.addDates", { defaultValue: "Add dates" })}
                      value={arrDate}
                      onChange={setArrDate}
                      variant="transparent"
                    />
                  </div>
                </div>
                <div className="landing-search-input-wrap">
                  <span className="material-symbols-outlined landing-search-icon">group</span>
                  <div className="landing-search-field" style={{ width: '100%' }}>
                    <label>{t("landing.passengers")}</label>
                    <PassengerSelector
                      adults={adults}
                      setAdults={setAdults}
                      childrenCount={childrenCount}
                      setChildrenCount={setChildrenCount}
                      infants={infants}
                      setInfants={setInfants}
                      variant="transparent"
                    />
                  </div>
                </div>
              </div>
              <button className="landing-search-btn" type="submit">
                <span className="material-symbols-outlined">search</span>
                {t("landing.searchFlights")}
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Popular Destinations ── */}
      <section className="landing-destinations">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">{t("landing.popularDestinations")}</h2>
          <div className="landing-dest-grid">
            {[
              {
                city: t("landing.london"), sub: t("landing.directFlights"), price: t("landing.from540"),
                img: '/images/dest_london.png', key: 'london'
              },
              {
                city: t("landing.tokyo"), sub: t("landing.nonStopAvailable"), price: t("landing.from890"),
                img: '/images/dest_tokyo.png', key: 'tokyo'
              },
              {
                city: t("landing.paris"), sub: t("landing.premiumEconomy"), price: t("landing.from620"),
                img: '/images/dest_paris.png', key: 'paris'
              },
            ].map(({ city, sub, price, img, key }) => (
              <div className="landing-dest-card" key={key}>
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
