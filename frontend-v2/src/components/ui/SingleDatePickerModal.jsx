import { useState, useEffect } from "react";
import { formatDisplayDate } from "./DatePickerModal";
import CustomSelect from "./CustomSelect";

export default function SingleDatePickerModal({
  isOpen,
  onClose,
  initialDate,
  onSelectDate,
  title = "Select Date of Birth"
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate || "");
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    if (isOpen) {
      const parsed = initialDate ? new Date(initialDate) : new Date(2003, 0, 1);
      setSelectedDate(initialDate || "");
      setViewDate(isNaN(parsed.getTime()) ? new Date(2003, 0, 1) : parsed);
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const handleYearChange = (yearVal) => {
    const year = parseInt(yearVal, 10);
    setViewDate(new Date(year, currentMonth, 1));
  };

  const handleMonthChange = (monthVal) => {
    const month = parseInt(monthVal, 10);
    setViewDate(new Date(currentYear, month, 1));
  };

  const handleDayClick = (day) => {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
    setSelectedDate(dateStr);
  };

  const handleConfirm = () => {
    onSelectDate(selectedDate);
    onClose();
  };

  const monthOptions = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ].map((name, index) => ({ label: name, value: index.toString() }));

  const nowYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = nowYear; y >= 1940; y--) {
    yearOptions.push({ label: y.toString(), value: y.toString() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Year and Month Selectors using CustomSelect */}
        <div className="flex items-center gap-2 my-4">
          <div className="flex-1">
            <CustomSelect
              value={currentMonth.toString()}
              onChange={handleMonthChange}
              options={monthOptions}
              className="py-1.5 px-3 text-xs"
            />
          </div>

          <div className="w-28">
            <CustomSelect
              value={currentYear.toString()}
              onChange={handleYearChange}
              options={yearOptions}
              className="py-1.5 px-3 text-xs"
            />
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 text-center mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, idx) => (
            <span key={idx} className="text-[11px] font-extrabold text-slate-400 uppercase">
              {day}
            </span>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const monthStr = String(currentMonth + 1).padStart(2, '0');
            const dayStr = String(day).padStart(2, '0');
            const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
            const isSelected = selectedDate === dateStr;

            return (
              <button
                key={day}
                type="button"
                onClick={() => handleDayClick(day)}
                className={`h-8 w-8 mx-auto flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#ffd700] text-slate-900 shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Display selected date text */}
        {selectedDate && (
          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <span className="text-xs font-semibold text-slate-500">
              Selected: <strong className="text-slate-800">{formatDisplayDate(selectedDate)}</strong>
            </span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedDate}
            className="btn-primary px-5 py-2 rounded-xl text-xs disabled:opacity-50"
          >
            Confirm Date
          </button>
        </div>

      </div>
    </div>
  );
}
