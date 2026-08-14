import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import CustomSelect from "./CustomSelect";

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
  initialTab
}) {
  const [depDate, setDepDate] = useState(initialDepDate || "");
  const [arrDate, setArrDate] = useState(initialArrDate || "");
  const [activeTab, setActiveTab] = useState(initialTab || "dep");

  // Current calendar navigation
  const [viewDate, setViewDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState(null);

  // Sync state with props when modal opens
  useEffect(() => {
    if (isOpen) {
      setDepDate(initialDepDate || "");
      setArrDate(initialArrDate || "");
      setActiveTab(initialTab || "dep");
      setViewDate(initialDepDate ? new Date(initialDepDate) : new Date());
    }
  }, [isOpen, initialDepDate, initialArrDate, initialTab]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  // Days in current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // First day of month (0-6)
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const handleYearChange = (yearVal) => {
    const year = parseInt(yearVal, 10);
    setViewDate(new Date(year, currentMonth, 1));
  };

  const handleMonthChange = (monthVal) => {
    const month = parseInt(monthVal, 10);
    setViewDate(new Date(currentYear, month, 1));
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

  const nowYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = nowYear + 2; y >= nowYear - 1; y--) {
    yearOptions.push({ label: y.toString(), value: y.toString() });
  }

  const weekdayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

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

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm transition-all duration-300 animate-fade-in">
      
      {/* Backdrop click closer */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-white/90 backdrop-blur-2xl border border-white/40 shadow-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 overflow-hidden transition-transform duration-300 scale-100 hover:shadow-primary/5">
        
        {/* Selected Dates summary bar / Tabs */}
        <div className="flex gap-1.5 p-1 sm:p-1.5 bg-black/5 rounded-xl sm:rounded-2xl mb-4 sm:mb-6 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("dep")}
            className={`flex-1 py-2 sm:py-3 text-center transition-all duration-200 rounded-lg sm:rounded-xl cursor-pointer ${
              activeTab === "dep"
                ? "bg-white shadow-sm ring-1 ring-black/5"
                : "hover:bg-white/50"
            }`}
          >
            <div className="text-[9px] sm:text-[10px] font-extrabold tracking-wider text-slate-400 uppercase select-none">Departure</div>
            <div className="font-extrabold text-on-surface text-[11px] sm:text-xs mt-0.5">
              {depDate ? formatDisplayDate(depDate) : "Select date"}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("arr")}
            className={`flex-1 py-2 sm:py-3 text-center transition-all duration-200 rounded-lg sm:rounded-xl cursor-pointer ${
              activeTab === "arr"
                ? "bg-white shadow-sm ring-1 ring-black/5"
                : "hover:bg-white/50"
            }`}
          >
            <div className="text-[9px] sm:text-[10px] font-extrabold tracking-wider text-slate-400 uppercase select-none">Return</div>
            <div className="font-extrabold text-on-surface text-[11px] sm:text-xs mt-0.5">
              {arrDate ? formatDisplayDate(arrDate) : "One way / Select"}
            </div>
          </button>
        </div>

        {/* Month & Year Navigation with CustomSelect */}
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <div className="flex-1">
            <CustomSelect
              value={currentMonth.toString()}
              onChange={handleMonthChange}
              options={monthOptions}
              className="py-1 sm:py-1.5 px-2.5 sm:px-3 text-xs"
            />
          </div>
          <div className="w-24 sm:w-28">
            <CustomSelect
              value={currentYear.toString()}
              onChange={handleYearChange}
              options={yearOptions}
              className="py-1 sm:py-1.5 px-2.5 sm:px-3 text-xs"
            />
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center mb-4 sm:mb-6">
          {/* Weekdays */}
          {weekdayNames.map((w) => (
            <div key={w} className="text-[10px] sm:text-xs font-bold text-on-surface-variant opacity-60 py-0.5 sm:py-1 select-none">
              {w}
            </div>
          ))}

          {/* Days */}
          {days.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} />;
            
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

            return (
              <button
                key={dateStr}
                disabled={isDisabled}
                onClick={() => handleDateClick(dateStr)}
                onMouseEnter={() => !isDisabled && setHoveredDate(dateStr)}
                onMouseLeave={() => setHoveredDate(null)}
                className={`
                  aspect-square rounded-full flex flex-col items-center justify-center text-[11px] sm:text-xs font-bold relative transition-all duration-150 cursor-pointer
                  ${isDisabled ? "opacity-20 cursor-not-allowed" : "hover:bg-primary-container hover:text-primary-dark"}
                  ${isToday && !isDep && !isArr ? "border border-primary text-primary font-extrabold" : ""}
                  ${isDep ? "bg-primary text-white scale-105 shadow-md shadow-primary/20 font-extrabold" : ""}
                  ${isArr ? "bg-primary text-white scale-105 shadow-md shadow-primary/20 font-extrabold" : ""}
                  ${isInRange ? "bg-primary-container/60 text-primary-dark rounded-none" : ""}
                `}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex justify-between items-center gap-2 sm:gap-3">
          <button
            onClick={handleClear}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-[11px] sm:text-xs font-extrabold text-on-surface-variant/80 hover:bg-black/5 active:scale-95 transition-all cursor-pointer"
          >
            Clear
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!depDate}
              onClick={handleConfirm}
              className="btn-primary px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs disabled:opacity-50"
            >
              Confirm
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
