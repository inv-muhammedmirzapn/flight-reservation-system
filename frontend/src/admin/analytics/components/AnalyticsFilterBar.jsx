import { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '@/services/apiClient';
import { Calendar, Plane, LayoutGrid, Route, SlidersHorizontal, RotateCcw } from 'lucide-react';

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

  const selectCls = `
    w-full rounded-lg border border-black/10 bg-white/85 text-sm text-admin-ink font-ui
    outline-none transition-all duration-150 px-3 py-[7px]
    focus:border-admin-accent-dark focus:bg-white
    disabled:opacity-40 disabled:cursor-not-allowed
  `;

  return (
    <div className="backdrop-blur-[25px] border border-white/50 overflow-hidden bg-white/70 shadow-[0_10px_30px_rgba(0,0,0,0.04)] rounded-admin-lg px-5 py-4 mb-6 flex flex-wrap gap-4 items-end">

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
        <input
          type="date"
          value={filters.startDate}
          max={filters.endDate || undefined}
          onChange={e => handleFieldChange('startDate', e.target.value)}
          disabled={disabled}
          className={inputCls}
        />
      </div>

      {/* End Date */}
      <div className="flex flex-col gap-1 min-w-[145px] flex-1">
        <label className="text-xs font-bold uppercase tracking-[0.07em] text-admin-muted flex items-center gap-1">
          <Calendar size={11} /> To
        </label>
        <input
          type="date"
          value={filters.endDate}
          min={filters.startDate || undefined}
          onChange={e => handleFieldChange('endDate', e.target.value)}
          disabled={disabled}
          className={inputCls}
        />
      </div>

      {/* Airline */}
      <div className="flex flex-col gap-1 min-w-[175px] flex-1">
        <label className="text-xs font-bold uppercase tracking-[0.07em] text-admin-muted flex items-center gap-1">
          <Plane size={11} /> Airline
        </label>
        <select
          value={filters.airlineId}
          onChange={e => handleFieldChange('airlineId', e.target.value)}
          disabled={disabled}
          className={selectCls}
        >
          <option value="">All Airlines</option>
          {airlines.map(a => (
            <option key={a.id} value={a.id}>
              {a.iata_airline_code} – {a.airline_name}
            </option>
          ))}
        </select>
      </div>

      {/* Aircraft */}
      <div className="flex flex-col gap-1 min-w-[160px] flex-1">
        <label className="text-xs font-bold uppercase tracking-[0.07em] text-admin-muted flex items-center gap-1">
          <LayoutGrid size={11} /> Aircraft
        </label>
        <select
          value={filters.aircraftId}
          onChange={e => handleFieldChange('aircraftId', e.target.value)}
          disabled={disabled}
          className={selectCls}
        >
          <option value="">All Aircraft</option>
          {aircraft.map(ac => (
            <option key={ac.id} value={ac.id}>
              {ac.registration}
            </option>
          ))}
        </select>
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
