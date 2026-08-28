import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import CustomSelect from "./CustomSelect";
import { flightsAPI } from "@/services/flight-service/flightService";

export function getOrdinalSuffix(day) {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const year = date.getFullYear();
    return `${day}${getOrdinalSuffix(day)} ${month}, ${year}`;
  } catch {
    return dateStr;
  }
}

export default function DatePickerModal({
  isOpen,
  onClose,
  initialDepDate,
  initialArrDate,
  onSelectDates,
  initialTab,
  source,
  destination,
  cabinClass
}) {
  const [depDate, setDepDate] = useState(initialDepDate || "");
  const [arrDate, setArrDate] = useState(initialArrDate || "");
  const [activeTab, setActiveTab] = useState(initialTab || "dep");

  // Current calendar navigation
  const [viewDate, setViewDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState(null);

  // Fares state
  const [faresByDate, setFaresByDate] = useState({});
  const [loadingFares, setLoadingFares] = useState(false);

  // Sync state with props when modal opens
  useEffect(() => {
    if (isOpen) {
      setDepDate(initialDepDate || "");
      setArrDate(initialArrDate || "");
      setActiveTab(initialTab || "dep");
      setViewDate(initialDepDate ? new Date(initialDepDate) : new Date());
    }
  }, [isOpen, initialDepDate, initialArrDate, initialTab]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  // Days in current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // First day of month (0-6)
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  // Fetch calendar fares when month, viewDate, source, destination, or cabinClass change
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const startStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
    const endStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const fetchFares = async () => {
      setLoadingFares(true);
      try {
        const response = await flightsAPI.getCalendar({
          source: source || "",
          destination: destination || "",
          cabin_class: cabinClass || "Economy",
          start_date: startStr,
          end_date: endStr,
        });

        if (isMounted && response) {
          const rawData = response.data || response;
          setFaresByDate((prev) => ({
            ...prev,
            ...(rawData || {})
          }));
        }
      } catch (err) {
        console.warn("Failed to fetch calendar fares:", err);
      } finally {
        if (isMounted) setLoadingFares(false);
      }
    };

    fetchFares();

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentYear, currentMonth, daysInMonth, source, destination, cabinClass]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const handleMonthChange = (monthVal) => {
    const month = parseInt(monthVal, 10);
    setViewDate(new Date(currentYear, month, 1));
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleDateClick = (dateStr) => {
    if (activeTab === "dep") {
      setDepDate(dateStr);
      if (arrDate && dateStr > arrDate) {
        setArrDate("");
      }
    } else {
      setArrDate(dateStr);
    }
  };

  const handleConfirm = () => {
    onSelectDates(depDate, arrDate);
    onClose();
  };

  const handleClear = () => {
    setDepDate("");
    setArrDate("");
    setActiveTab("dep");
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const monthOptions = monthNames.map((name, index) => ({
    label: name,
    value: index.toString(),
  }));

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Generate calendar day list
  const days = [];
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(currentYear, currentMonth, d));
  }

  // Format date utility
  const toDateString = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = toDateString(new Date());

  // Determine reference price based on currently selected date (depDate / arrDate) or average
  const selectedDateStr = activeTab === "dep" ? depDate : (arrDate || depDate);
  const selectedFareData = faresByDate[selectedDateStr];
  const selectedFareVal = selectedFareData ? (typeof selectedFareData === "number" ? selectedFareData : selectedFareData.min_fare) : null;

  const validFares = Object.values(faresByDate)
    .map((f) => (typeof f === "number" ? f : f?.min_fare))
    .filter((val) => typeof val === "number" && !isNaN(val) && val > 0);

  const referencePrice = (selectedFareVal != null && !isNaN(selectedFareVal) && selectedFareVal > 0)
    ? selectedFareVal
    : (validFares.length > 0
        ? validFares.reduce((a, b) => a + b, 0) / validFares.length
        : null);

  const formatFareText = (fareObj) => {
    if (!fareObj) return null;
    const amount = typeof fareObj === "number" ? fareObj : fareObj.min_fare;
    const curr = typeof fareObj === "object" ? fareObj.currency || "" : "";
    if (amount === undefined || amount === null) return null;

    let symbol = curr;
    if (curr === "INR") symbol = "₹";
    else if (curr === "AUD" || curr === "USD" || curr === "CAD" || curr === "NZD" || curr === "SGD") symbol = "$";
    else if (curr === "EUR") symbol = "€";
    else if (curr === "GBP") symbol = "£";
    else if (curr === "JPY" || curr === "CNY") symbol = "¥";
    else {
      try {
        symbol = new Intl.NumberFormat("en-US", { style: "currency", currency: curr, currencyDisplay: "narrowSymbol" })
          .formatToParts(0)
          .find((p) => p.type === "currency")?.value || curr;
      } catch {
        symbol = curr;
      }
    }

    if (amount >= 100000) {
      return `${symbol}${(amount / 1000).toFixed(0)}k`;
    }
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-md transition-all duration-300 animate-fade-in">
      
      {/* Backdrop click closer */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container — WIDER LAYOUT (max-w-3xl) */}
      <div className="relative w-[95%] max-w-3xl bg-white/95 backdrop-blur-2xl border border-white/40 shadow-2xl rounded-2xl sm:rounded-3xl p-5 sm:p-7 overflow-hidden transition-all duration-300">
        
        {/* Header with Selected Dates summary bar / Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5 sm:mb-6">
          <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs flex-1 max-w-md">
            <button
              type="button"
              onClick={() => setActiveTab("dep")}
              className={`flex-1 py-2 sm:py-2.5 text-center transition-all duration-200 rounded-xl cursor-pointer ${
                activeTab === "dep"
                  ? "bg-white shadow-xs ring-1 ring-black/5 font-extrabold"
                  : "hover:bg-white/60 text-slate-600"
              }`}
            >
              <div className="text-[9px] sm:text-[10px] font-extrabold tracking-wider text-slate-400 uppercase select-none">Departure</div>
              <div className="font-extrabold text-slate-900 text-xs mt-0.5">
                {depDate ? formatDisplayDate(depDate) : "Select date"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("arr")}
              className={`flex-1 py-2 sm:py-2.5 text-center transition-all duration-200 rounded-xl cursor-pointer ${
                activeTab === "arr"
                  ? "bg-white shadow-xs ring-1 ring-black/5 font-extrabold"
                  : "hover:bg-white/60 text-slate-600"
              }`}
            >
              <div className="text-[9px] sm:text-[10px] font-extrabold tracking-wider text-slate-400 uppercase select-none">Return</div>
              <div className="font-extrabold text-slate-900 text-xs mt-0.5">
                {arrDate ? formatDisplayDate(arrDate) : "One way / Select"}
              </div>
            </button>
          </div>

          {/* Month & Year Navigation with Prev/Next buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 transition-colors shadow-xs cursor-pointer"
              title="Previous Month"
            >
              <span className="material-symbols-outlined text-sm font-bold">chevron_left</span>
            </button>

            <div className="w-32">
              <CustomSelect
                value={currentMonth.toString()}
                onChange={handleMonthChange}
                options={monthOptions}
                className="py-1.5 px-3 text-xs font-bold"
              />
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 transition-colors shadow-xs cursor-pointer"
              title="Next Month"
            >
              <span className="material-symbols-outlined text-sm font-bold">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Calendar Grid Header (Weekdays) */}
        <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
          {weekdayNames.map((w) => (
            <div key={w} className="text-[10px] font-bold text-slate-400 py-1 uppercase tracking-widest select-none">
              {w}
            </div>
          ))}
        </div>

        {/* Calendar Grid Body (Days with Fares) */}
        <div className="grid grid-cols-7 text-center mb-6">
          {days.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="h-14 sm:h-16" />;
            
            const dateStr = toDateString(date);
            const isToday = dateStr === todayStr;
            const isDep = dateStr === depDate;
            const isArr = dateStr === arrDate;
            
            let isInRange = false;
            if (depDate && arrDate && dateStr > depDate && dateStr < arrDate) {
              isInRange = true;
            } else if (depDate && !arrDate && hoveredDate && dateStr > depDate && dateStr < hoveredDate) {
              isInRange = true;
            }

            const isPast = dateStr < todayStr;
            const isBeforeDep = activeTab === "arr" && depDate && dateStr < depDate;
            const isDisabled = isPast || isBeforeDep;

            const fareData = faresByDate[dateStr];
            const fareVal = fareData ? (typeof fareData === "number" ? fareData : fareData.min_fare) : null;
            const formattedFare = formatFareText(fareData);

            // Compute fare badge color based on comparison with selected date's fare
            let fareBadgeClass = "bg-slate-100 text-slate-700 font-semibold";
            if (isDep || isArr) {
              fareBadgeClass = "bg-amber-400/20 text-amber-300 font-extrabold";
            } else if (referencePrice != null && fareVal != null) {
              if (fareVal <= referencePrice) {
                // Cheaper or equal to selected date fare -> GREEN
                fareBadgeClass = "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400/40 font-bold";
              } else {
                // More expensive than selected date fare -> RED
                fareBadgeClass = "bg-rose-100 text-rose-800 ring-1 ring-rose-400/40 font-bold";
              }
            }

            return (
              <button
                key={dateStr}
                disabled={isDisabled}
                onClick={() => handleDateClick(dateStr)}
                onMouseEnter={() => !isDisabled && setHoveredDate(dateStr)}
                onMouseLeave={() => setHoveredDate(null)}
                className={`
                  h-14 sm:h-16 flex flex-col items-center justify-between p-1.5 relative transition-all duration-150 cursor-pointer border
                  ${isDisabled ? "opacity-25 border-transparent cursor-not-allowed bg-slate-50" : "hover:bg-amber-100/80 shadow-2xs"}
                  ${isToday && !isDep && !isArr ? "border-slate-400 text-slate-900 font-extrabold" : "border-slate-100 bg-white"}
                  ${isDep || isArr ? "!bg-slate-900 !text-amber-400 !border-slate-900 scale-[1.02] shadow-md font-extrabold" : ""}
                  ${isInRange ? "!bg-amber-50/70 !text-amber-950 rounded-none" : ""}
                `}
              >
                {/* Date Number */}
                <div className={`text-xs sm:text-sm font-bold ${isDep || isArr ? "text-amber-400" : "text-slate-900"}`}>
                  {date.getDate()}
                </div>

                {/* Lowest Price Label Under Date */}
                {isDisabled ? null : loadingFares ? (
                  <div className="w-8 h-2.5 bg-slate-100 rounded-full animate-pulse my-0.5" />
                ) : formattedFare ? (
                  <div
                    className={`
                      text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate max-w-full leading-none transition-transform
                      ${fareBadgeClass}
                    `}
                  >
                    {formattedFare}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-300 font-medium">—</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Action Controls */}
        <div className="flex justify-between items-center gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={handleClear}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          >
            Clear
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={!depDate}
              onClick={handleConfirm}
              className="px-6 py-2 rounded-xl text-xs font-extrabold bg-slate-900 text-amber-400 hover:bg-slate-950 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
            >
              Confirm Dates
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
