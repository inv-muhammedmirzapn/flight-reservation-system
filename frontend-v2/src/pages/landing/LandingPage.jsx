import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import DatePickerModal, { formatDisplayDate } from "@/components/ui/DatePickerModal";

const FALLBACK_AIRPORTS = {
  DEL: { city: "New Delhi", code: "DEL", name: "Indira Gandhi International Airport", country: "India" },
  HAM: { city: "Hamburg", code: "HAM", name: "Fuhlsbuettel", country: "Germany" }
};

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Safe useSelector fallback if Redux isn't initialized/populated yet
  const auth = useSelector((state) => state?.auth) || { isAuthenticated: false, isAdmin: false };
  const { isAuthenticated, isAdmin } = auth;

  const todayStr = new Date().toISOString().split("T")[0];

  const [from, setFrom] = useState("DEL");
  const [to, setTo] = useState("HAM");
  const [fromSearch, setFromSearch] = useState("New Delhi");
  const [toSearch, setToSearch] = useState("Hamburg");
  const [isFromFocused, setIsFromFocused] = useState(false);
  const [isToFocused, setIsToFocused] = useState(false);
  const [airports, setAirports] = useState([]);

  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);

  const [depDate, setDepDate] = useState(todayStr);
  const [arrDate, setArrDate] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarTab, setCalendarTab] = useState("dep");

  const isAnyDropdownActive = isFromFocused || isToFocused;

  // Redirect admin if authenticated
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate("/admin/flights", { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  // Load airports
  useEffect(() => {
    import("../../../resources/airports.json")
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
    if (from.trim()) params.set("from", from.trim());
    if (to.trim()) params.set("to", to.trim());
    if (depDate) params.set("depDate", depDate);
    if (arrDate) params.set("arrDate", arrDate);
    params.set("adults", "1");
    params.set("children", "0");
    params.set("infants", "0");
    navigate(`/flights?${params.toString()}`);
  };

  const handleSelectDates = (selectedDep, selectedArr) => {
    setDepDate(selectedDep);
    setArrDate(selectedArr);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">

      {/* Hero Section */}
      <section className="relative min-h-[90vh] md:min-h-[90vh] flex flex-col justify-center items-center px-3 sm:px-4 overflow-hidden pt-12 sm:pt-16">

        {/* Background Image & Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
          style={{ backgroundImage: "url('/hero_sky.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/90" />

        {/* Content Box */}
        <div className="relative animate-fade-in z-10 w-full max-w-4xl text-center flex flex-col items-center">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 md:mb-8 drop-shadow-sm">
            {t("landing.heroTitle", "Where to next?")}
          </h1>

          <form onSubmit={handleSearch} className="w-full flex flex-col items-center">

            {/* Route Selection Card (From / Swap / To) */}
            <div className={`w-full max-w-2xl glass-card shadow hover:shadow rounded-2xl sm:rounded-3xl grid grid-cols-5 items-center relative p-1 sm:p-2 md:p-0 transition-all ${isAnyDropdownActive ? "z-50" : "z-20"}`}>

              {/* From Box */}
              <div
                className={`col-span-2 w-full px-3 sm:px-6 py-2.5 sm:py-3.5 md:py-4 text-left cursor-pointer transition-colors hover:bg-slate-500/5 rounded-xl sm:rounded-2xl md:rounded-l-3xl relative ${isFromFocused ? "z-50" : "z-10"}`}
                onClick={() => {
                  setIsFromFocused(true);
                  setTimeout(() => fromInputRef.current?.focus(), 50);
                }}
              >
                <span className="text-[9px] sm:text-[10px] font-bold tracking-wider text-slate-400 select-none">
                  {t("landing.from", "From")}
                </span>

                {isFromFocused ? (
                  <input
                    ref={fromInputRef}
                    type="text"
                    className="airport-input-field font-bold mt-0.5 sm:mt-1"
                    value={fromSearch}
                    onChange={(e) => setFromSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setIsFromFocused(false), 200)}
                    autoComplete="off"
                  />
                ) : (
                  <div className="mt-0.5 sm:mt-1">
                    <div className="text-sm sm:text-base md:text-xl font-bold text-slate-800 truncate">
                      {from ? (findAirport(from)?.city || from) : t("landing.cityOrAirport", "City or Airport")}
                    </div>
                    {from && findAirport(from) && (
                      <div className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-slate-500 truncate mt-0.5 sm:mt-1">
                        {findAirport(from).code}, {findAirport(from).name}
                      </div>
                    )}
                  </div>
                )}

                {/* Autocomplete Dropdown */}
                {isFromFocused && getSuggestions(fromSearch).length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden z-[100] max-h-60 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
                    {getSuggestions(fromSearch).map((airport) => (
                      <div
                        key={airport.code}
                        className="px-3 py-2 sm:px-4 sm:py-3 hover:bg-primary-container/40 text-left transition-colors cursor-pointer"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFrom(airport.code);
                          setFromSearch(airport.city);
                          setIsFromFocused(false);
                        }}
                      >
                        <div className="font-extrabold text-slate-800 text-[11px] sm:text-xs">{airport.city} ({airport.code})</div>
                        <div className="text-[9px] sm:text-[10px] text-slate-500 font-semibold mt-0.5 sm:mt-1">{airport.name}, {airport.country}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Swap Divider / Button */}
              <div>
                <button
                  type="button"
                  onClick={handleSwap}
                  className="btn-ghost absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full bg-white border border-slate-200 shadow-md"
                  aria-label="Swap Locations"
                >
                  <span className="material-symbols-outlined select-none text-base sm:text-lg md:text-xl font-bold">swap_horiz</span>
                </button>
              </div>

              {/* To Box */}
              <div
                className={`col-span-2 w-full px-3 sm:px-6 py-2.5 sm:py-3.5 md:py-4 text-right cursor-pointer transition-colors hover:bg-slate-500/5 rounded-xl sm:rounded-2xl md:rounded-r-3xl relative ${isToFocused ? "z-50" : "z-10"}`}
                onClick={() => {
                  setIsToFocused(true);
                  setTimeout(() => toInputRef.current?.focus(), 50);
                }}
              >
                <span className="text-[9px] sm:text-[10px] font-extrabold tracking-wider text-slate-400 select-none">
                  {t("landing.to", "To")}
                </span>

                {isToFocused ? (
                  <input
                    ref={toInputRef}
                    type="text"
                    className="airport-input-field text-right font-bold mt-0.5 sm:mt-1"
                    value={toSearch}
                    onChange={(e) => setToSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setIsToFocused(false), 200)}
                    autoComplete="off"
                  />
                ) : (
                  <div className="mt-0.5 sm:mt-1">
                    <div className="text-sm sm:text-base md:text-xl font-bold text-slate-800 truncate">
                      {to ? (findAirport(to)?.city || to) : t("landing.destination", "Destination")}
                    </div>
                    {to && findAirport(to) && (
                      <div className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-slate-500 truncate mt-0.5 sm:mt-1">
                        {to.code || to}, {findAirport(to).name}
                      </div>
                    )}
                  </div>
                )}

                {/* Autocomplete Dropdown */}
                {isToFocused && getSuggestions(toSearch).length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden z-[100] max-h-60 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
                    {getSuggestions(toSearch).map((airport) => (
                      <div
                        key={airport.code}
                        className="px-3 py-2 sm:px-4 sm:py-3 hover:bg-primary-container/40 text-left transition-colors cursor-pointer"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setTo(airport.code);
                          setToSearch(airport.city);
                          setIsToFocused(false);
                        }}
                      >
                        <div className="font-extrabold text-slate-800 text-[11px] sm:text-xs">{airport.city} ({airport.code})</div>
                        <div className="text-[9px] sm:text-[10px] text-slate-500 font-semibold mt-0.5 sm:mt-1">{airport.name}, {airport.country}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Date Display Bar */}
            <div
              className="w-[90%] md:w-full md:max-w-lg glass-card shadow hover:shadow rounded-b-2xl sm:rounded-b-3xl flex items-center divide-x divide-slate-100 overflow-hidden relative z-10"
            >
              {/* Departure Display */}
              <div
                onClick={() => {
                  setCalendarTab("dep");
                  setIsCalendarOpen(true);
                }}
                className="flex-1 px-3 sm:px-5 py-2.5 sm:py-3.5 flex items-center justify-between hover:bg-slate-500/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 sm:gap-4 md:gap-5">
                  <span className="material-symbols-outlined text-slate-400 select-none text-base sm:text-lg md:text-xl">flight_takeoff</span>
                  <div className="text-left">
                    <div className="text-[9px] sm:text-[10px] font-bold tracking-wider text-slate-400 select-none">Departure</div>
                    <div className="text-[10px] sm:text-sm font-bold text-slate-800 mt-1.5 select-none">
                      {depDate ? formatDisplayDate(depDate) : "Select Date"}
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-400 select-none text-xs sm:text-base md:text-lg">expand_more</span>
              </div>

              {/* Return Display */}
              <div
                onClick={() => {
                  setCalendarTab("arr");
                  setIsCalendarOpen(true);
                }}
                className="flex-1 px-3 sm:px-5 py-2.5 sm:py-3.5 flex items-center justify-between hover:bg-slate-500/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 sm:gap-4 md:gap-5">
                  <span className="material-symbols-outlined text-slate-400 select-none text-base sm:text-lg md:text-xl">flight_land</span>
                  <div className="text-left">
                    <div className="text-[9px] sm:text-[10px] font-bold tracking-wider text-slate-400 select-none">Return</div>
                    <div className="text-[10px] sm:text-sm font-bold text-slate-800 mt-1.5 select-none">
                      {arrDate ? formatDisplayDate(arrDate) : "One way"}
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-400 select-none text-xs sm:text-base md:text-lg">expand_more</span>
              </div>
            </div>

            {/* Search Button */}
            <button
              type="submit"
              className="btn-primary mt-4 sm:mt-6 md:mt-8 font-bold text-sm sm:text-base md:text-lg px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-lg shadow-yellow-500/35 hover:shadow-xl hover:shadow-yellow-500/25"
            >
              {t("landing.searchFlights", "Search Flights")}
            </button>

          </form>
        </div>

      </section>

      {/* Date Picker Modal */}
      <DatePickerModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        initialDepDate={depDate}
        initialArrDate={arrDate}
        onSelectDates={handleSelectDates}
        initialTab={calendarTab}
      />

      {/* Popular Destinations Section */}
      <section className="py-8 sm:py-12 md:py-16 bg-white/40 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">

          <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-800 mb-4 sm:mb-6 md:mb-8 tracking-tight">
            {t("landing.popularDestinations", "Popular Destinations")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {[
              {
                city: t("landing.london", "London"), sub: t("landing.directFlights", "Direct flights"), price: t("landing.from540", "From $540"),
                img: '/images/dest_london.png', key: 'london'
              },
              {
                city: t("landing.tokyo", "Tokyo"), sub: t("landing.nonStopAvailable", "Non-stop available"), price: t("landing.from890", "From $890"),
                img: '/images/dest_tokyo.png', key: 'tokyo'
              },
              {
                city: t("landing.paris", "Paris"), sub: t("landing.premiumEconomy", "Premium economy"), price: t("landing.from620", "From $620"),
                img: '/images/dest_paris.png', key: 'paris'
              },
            ].map(({ city, sub, price, img, key }) => (
              <div
                key={key}
                className="group relative h-64 sm:h-80 md:h-96 rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg shadow-slate-900/5 hover:shadow-2xl hover:shadow-slate-900/10 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
              >
                <img
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  src={img}
                  alt={city}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent transition-opacity duration-300 group-hover:opacity-90" />

                {/* Info Card inside Overlay */}
                <div className="absolute inset-x-3 sm:inset-x-4 md:inset-x-6 bottom-3 sm:bottom-4 md:bottom-6">
                  <div className="bg-white/80 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 md:p-4 flex items-center justify-between border border-white/20 shadow-lg">
                    <div>
                      <div className="font-extrabold text-slate-800 text-xs sm:text-sm md:text-base">{city}</div>
                      <div className="text-[9px] sm:text-[10px] md:text-xs text-slate-500 font-semibold mt-0.5">{sub}</div>
                    </div>
                    <div className="text-[11px] sm:text-xs md:text-sm font-extrabold text-primary-dark bg-primary-container/80 px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-yellow-500/10">
                      {price}
                    </div>
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
