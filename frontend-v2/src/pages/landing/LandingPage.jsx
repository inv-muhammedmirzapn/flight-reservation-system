import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import DatePickerModal, { formatDisplayDate } from "@/components/ui/DatePickerModal";
import { flightsAPI } from "@/services/flight-service/flightService";
import { fetchAirports } from "@/store/airportsSlice";
import { resolveAirport, AIRPORT_MAP, getAirportInfo } from "@/utils/airportHelpers";

const FALLBACK_AIRPORTS = {
  DEL: { city: "New Delhi", code: "DEL", name: "Indira Gandhi International Airport", country: "India" },
  HAM: { city: "Hamburg", code: "HAM", name: "Fuhlsbuettel", country: "Germany" },
  CNN: { city: "Kannur", code: "CNN", name: "Kannur International Airport", country: "India" },
  COK: { city: "Kochi", code: "COK", name: "Cochin International Airport", country: "India" },
  CCJ: { city: "Kozhikode", code: "CCJ", name: "Calicut International Airport", country: "India" },
  TRV: { city: "Thiruvananthapuram", code: "TRV", name: "Trivandrum International Airport", country: "India" },
  BOM: { city: "Mumbai", code: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", country: "India" },
};

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Redux airports from database
  const reduxAirports = useSelector((state) => state.airports?.items) || [];
  const airportsLoaded = useSelector((state) => state.airports?.loaded);

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

  // Dispatch fetchAirports if not loaded yet
  useEffect(() => {
    if (!airportsLoaded) {
      dispatch(fetchAirports());
    }
  }, [airportsLoaded, dispatch]);

  // Load airports: prioritize Redux DB airports, then merge with static airports
  useEffect(() => {
    import("../../../resources/airports.json")
      .then((module) => {
        const staticList = module.default || [];
        const dbCodes = new Set(reduxAirports.map((a) => a.code));
        const filteredStatic = staticList.filter((s) => s.code && !dbCodes.has(s.code.toUpperCase()));
        setAirports([...reduxAirports, ...filteredStatic]);
      })
      .catch((err) => {
        console.error("Failed to load static airports:", err);
        setAirports(reduxAirports);
      });
  }, [reduxAirports]);

  // Automatically fetch nearest airport from user's geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const airportData = await flightsAPI.getNearestAirport(latitude, longitude);

          if (airportData && airportData.iata_code) {
            setFrom(airportData.iata_code);
            const cityName = airportData.city || airportData.airport_name || airportData.iata_code;
            setFromSearch(cityName);
          }
        } catch (err) {
          console.error("Failed to fetch nearest airport:", err);
        }
      },
      () => {
        // Silently ignore if geolocation is denied or unavailable
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // Redirect admin if authenticated
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate("/admin/flights", { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const findAirport = (codeOrQuery) => {
    if (!codeOrQuery) return null;
    const query = String(codeOrQuery).trim().toUpperCase();
    if (AIRPORT_MAP[query]) return AIRPORT_MAP[query];
    if (FALLBACK_AIRPORTS[query]) return FALLBACK_AIRPORTS[query];
    return airports.find(
      (a) => (a.code || "").toUpperCase() === query || (a.city && a.city.toUpperCase() === query)
    ) || getAirportInfo(query);
  };

  const getSuggestions = (query) => {
    if (!query || query.trim().length < 1) return [];
    const q = query.trim().toLowerCase();

    const matches = airports.filter((a) => {
      const code = (a.code || "").toLowerCase();
      const city = (a.city || "").toLowerCase();
      const name = (a.name || a.airport_name || "").toLowerCase();
      const country = (a.country || a.country_name || "").toLowerCase();
      return code.includes(q) || city.includes(q) || name.includes(q) || country.includes(q);
    });

    return matches.sort((a, b) => {
      const aCode = (a.code || "").toLowerCase();
      const bCode = (b.code || "").toLowerCase();
      const aCity = (a.city || "").toLowerCase();
      const bCity = (b.city || "").toLowerCase();
      if (aCode === q) return -1;
      if (bCode === q) return 1;
      if (aCity === q) return -1;
      if (bCity === q) return 1;
      if (aCode.startsWith(q) && !bCode.startsWith(q)) return -1;
      if (!aCode.startsWith(q) && bCode.startsWith(q)) return 1;
      if (aCity.startsWith(q) && !bCity.startsWith(q)) return -1;
      if (!aCity.startsWith(q) && bCity.startsWith(q)) return 1;
      return 0;
    }).slice(0, 8);
  };

  const handleFromBlur = () => {
    setTimeout(() => {
      setIsFromFocused(false);
      if (fromSearch.trim()) {
        const resolved = resolveAirport(fromSearch, airports);
        if (resolved) {
          setFrom(resolved.code);
          setFromSearch(resolved.city || resolved.code);
          return;
        }
      }
      const current = findAirport(from);
      setFromSearch(current?.city || from);
    }, 200);
  };

  const handleToBlur = () => {
    setTimeout(() => {
      setIsToFocused(false);
      if (toSearch.trim()) {
        const resolved = resolveAirport(toSearch, airports);
        if (resolved) {
          setTo(resolved.code);
          setToSearch(resolved.city || resolved.code);
          return;
        }
      }
      const current = findAirport(to);
      setToSearch(current?.city || to);
    }, 200);
  };

  const handleFromKeyDown = (e) => {
    if (e.key === "Enter") {
      const suggestions = getSuggestions(fromSearch);
      if (suggestions.length > 0) {
        e.preventDefault();
        setFrom(suggestions[0].code);
        setFromSearch(suggestions[0].city || suggestions[0].code);
        setIsFromFocused(false);
      }
    } else if (e.key === "Escape") {
      setIsFromFocused(false);
    }
  };

  const handleToKeyDown = (e) => {
    if (e.key === "Enter") {
      const suggestions = getSuggestions(toSearch);
      if (suggestions.length > 0) {
        e.preventDefault();
        setTo(suggestions[0].code);
        setToSearch(suggestions[0].city || suggestions[0].code);
        setIsToFocused(false);
      }
    } else if (e.key === "Escape") {
      setIsToFocused(false);
    }
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
    let finalFrom = from;
    let finalTo = to;

    if (fromSearch.trim()) {
      const resolved = resolveAirport(fromSearch, airports);
      if (resolved) {
        finalFrom = resolved.code;
        setFrom(resolved.code);
      }
    }
    if (toSearch.trim()) {
      const resolved = resolveAirport(toSearch, airports);
      if (resolved) {
        finalTo = resolved.code;
        setTo(resolved.code);
      }
    }

    const params = new URLSearchParams();
    if (finalFrom.trim()) params.set("from", finalFrom.trim());
    if (finalTo.trim()) params.set("to", finalTo.trim());
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
      <section className="relative min-h-screen min-h-[100dvh] flex flex-col justify-center items-center px-3 sm:px-4 overflow-hidden pt-16 sm:pt-20 pb-12 sm:pb-16">

        {/* Background Image & Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
          style={{ backgroundImage: "url('/hero_sky.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent via-[65%] to-white/90" />

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
                  setTimeout(() => {
                    fromInputRef.current?.focus();
                    fromInputRef.current?.select();
                  }, 50);
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
                    onFocus={(e) => e.target.select()}
                    onBlur={handleFromBlur}
                    onKeyDown={handleFromKeyDown}
                    placeholder={t("landing.cityOrAirport", "City or Airport")}
                    autoComplete="off"
                  />
                ) : (
                  <div className="mt-0.5 sm:mt-1">
                    <div className="text-sm sm:text-base md:text-xl font-bold text-slate-800 truncate">
                      {from ? (findAirport(from)?.city || from) : t("landing.cityOrAirport", "City or Airport")}
                    </div>
                    {from && findAirport(from) && (
                      <div className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-slate-500 truncate mt-0.5 sm:mt-1">
                        {findAirport(from).code || from}, {findAirport(from).name}
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
                          setFromSearch(airport.city || airport.code);
                          setIsFromFocused(false);
                        }}
                      >
                        <div className="font-extrabold text-slate-800 text-[11px] sm:text-xs">{airport.city} ({airport.code})</div>
                        <div className="text-[9px] sm:text-[10px] text-slate-500 font-semibold mt-0.5 sm:mt-1">{airport.name || airport.airport_name}, {airport.country || airport.country_name}</div>
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
                  setTimeout(() => {
                    toInputRef.current?.focus();
                    toInputRef.current?.select();
                  }, 50);
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
                    onFocus={(e) => e.target.select()}
                    onBlur={handleToBlur}
                    onKeyDown={handleToKeyDown}
                    placeholder={t("landing.destination", "Destination")}
                    autoComplete="off"
                  />
                ) : (
                  <div className="mt-0.5 sm:mt-1">
                    <div className="text-sm sm:text-base md:text-xl font-bold text-slate-800 truncate">
                      {to ? (findAirport(to)?.city || to) : t("landing.destination", "Destination")}
                    </div>
                    {to && findAirport(to) && (
                      <div className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-slate-500 truncate mt-0.5 sm:mt-1">
                        {findAirport(to).code || to}, {findAirport(to).name}
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
                          setToSearch(airport.city || airport.code);
                          setIsToFocused(false);
                        }}
                      >
                        <div className="font-extrabold text-slate-800 text-[11px] sm:text-xs">{airport.city} ({airport.code})</div>
                        <div className="text-[9px] sm:text-[10px] text-slate-500 font-semibold mt-0.5 sm:mt-1">{airport.name || airport.airport_name}, {airport.country || airport.country_name}</div>
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
        source={from}
        destination={to}
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
