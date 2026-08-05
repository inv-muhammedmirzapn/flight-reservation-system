import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchWithAuth } from '@/services/apiClient';
import { Calendar, Plane, LayoutGrid, Route, SlidersHorizontal, RotateCcw, ChevronDown } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';

/**
 * AnalyticsFilterBar
 *
 * Renders a row of filter controls (date range, airline, aircraft, route)
 * and calls onFilterChange whenever the user commits a filter update.
 *
 * Props:
 *  - onFilterChange(filters): called with { startDate, endDate, airlineId, aircraftId }
 *  - disabled: bool — disables controls while parent is loading
 */
function TailwindDropdown({ value, onChange, options, placeholder, disabled, className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selectedOpt = options.find(o => String(o.value) === String(value));
  const display = selectedOpt ? selectedOpt.label : placeholder;

  return (
    <div className="relative w-full" ref={ref}>
      <div
        className={`${className} flex items-center justify-between cursor-pointer ${open ? 'border-[#705d00] bg-white ring-2 ring-[#705d00]/10' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
      >
        <span className="truncate">{display}</span>
        <ChevronDown size={14} className={`text-[#5e5e5e] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white/95 backdrop-blur-xl border border-black/10 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-50 max-h-60 overflow-y-auto py-1.5">
          <div
            className={`px-3 py-2 text-[13px] cursor-pointer transition-colors ${!value ? 'bg-[#ffd700]/20 text-[#705d00] font-bold' : 'text-[#1a1c1d] hover:bg-black/5 font-medium'}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            {placeholder}
          </div>
          {options.map(opt => (
            <div
              key={opt.value}
              className={`px-3 py-2 text-[13px] cursor-pointer transition-colors ${String(value) === String(opt.value) ? 'bg-[#ffd700]/20 text-[#705d00] font-bold' : 'text-[#1a1c1d] hover:bg-black/5 font-medium'}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnalyticsFilterBar({ onFilterChange, disabled = false }) {
  const [airlines, setAirlines] = useState([]);
  const [aircraft, setAircraft] = useState([]);
  const [filters, setFilters] = useState({
    startDate: '', endDate: '', airlineId: '', aircraftId: '',
  });

  useEffect(() => {
    fetchWithAuth('/flights/v2/airlines/?page_size=200')
      .then(data => setAirlines(Array.isArray(data) ? data : (data?.results ?? [])))
      .catch(() => { });
    fetchWithAuth('/flights/v2/aircraft/?page_size=200')
      .then(data => setAircraft(Array.isArray(data) ? data : (data?.results ?? [])))
      .catch(() => { });
  }, []);

  const handleFieldChange = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    onFilterChange({
      startDate:  next.startDate  || undefined,
      endDate:    next.endDate    || undefined,
      airlineId:  next.airlineId  || undefined,
      aircraftId: next.aircraftId || undefined,
    });
  };

  const reset = () => {
    setFilters({ startDate: '', endDate: '', airlineId: '', aircraftId: '' });
    onFilterChange({});
  };

  const hasActive = Object.values(filters).some(v => v !== '');

  const inputCls = `
    w-full rounded-lg border border-black/10 bg-white/85 text-sm text-admin-ink font-ui
    outline-none transition-all duration-150 px-3 py-[7px]
    focus:border-admin-accent-dark focus:bg-white
    disabled:opacity-40 disabled:cursor-not-allowed
    [color-scheme:light]
  `;



  return (
    <div className="relative z-50 backdrop-blur-[25px] border border-white/50 bg-white/70 shadow-[0_10px_30px_rgba(0,0,0,0.04)] rounded-admin-lg px-5 py-4 mb-6 flex flex-wrap gap-4 items-end">

      {/* Label */}
      <div className="flex items-center gap-2 text-admin-accent-dark font-bold text-sm self-center mr-1">
        <SlidersHorizontal size={15} />
        <span>Filters</span>
      </div>

      {/* Start Date */}
      <div className="flex flex-col gap-1 min-w-[145px] flex-1">
        <label className="text-xs font-bold uppercase tracking-[0.07em] text-admin-muted flex items-center gap-1">
          <Calendar size={11} /> From
        </label>
        <DatePicker
          variant="transparent"
          value={filters.startDate}
          onChange={val => handleFieldChange('startDate', val)}
          disabled={disabled}
          className={inputCls}
          placeholder="Select Date"
        />
      </div>

      {/* End Date */}
      <div className="flex flex-col gap-1 min-w-[145px] flex-1">
        <label className="text-xs font-bold uppercase tracking-[0.07em] text-admin-muted flex items-center gap-1">
          <Calendar size={11} /> To
        </label>
        <DatePicker
          variant="transparent"
          value={filters.endDate}
          onChange={val => handleFieldChange('endDate', val)}
          disabled={disabled}
          className={inputCls}
          placeholder="Select Date"
        />
      </div>

      {/* Airline */}
      <div className="flex flex-col gap-1 min-w-[175px] flex-1">
        <label className="text-xs font-bold uppercase tracking-[0.07em] text-admin-muted flex items-center gap-1">
          <Plane size={11} /> Airline
        </label>
        <TailwindDropdown
          value={filters.airlineId}
          onChange={val => handleFieldChange('airlineId', val)}
          disabled={disabled}
          className={inputCls}
          placeholder="All Airlines"
          options={airlines.map(a => ({ value: a.id, label: `${a.iata_airline_code} – ${a.airline_name}` }))}
        />
      </div>

      {/* Aircraft */}
      <div className="flex flex-col gap-1 min-w-[160px] flex-1">
        <label className="text-xs font-bold uppercase tracking-[0.07em] text-admin-muted flex items-center gap-1">
          <LayoutGrid size={11} /> Aircraft
        </label>
        <TailwindDropdown
          value={filters.aircraftId}
          onChange={val => handleFieldChange('aircraftId', val)}
          disabled={disabled}
          className={inputCls}
          placeholder="All Aircraft"
          options={aircraft.map(ac => ({ value: ac.id, label: ac.registration }))}
        />
      </div>


      {/* Reset */}
      {hasActive && (
        <button
          onClick={reset}
          disabled={disabled}
          className="inline-flex font-bold py-2 px-3.5 rounded-admin-sm border border-black/[0.08] cursor-pointer bg-black/[0.06] text-[#1a1c1d] font-ui text-sm transition-colors duration-150 hover:bg-black/10 flex items-center gap-1.5 self-end"
        >
          <RotateCcw size={12} /> Reset
        </button>
      )}
    </div>
  );
}
