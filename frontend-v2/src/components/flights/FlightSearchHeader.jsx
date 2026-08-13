import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import DatePickerModal from "@/components/ui/DatePickerModal";

const FALLBACK_AIRPORTS = {
  DEL: { city: "New Delhi", code: "DEL", name: "Indira Gandhi International Airport", country: "India" },
  HAM: { city: "Hamburg", code: "HAM", name: "Fuhlsbuettel", country: "Germany" },
  JFK: { city: "New York", code: "JFK", name: "John F. Kennedy International Airport", country: "USA" },
  LHR: { city: "London", code: "LHR", name: "Heathrow Airport", country: "UK" },
  HND: { city: "Tokyo", code: "HND", name: "Haneda Airport", country: "Japan" }
};

export default function FlightSearchHeader({ onSearchChange }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL params or fallback
  const initialFrom = searchParams.get("from") || "DEL";
  const initialTo = searchParams.get("to") || "HAM";
  const initialDep = searchParams.get("depDate") || new Date().toISOString().split("T")[0];
  const initialArr = searchParams.get("arrDate") || "";
  const initialCabin = searchParams.get("cabinClass") || "Economy";

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");

  const [isFromFocused, setIsFromFocused] = useState(false);
  const [isToFocused, setIsToFocused] = useState(false);

  const [depDate, setDepDate] = useState(initialDep);
  const [arrDate, setArrDate] = useState(initialArr);
  const [cabinClass, setCabinClass] = useState(initialCabin);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarTab, setCalendarTab] = useState("dep");

  const [isCabinOpen, setIsCabinOpen] = useState(false);
  const [airports, setAirports] = useState([]);

  // Separate refs for mobile and desktop DOM elements to prevent ref overwriting
  const fromInputMobileRef = useRef(null);
  const fromInputDesktopRef = useRef(null);
  const toInputMobileRef = useRef(null);
  const toInputDesktopRef = useRef(null);

  const cabinDropdownMobileRef = useRef(null);
  const cabinDropdownDesktopRef = useRef(null);

  // Load airports
  useEffect(() => {
    import("../../../resources/airports.json")
      .then((module) => {
        setAirports(module.default || []);
      })
      .catch((err) => console.error("Failed to load airports:", err));
  }, []);

  // Update URL params whenever search inputs change
  const updateUrlAndNotify = (newFrom, newTo, newDep, newArr, newCabin) => {
    const params = new URLSearchParams(searchParams);
    if (newFrom) params.set("from", newFrom);
    if (newTo) params.set("to", newTo);
    if (newDep) params.set("depDate", newDep);
    if (newArr) params.set("arrDate", newArr); else params.delete("arrDate");
    if (newCabin) params.set("cabinClass", newCabin);

    setSearchParams(params, { replace: true });

    if (onSearchChange) {
      onSearchChange({
        from: newFrom,
        to: newTo,
        depDate: newDep,
        arrDate: newArr,
        cabinClass: newCabin
      });
    }
  };

  // Close cabin dropdown on click outside (checks both mobile and desktop refs)
  useEffect(() => {
    const handleClickOutside = (e) => {
      const isInsideMobile = cabinDropdownMobileRef.current && cabinDropdownMobileRef.current.contains(e.target);
      const isInsideDesktop = cabinDropdownDesktopRef.current && cabinDropdownDesktopRef.current.contains(e.target);
      if (!isInsideMobile && !isInsideDesktop) {
        setIsCabinOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Synchronize state with URL searchParams
  useEffect(() => {
    const urlFrom = searchParams.get("from");
    const urlTo = searchParams.get("to");
    const urlDep = searchParams.get("depDate");
    const urlArr = searchParams.get("arrDate") || "";
    const urlCabin = searchParams.get("cabinClass");

    if (urlFrom) setFrom(prev => urlFrom !== prev ? urlFrom : prev);
    if (urlTo) setTo(prev => urlTo !== prev ? urlTo : prev);
    if (urlDep) setDepDate(prev => urlDep !== prev ? urlDep : prev);
    setArrDate(prev => urlArr !== prev ? urlArr : prev);
    if (urlCabin) setCabinClass(prev => urlCabin !== prev ? urlCabin : prev);
  }, [searchParams]);

  const findAirport = (codeOrQuery) => {
    if (!codeOrQuery) return null;
    const query = codeOrQuery.trim().toUpperCase();
    if (FALLBACK_AIRPORTS[query]) return FALLBACK_AIRPORTS[query];
    return airports.find(
      (a) => a.code === query || a.city.toUpperCase() === query
    ) || null;
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
      .slice(0, 6);
  };

  const handleSwap = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const tempFrom = from;
    const tempTo = to;
    setFrom(tempTo);
    setTo(tempFrom);
    setFromSearch(findAirport(tempTo)?.city || tempTo);
    setToSearch(findAirport(tempFrom)?.city || tempFrom);
    updateUrlAndNotify(tempTo, tempFrom, depDate, arrDate, cabinClass);
  };

  const handleSelectDates = (selectedDep, selectedArr) => {
    setDepDate(selectedDep);
    setArrDate(selectedArr);
    updateUrlAndNotify(from, to, selectedDep, selectedArr, cabinClass);
  };

  const handleSelectCabin = (selectedClass) => {
    setCabinClass(selectedClass);
    setIsCabinOpen(false);
    updateUrlAndNotify(from, to, depDate, arrDate, selectedClass);
  };

  const formatHeaderDate = (dateStr) => {
    if (!dateStr) return { main: "-", sub: "" };
    try {
      const parts = String(dateStr).trim().split("-");
      let d;
      if (parts.length === 3) {
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        d = new Date(dateStr);
      }
      if (isNaN(d.getTime())) return { main: "-", sub: "" };

      const day = d.getDate();
      const month = d.toLocaleString("en-US", { month: "short" });
      const weekday = d.toLocaleString("en-US", { weekday: "long" });

      return {
        main: `${day} ${month}`,
        sub: weekday
      };
    } catch (_err) {
      return { main: "-", sub: "" };
    }
  };

  const fromAirport = findAirport(from);
  const toAirport = findAirport(to);
  const depFormatted = formatHeaderDate(depDate);
  const arrFormatted = formatHeaderDate(arrDate);

  const cabinOptions = [
    { label: "Economy", icon: "chair" },
    { label: "Business", icon: "airline_seat_recline_extra" },
    { label: "First Class", icon: "workspace_premium" }
  ];

  const currentCabinObj = cabinOptions.find(
    (c) => c.label.toLowerCase() === (cabinClass || "").toLowerCase()
  ) || cabinOptions[0];

  const isAnyDropdownActive = isFromFocused || isToFocused || isCabinOpen;

  return (
    <div className={`w-full mx-auto relative ${isAnyDropdownActive ? "z-50" : "z-20"}`}>

      {/* ── MOBILE / SMALL SCREEN LAYOUT (< lg) ────────────────────────────── */}
      <div className="flex lg:hidden flex-col gap-2.5 sm:gap-3 w-full">

        {/* RECTANGLE 1: FROM & TO STACKED */}
        <div className={`w-full bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm divide-y divide-slate-100 relative ${isFromFocused || isToFocused ? "z-50" : "z-20"}`}>

          {/* FROM FIELD */}
          <div
            className={`p-2.5 sm:p-3.5 md:p-4 relative cursor-pointer hover:bg-slate-50/80 transition-colors rounded-t-2xl ${isFromFocused ? "z-50" : "z-10"}`}
            onClick={() => {
              setIsFromFocused(true);
              setFromSearch(fromAirport?.city || from);
              setTimeout(() => fromInputMobileRef.current?.focus(), 50);
            }}
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 select-none block mb-0.5">
              From
            </span>
            {isFromFocused ? (
              <div>
                <input
                  ref={fromInputMobileRef}
                  type="text"
                  className="airport-input-field text-xs sm:text-sm md:text-base font-bold w-full"
                  value={fromSearch}
                  onChange={(e) => setFromSearch(e.target.value)}
                  onBlur={() => setTimeout(() => setIsFromFocused(false), 200)}
                  placeholder="Search city/airport"
                  autoComplete="off"
                />
              </div>
            ) : (
              <div>
                <div className="text-xs sm:text-sm md:text-base font-bold text-slate-900 truncate">
                  {fromAirport ? fromAirport.city : from}
                </div>
                <div className="text-[9px] sm:text-[10px] md:text-xs text-slate-500 truncate mt-0.5">
                  {fromAirport ? `${fromAirport.code}, ${fromAirport.name} ${fromAirport.country || ''}` : from}
                </div>
              </div>
            )}

            {/* FROM Autocomplete Dropdown */}
            {isFromFocused && getSuggestions(fromSearch).length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden z-[100] max-h-56 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
                {getSuggestions(fromSearch).map((airport) => (
                  <div
                    key={airport.code}
                    className="px-3 py-2 sm:px-3.5 sm:py-2.5 hover:bg-amber-50 text-left transition-colors cursor-pointer"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setFrom(airport.code);
                      setFromSearch(airport.city);
                      setIsFromFocused(false);
                      updateUrlAndNotify(airport.code, to, depDate, arrDate, cabinClass);
                    }}
                  >
                    <div className="font-bold text-slate-900 text-[11px] sm:text-xs">{airport.city} ({airport.code})</div>
                    <div className="text-[9px] sm:text-[10px] text-slate-500 truncate">{airport.name}, {airport.country}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SWAP BUTTON OVERLAY ON MOBILE */}
          <div className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 z-20">
            <button
              type="button"
              onClick={handleSwap}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 hover:bg-slate-950 text-amber-400 border border-slate-800 shadow-md flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer"
              title="Swap Origin & Destination"
            >
              <span className="material-symbols-outlined text-sm sm:text-base font-bold select-none rotate-90">
                swap_vert
              </span>
            </button>
          </div>

          {/* TO FIELD */}
          <div
            className={`p-2.5 sm:p-3.5 md:p-4 relative cursor-pointer hover:bg-slate-50/80 transition-colors rounded-b-2xl ${isToFocused ? "z-50" : "z-10"}`}
            onClick={() => {
              setIsToFocused(true);
              setToSearch(toAirport?.city || to);
              setTimeout(() => toInputMobileRef.current?.focus(), 50);
            }}
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 select-none block mb-0.5">
              To
            </span>
            {isToFocused ? (
              <div>
                <input
                  ref={toInputMobileRef}
                  type="text"
                  className="airport-input-field text-xs sm:text-sm md:text-base font-bold w-full"
                  value={toSearch}
                  onChange={(e) => setToSearch(e.target.value)}
                  onBlur={() => setTimeout(() => setIsToFocused(false), 200)}
                  placeholder="Search city/airport"
                  autoComplete="off"
                />
              </div>
            ) : (
              <div>
                <div className="text-xs sm:text-sm md:text-base font-bold text-slate-900 truncate">
                  {toAirport ? toAirport.city : to}
                </div>
                <div className="text-[9px] sm:text-[10px] md:text-xs text-slate-500 truncate mt-0.5">
                  {toAirport ? `${toAirport.code}, ${toAirport.name} ${toAirport.country || ''}` : to}
                </div>
              </div>
            )}

            {/* TO Autocomplete Dropdown */}
            {isToFocused && getSuggestions(toSearch).length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden z-[100] max-h-56 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
                {getSuggestions(toSearch).map((airport) => (
                  <div
                    key={airport.code}
                    className="px-3 py-2 sm:px-3.5 sm:py-2.5 hover:bg-amber-50 text-left transition-colors cursor-pointer"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setTo(airport.code);
                      setToSearch(airport.city);
                      setIsToFocused(false);
                      updateUrlAndNotify(from, airport.code, depDate, arrDate, cabinClass);
                    }}
                  >
                    <div className="font-bold text-slate-900 text-[11px] sm:text-xs">{airport.city} ({airport.code})</div>
                    <div className="text-[9px] sm:text-[10px] text-slate-500 truncate">{airport.name}, {airport.country}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RECTANGLE 2: DEPARTURE, RETURN, CABIN CLASS IN ONE ROW */}
        <div className={`w-full bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm grid grid-cols-3 divide-x divide-slate-200/80 relative ${isCabinOpen ? "z-50" : "z-10"}`}>

          {/* DEPARTURE */}
          <div
            className="p-2 sm:p-3 md:p-3.5 cursor-pointer hover:bg-slate-50/80 transition-colors rounded-l-2xl"
            onClick={() => {
              setCalendarTab("dep");
              setIsCalendarOpen(true);
            }}
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 select-none block">
              Departure
            </span>
            <div className="mt-0.5 sm:mt-1">
              <div className="text-xs sm:text-sm md:text-base font-bold text-slate-900 truncate">
                {depFormatted.main}
              </div>
              <div className="text-[8px] sm:text-[9px] md:text-[10px] text-slate-500 truncate mt-0.5">
                {depFormatted.sub || "\u00A0"}
              </div>
            </div>
          </div>

          {/* RETURN */}
          <div
            className="p-2 sm:p-3 md:p-3.5 cursor-pointer hover:bg-slate-50/80 transition-colors"
            onClick={() => {
              setCalendarTab("arr");
              setIsCalendarOpen(true);
            }}
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 select-none block">
              Return
            </span>
            <div className="mt-0.5 sm:mt-1">
              <div className="text-xs sm:text-sm md:text-base font-bold text-slate-900 truncate">
                {arrFormatted.main}
              </div>
              <div className="text-[8px] sm:text-[9px] md:text-[10px] text-slate-500 truncate mt-0.5">
                {arrFormatted.sub || "\u00A0"}
              </div>
            </div>
          </div>

          {/* CABIN CLASS */}
          <div
            ref={cabinDropdownMobileRef}
            className={`p-2 sm:p-3 md:p-3.5 relative cursor-pointer hover:bg-slate-50/80 transition-colors rounded-r-2xl ${isCabinOpen ? "z-50" : "z-10"}`}
            onClick={() => setIsCabinOpen(!isCabinOpen)}
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 select-none block">
              Cabin Class
            </span>
            <div className="mt-0.5 sm:mt-1">
              <div className="text-xs sm:text-sm md:text-base font-bold text-slate-900 truncate flex items-center gap-1">
                <span className="material-symbols-outlined text-xs sm:text-sm font-semibold text-slate-700 select-none">
                  {currentCabinObj.icon}
                </span>
                <span className="truncate">{cabinClass}</span>
              </div>
              <div className="text-[8px] sm:text-[9px] md:text-[10px] text-slate-500 font-normal truncate mt-0.5">
                &nbsp;
              </div>
            </div>

            {/* Cabin Dropdown */}
            {isCabinOpen && (
              <div className="absolute right-0 top-[calc(100%+4px)] w-40 sm:w-44 bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden z-[100] py-1 animate-fade-in">
                {cabinOptions.map((option) => (
                  <div
                    key={option.label}
                    className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                      cabinClass.toLowerCase() === option.label.toLowerCase()
                        ? "bg-amber-100 text-amber-900"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectCabin(option.label);
                    }}
                  >
                    <span className="material-symbols-outlined text-xs sm:text-sm font-semibold select-none">
                      {option.icon}
                    </span>
                    <span>{option.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>


      {/* ── DESKTOP LAYOUT (hidden on mobile, visible on lg:flex) ─────────────── */}
      <div className={`hidden lg:flex w-full shadow-sm flex-row items-stretch divide-x divide-slate-200/80 bg-white/80 backdrop-blur-md rounded-2xl mt-5 relative ${isAnyDropdownActive ? "z-50" : "z-20"}`}>

        {/* FROM BOX */}
        <div
          className={`flex-1 px-3 sm:px-4 lg:px-6 py-2 relative cursor-pointer hover:bg-slate-200/40 transition-colors rounded-l-2xl ${isFromFocused ? "z-50" : "z-10"}`}
          onClick={() => {
            setIsFromFocused(true);
            setFromSearch(fromAirport?.city || from);
            setTimeout(() => fromInputDesktopRef.current?.focus(), 50);
          }}
        >
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 select-none block mb-1">
            From
          </span>

          {isFromFocused ? (
            <div className="mt-1">
              <input
                ref={fromInputDesktopRef}
                type="text"
                className="airport-input-field text-xs sm:text-sm md:text-base lg:text-lg font-bold"
                value={fromSearch}
                onChange={(e) => setFromSearch(e.target.value)}
                onBlur={() => setTimeout(() => setIsFromFocused(false), 200)}
                placeholder="Search city/airport"
                autoComplete="off"
              />
            </div>
          ) : (
            <div className="mt-1">
              <div className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-slate-900 truncate">
                {fromAirport ? fromAirport.city : from}
              </div>
              <div className="text-[9px] sm:text-[10px] lg:text-xs text-slate-600 truncate mt-0.5">
                {fromAirport ? `${fromAirport.code}, ${fromAirport.name} ${fromAirport.country || ''}` : from}
              </div>
            </div>
          )}

          {/* Autocomplete Dropdown */}
          {isFromFocused && getSuggestions(fromSearch).length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden z-[100] max-h-56 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
              {getSuggestions(fromSearch).map((airport) => (
                <div
                  key={airport.code}
                  className="px-3.5 py-2.5 hover:bg-amber-50 text-left transition-colors cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setFrom(airport.code);
                    setFromSearch(airport.city);
                    setIsFromFocused(false);
                    updateUrlAndNotify(airport.code, to, depDate, arrDate, cabinClass);
                  }}
                >
                  <div className="font-bold text-slate-900 text-xs">{airport.city} ({airport.code})</div>
                  <div className="text-[10px] text-slate-500 truncate">{airport.name}, {airport.country}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SWAP BUTTON DIVIDER */}
        <div className="relative flex items-center justify-center lg:w-0">
          <button
            type="button"
            onClick={handleSwap}
            className="z-20 w-7 h-7 rounded-full bg-slate-200/90 hover:bg-slate-300 border border-slate-300/80 shadow-xs flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer text-slate-700 lg:-mx-3.5"
            title="Swap Origin & Destination"
          >
            <span className="material-symbols-outlined text-base font-bold select-none">
              swap_horiz
            </span>
          </button>
        </div>

        {/* TO BOX */}
        <div
          className={`flex-1 px-3 sm:px-4 lg:px-6 py-2 relative cursor-pointer hover:bg-slate-200/40 transition-colors ${isToFocused ? "z-50" : "z-10"}`}
          onClick={() => {
            setIsToFocused(true);
            setToSearch(toAirport?.city || to);
            setTimeout(() => toInputDesktopRef.current?.focus(), 50);
          }}
        >
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 select-none block mb-1">
            To
          </span>

          {isToFocused ? (
            <div className="mt-1">
              <input
                ref={toInputDesktopRef}
                type="text"
                className="airport-input-field text-xs sm:text-sm md:text-base lg:text-lg font-bold"
                value={toSearch}
                onChange={(e) => setToSearch(e.target.value)}
                onBlur={() => setTimeout(() => setIsToFocused(false), 200)}
                placeholder="Search city/airport"
                autoComplete="off"
              />
            </div>
          ) : (
            <div className="mt-1">
              <div className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-slate-900 truncate">
                {toAirport ? toAirport.city : to}
              </div>
              <div className="text-[9px] sm:text-[10px] lg:text-xs text-slate-600 mt-0.5 truncate">
                {toAirport ? `${toAirport.code}, ${toAirport.name} ${toAirport.country || ''}` : to}
              </div>
            </div>
          )}

          {/* Autocomplete Dropdown */}
          {isToFocused && getSuggestions(toSearch).length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden z-[100] max-h-56 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
              {getSuggestions(toSearch).map((airport) => (
                <div
                  key={airport.code}
                  className="px-3.5 py-2.5 hover:bg-amber-50 text-left transition-colors cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setTo(airport.code);
                    setToSearch(airport.city);
                    setIsToFocused(false);
                    updateUrlAndNotify(from, airport.code, depDate, arrDate, cabinClass);
                  }}
                >
                  <div className="font-bold text-slate-900 text-xs">{airport.city} ({airport.code})</div>
                  <div className="text-[10px] text-slate-500 truncate">{airport.name}, {airport.country}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DEPARTURE BOX */}
        <div
          className="flex-1 px-2.5 sm:px-3 lg:px-4 py-2 cursor-pointer hover:bg-slate-200/40 transition-colors"
          onClick={() => {
            setCalendarTab("dep");
            setIsCalendarOpen(true);
          }}
        >
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 select-none block">
            Departure
          </span>
          <div className="mt-1">
            <div className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-slate-900 truncate">
              {depFormatted.main}
            </div>
            <div className="text-[9px] sm:text-[10px] lg:text-xs text-slate-600 truncate mt-0.5">
              {depFormatted.sub || "\u00A0"}
            </div>
          </div>
        </div>

        {/* RETURN BOX */}
        <div
          className="flex-1 px-2.5 sm:px-3 lg:px-4 py-2 cursor-pointer hover:bg-slate-200/40 transition-colors"
          onClick={() => {
            setCalendarTab("arr");
            setIsCalendarOpen(true);
          }}
        >
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 select-none block">
            Return
          </span>
          <div className="mt-1">
            <div className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-slate-900 truncate">
              {arrFormatted.main}
            </div>
            <div className="text-[9px] sm:text-[10px] lg:text-xs text-slate-600 truncate mt-0.5">
              {arrFormatted.sub || "\u00A0"}
            </div>
          </div>
        </div>

        {/* CABIN CLASS BOX */}
        <div
          ref={cabinDropdownDesktopRef}
          className={`flex-1 px-2.5 sm:px-3 lg:px-4 py-2 relative cursor-pointer hover:bg-slate-200/40 transition-colors rounded-r-2xl ${isCabinOpen ? "z-50" : "z-10"}`}
          onClick={() => setIsCabinOpen(!isCabinOpen)}
        >
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 select-none block mb-1">
            Cabin Class
          </span>
          <div className="mt-1">
            <div className="text-xs sm:text-sm md:text-base lg:text-lg font-medium text-slate-900 truncate flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm sm:text-base font-semibold text-slate-700 select-none">
                {currentCabinObj.icon}
              </span>
              <span className="font-semibold">{cabinClass}</span>
            </div>
            <div className="text-[9px] sm:text-[10px] lg:text-xs text-slate-500 font-normal truncate">
              &nbsp;
            </div>
          </div>

          {/* Cabin Class Dropdown */}
          {isCabinOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden z-[100] py-1 animate-fade-in">
              {cabinOptions.map((option) => (
                <div
                  key={option.label}
                  className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                    cabinClass.toLowerCase() === option.label.toLowerCase()
                      ? "bg-amber-100 text-amber-900"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelectCabin(option.label);
                  }}
                >
                  <span className="material-symbols-outlined text-base font-semibold select-none">
                    {option.icon}
                  </span>
                  <span>{option.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Shared DatePicker Modal */}
      <DatePickerModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        initialDepDate={depDate}
        initialArrDate={arrDate}
        onSelectDates={handleSelectDates}
        initialTab={calendarTab}
      />
    </div>
  );
}
