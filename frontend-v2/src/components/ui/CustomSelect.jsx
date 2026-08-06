import { useState, useRef, useEffect } from "react";

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select option",
  className = "",
  error = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value || opt === value);
  const displayLabel = typeof selectedOption === "object" ? selectedOption.label : selectedOption || placeholder;

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`input-field flex items-center justify-between text-left cursor-pointer transition-all ${
          error ? "ring-1 ring-rose-500" : ""
        } ${className}`}
      >
        <span className={value ? "text-slate-800 font-semibold" : "text-slate-400 font-medium"}>
          {displayLabel}
        </span>
        <span
          className={`material-symbols-outlined text-sm text-slate-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Floating Options Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 animate-fade-in max-h-56 overflow-y-auto">
          {options.map((option, index) => {
            const optValue = typeof option === "object" ? option.value : option;
            const optLabel = typeof option === "object" ? option.label : option;
            const isSelected = value === optValue;

            return (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(optValue)}
                className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-amber-500/10 text-amber-700 font-bold"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{optLabel}</span>
                {isSelected && (
                  <span className="material-symbols-outlined text-xs text-amber-600 font-bold">
                    check
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
