import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import DatePicker from '@/components/ui/DatePicker';

const FALLBACK_AIRPORTS = {
  DEL: { city: 'New Delhi', code: 'DEL', name: 'Indira Gandhi International Airport', country: 'India' },
  HAM: { city: 'Hamburg', code: 'HAM', name: 'Fuhlsbuettel', country: 'Germany' }
};

export default function LandingPage() {
  const { t } = useTranslation();
  const { isAuthenticated, isAdmin } = useSelector((state) => state.auth);
  const todayStr = new Date().toISOString().split('T')[0];
  
  const [from, setFrom] = useState('DEL');
  const [to, setTo] = useState('HAM');
  const [fromSearch, setFromSearch] = useState('New Delhi');
  const [toSearch, setToSearch] = useState('Hamburg');
  const [isFromFocused, setIsFromFocused] = useState(false);
  const [isToFocused, setIsToFocused] = useState(false);
  const [airports, setAirports] = useState([]);

  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);

  const [depDate, setDepDate] = useState(todayStr);
  const [arrDate, setArrDate] = useState('');
  const [adults] = useState(1);
  const [childrenCount] = useState(0);
  const [infants] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate('/admin/flights', { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    // Dynamic import to keep initial bundle size small
    import('../../../resources/airports.json')
      .then((module) => {
        setAirports(module.default || []);
      })
      .catch((err) => console.error("Failed to load airports:", err));
  }, []);

  const findAirport = (codeOrQuery) => {
    if (!codeOrQuery) return null;
    const query = codeOrQuery.trim().toUpperCase();
    const fallback = FALLBACK_AIRPORTS[query];
    if (fallback) return fallback;
    return airports.find(
      (a) => a.code === query || a.city.toUpperCase() === query
    );
  };

  const getSuggestions = (query) => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return airports
      .filter((a) => 
        a.code.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q)
      )
      .slice(0, 5);
  };

  const handleSwap = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const tempVal = from;
    setFrom(to);
    setTo(tempVal);
    const tempSearch = fromSearch;
    setFromSearch(toSearch);
    setToSearch(tempSearch);
  };

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
          <h1 className="landing-hero-title">{t("landing.heroTitle")}</h1>
          
          <form onSubmit={handleSearch}>
            
            {/* Route Card (From / Swap / To) */}
            <div className="landing-route-card">
              
              {/* From Field */}
              <div 
                className="landing-route-field left" 
                onClick={() => {
                  setIsFromFocused(true);
                  setTimeout(() => fromInputRef.current?.focus(), 50);
                }}
              >
                <span className="landing-route-label">{t("landing.from")}</span>
                {isFromFocused ? (
                  <input
                    ref={fromInputRef}
                    type="text"
                    className="landing-route-input"
                    value={fromSearch}
                    onChange={(e) => setFromSearch(e.target.value)}
                    onBlur={() => {
                      setTimeout(() => setIsFromFocused(false), 200);
                    }}
                    autoComplete="off"
                  />
                ) : (
                  <>
                    <div className={`landing-route-value-large${!from ? ' placeholder' : ''}`}>
                      {from ? (findAirport(from)?.city || from) : t("landing.cityOrAirport")}
                    </div>
                    {from && findAirport(from) && (
                      <div className="landing-route-value-sub">
                        {findAirport(from).code}, {findAirport(from).name} {findAirport(from).country}
                      </div>
                    )}
                  </>
                )}

                {/* Suggestions dropdown */}
                {isFromFocused && getSuggestions(fromSearch).length > 0 && (
                  <div className="landing-autocomplete-dropdown">
                    {getSuggestions(fromSearch).map((airport) => (
                      <div
                        key={airport.code}
                        className="landing-autocomplete-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFrom(airport.code);
                          setFromSearch(airport.city);
                          setIsFromFocused(false);
                        }}
                      >
                        <span className="landing-autocomplete-item-city">{airport.city} ({airport.code})</span>
                        <span className="landing-autocomplete-item-name">{airport.name}, {airport.country}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Swap Button */}
              <button 
                type="button" 
                className="landing-swap-btn" 
                onClick={handleSwap}
                aria-label="Swap Locations"
              >
                <span className="material-symbols-outlined landing-swap-icon">swap_horiz</span>
              </button>

              {/* To Field */}
              <div 
                className="landing-route-field right"
                onClick={() => {
                  setIsToFocused(true);
                  setTimeout(() => toInputRef.current?.focus(), 50);
                }}
              >
                <span className="landing-route-label">{t("landing.to")}</span>
                {isToFocused ? (
                  <input
                    ref={toInputRef}
                    type="text"
                    className="landing-route-input"
                    value={toSearch}
                    onChange={(e) => setToSearch(e.target.value)}
                    onBlur={() => {
                      setTimeout(() => setIsToFocused(false), 200);
                    }}
                    autoComplete="off"
                  />
                ) : (
                  <>
                    <div className={`landing-route-value-large${!to ? ' placeholder' : ''}`}>
                      {to ? (findAirport(to)?.city || to) : t("landing.destination")}
                    </div>
                    {to && findAirport(to) && (
                      <div className="landing-route-value-sub">
                        {findAirport(to).code}, {findAirport(to).name} {findAirport(to).country}
                      </div>
                    )}
                  </>
                )}

                {/* Suggestions dropdown */}
                {isToFocused && getSuggestions(toSearch).length > 0 && (
                  <div className="landing-autocomplete-dropdown">
                    {getSuggestions(toSearch).map((airport) => (
                      <div
                        key={airport.code}
                        className="landing-autocomplete-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setTo(airport.code);
                          setToSearch(airport.city);
                          setIsToFocused(false);
                        }}
                      >
                        <span className="landing-autocomplete-item-city">{airport.city} ({airport.code})</span>
                        <span className="landing-autocomplete-item-name">{airport.name}, {airport.country}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Date Inputs Row */}
            <div className="landing-dates-bar">
              
              {/* Departure Date */}
              <div className="landing-date-field left">
                <div className="landing-date-field-content">
                  <span className="material-symbols-outlined landing-date-icon">flight_takeoff</span>
                  <div style={{ flex: 1 }}>
                    <DatePicker
                      placeholder={t("landing.departure", { defaultValue: "Departure" })}
                      value={depDate}
                      onChange={setDepDate}
                      variant="transparent"
                    />
                  </div>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', opacity: 0.5 }}>expand_more</span>
              </div>

              {/* Return Date */}
              <div className="landing-date-field">
                <div className="landing-date-field-content">
                  <span className="material-symbols-outlined landing-date-icon">flight_land</span>
                  <div style={{ flex: 1 }}>
                    <DatePicker
                      placeholder={t("landing.returnDate", { defaultValue: "Return" })}
                      value={arrDate}
                      onChange={setArrDate}
                      variant="transparent"
                    />
                  </div>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', opacity: 0.5 }}>expand_more</span>
              </div>

            </div>

            {/* Search Button */}
            <button className="landing-search-btn-redesigned" type="submit">
              {t("landing.searchFlights")}
            </button>

          </form>
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
