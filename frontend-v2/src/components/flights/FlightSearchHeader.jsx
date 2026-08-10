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

  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  const cabinDropdownRef = useRef(null);

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

  // Close cabin dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (cabinDropdownRef.current && !cabinDropdownRef.current.contains(e.target)) {
        setIsCabinOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Synchronize state with URL searchParams (e.g. when selected via DateStripCarousel)
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
    } catch (e) {
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

  return (
    <div className="w-full mx-auto">
      {/* Compact Horizontal Header Container */}
      <div className="w-full shadow-sm flex flex-col lg:flex-row items-stretch divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 relative">
        
        {/* FROM BOX */}
        <div
          className="flex-1 px-6 py-2 relative cursor-pointer hover:bg-slate-200/40 transition-colors rounded-t-xl lg:rounded-l-xl lg:rounded-tr-none"
          onClick={() => {
            setIsFromFocused(true);
            setFromSearch(fromAirport?.city || from);
            setTimeout(() => fromInputRef.current?.focus(), 50);
          }}
        >
          <span className="text-[10px] font-bold text-slate-400 select-none block mb-1">
            From
          </span>

          {isFromFocused ? (
            <div className="mt-1">
              <input
                ref={fromInputRef}
                type="text"
                className="airport-input-field text-lg"
                value={fromSearch}
                onChange={(e) => setFromSearch(e.target.value)}
                onBlur={() => setTimeout(() => setIsFromFocused(false), 200)}
                placeholder="Search city/airport"
                autoComplete="off"
              />
            </div>
          ) : (
            <div className="mt-1">
              <div className="text-lg font-medium text-slate-900 truncate">
                {fromAirport ? fromAirport.city : from}
              </div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                {fromAirport ? `${fromAirport.code}, ${fromAirport.name} ${fromAirport.country || ''}` : from}
              </div>
            </div>
          )}

          {/* Autocomplete Dropdown */}
          {isFromFocused && getSuggestions(fromSearch).length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
              {getSuggestions(fromSearch).map((airport) => (
                <div
                  key={airport.code}
                  className="px-3 py-2 hover:bg-amber-50 text-left transition-colors cursor-pointer"
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
        <div className="relative flex items-center justify-center py-0.5 lg:py-0 lg:w-0">
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
          className="flex-1 px-6 py-2 relative cursor-pointer hover:bg-slate-200/40 transition-colors"
          onClick={() => {
            setIsToFocused(true);
            setToSearch(toAirport?.city || to);
            setTimeout(() => toInputRef.current?.focus(), 50);
          }}
        >
          <span className="text-[10px] font-bold text-slate-400 select-none block mb-1">
            To
          </span>

          {isToFocused ? (
            <div className="mt-1">
              <input
                ref={toInputRef}
                type="text"
                className="airport-input-field text-lg"
                value={toSearch}
                onChange={(e) => setToSearch(e.target.value)}
                onBlur={() => setTimeout(() => setIsToFocused(false), 200)}
                placeholder="Search city/airport"
                autoComplete="off"
              />
            </div>
          ) : (
            <div className="mt-1">
              <div className="text-lg font-medium text-slate-900 truncate">
                {toAirport ? toAirport.city : to}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                {toAirport ? `${toAirport.code}, ${toAirport.name} ${toAirport.country || ''}` : to}
              </div>
            </div>
          )}

          {/* Autocomplete Dropdown */}
          {isToFocused && getSuggestions(toSearch).length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
              {getSuggestions(toSearch).map((airport) => (
                <div
                  key={airport.code}
                  className="px-3 py-2 hover:bg-amber-50 text-left transition-colors cursor-pointer"
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
          className="flex-1 px-4 py-2 cursor-pointer hover:bg-slate-200/40 transition-colors"
          onClick={() => {
            setCalendarTab("dep");
            setIsCalendarOpen(true);
          }}
        >
          <span className="text-[10px] font-bold text-slate-400 select-none block">
            Departure
          </span>
          <div className="mt-1">
            <div className="text-lg font-medium text-slate-900 truncate">
              {depFormatted.main}
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              {depFormatted.sub || "\u00A0"}
            </div>
          </div>
        </div>

        {/* RETURN BOX */}
        <div
          className="flex-1 px-4 py-2 cursor-pointer hover:bg-slate-200/40 transition-colors"
          onClick={() => {
            setCalendarTab("arr");
            setIsCalendarOpen(true);
          }}
        >
          <span className="text-[10px] font-bold text-slate-400 select-none block">
            Return
          </span>
          <div className="mt-1">
            <div className="text-lg font-medium text-slate-900 truncate">
              {arrFormatted.main}
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              {arrFormatted.sub || "\u00A0"}
            </div>
          </div>
        </div>

        {/* CABIN CLASS BOX */}
        <div
          ref={cabinDropdownRef}
          className="flex-1 px-4 py-2 relative cursor-pointer hover:bg-slate-200/40 transition-colors rounded-b-xl lg:rounded-r-xl lg:rounded-bl-none"
          onClick={() => setIsCabinOpen(!isCabinOpen)}
        >
          <span className="text-[10px] font-bold text-slate-400 select-none block mb-1">
            Cabin Class
          </span>
          <div className="mt-1">
            <div className="text-lg font-medium text-slate-900 truncate flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base font-semibold text-slate-700 select-none">
                {currentCabinObj.icon}
              </span>
              <span>{cabinClass}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-normal truncate">
              &nbsp;
            </div>
          </div>

          {/* Cabin Class Dropdown */}
          {isCabinOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-50 py-1 animate-fade-in">
              {cabinOptions.map((option) => (
                <div
                  key={option.label}
                  className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                    cabinClass === option.label
                      ? "bg-amber-100 text-amber-900"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={(e) => {
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
