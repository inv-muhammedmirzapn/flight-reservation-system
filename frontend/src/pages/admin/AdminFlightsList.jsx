import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchFlights, deleteFlight, setCurrentPage,
  bulkImportFlights, bulkImportFlightsCsv,
  clearFlightErrors, fetchFlightStats,
} from '../../store/flightSlice';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import DatePicker from '../../components/ui/DatePicker';
import { Plus, Edit2, Eye, Plane, RefreshCw, AlertCircle, Trash2, UploadCloud, FileText, Search, X, SlidersHorizontal, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { DeleteFlightDialog } from '../../components/ui/DeleteFlightDialog';
import { Pagination } from '../../components/ui/Pagination';

const INR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
const fmtDT = (iso) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

const STATUS_STYLE = {
  SCHEDULED: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  DELAYED:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  CANCELLED: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  BOARDING:  { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  DEPARTED:  { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  ARRIVED:   { bg: '#f3e8ff', color: '#7c3aed', border: '#d8b4fe' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'DELAYED',   label: 'Delayed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'BOARDING',  label: 'Boarding' },
  { value: 'DEPARTED',  label: 'Departed' },
  { value: 'ARRIVED',   label: 'Arrived' },
];

function Badge({ status }) {
  const s = STATUS_STYLE[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 9999, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}

function Stat({ label, value, icon, accent, loading }) {
  return (
    <div className="glass-card" style={{ borderRadius: 20, padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#5e5e5e', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: loading ? '#d0c6ab' : (accent || '#1a1c1d'), fontFamily: "'Plus Jakarta Sans',Inter,sans-serif", transition: 'color 0.3s' }}>
          {loading ? '—' : value}
        </div>
      </div>
      <div style={{ opacity: 0.18 }}>{icon}</div>
    </div>
  );
}

export default function AdminFlightsList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list: flights, count, currentPage, totalPages, loading, statsLoading, actionLoading, error, stats = {} } = useSelector(s => s.flights);

  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Active filter/sort state
  const [activeSearch, setActiveSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [arrivalDateFilter, setArrivalDateFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [destFilter, setDestFilter] = useState('');
  const [sortBy, setSortBy] = useState('departure_time');
  const [sortOrder, setSortOrder] = useState('desc');

  // Input state for inline quick search
  const [searchInput, setSearchInput] = useState('');

  // Modal open/close states
  const [filterOpen, setFilterOpen] = useState(false);

  // Draft states for advanced filters modal
  const [draftSearch, setDraftSearch] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [draftArrivalDate, setDraftArrivalDate] = useState('');
  const [draftSource, setDraftSource] = useState('');
  const [draftDest, setDraftDest] = useState('');
  const [draftSortBy, setDraftSortBy] = useState('departure_time');
  const [draftSortOrder, setDraftSortOrder] = useState('desc');

  const debounceRef = useRef(null);

  const buildParams = useCallback((search, status, date, arrivalDate, source, dest, sortingBy, sortingOrder) => {
    const p = {};
    if (search) p.search = search;
    if (status) p.status = status;
    if (date)   p.date   = date;
    if (arrivalDate) p.arrival_date = arrivalDate;
    if (source) p.source = source;
    if (dest) p.destination = dest;
    
    // Sort direction prefix logic
    const orderingPrefix = sortingOrder === 'desc' ? '-' : '';
    p.ordering = `${orderingPrefix}${sortingBy}`;

    return p;
  }, []);

  // Initial load
  useEffect(() => {
    dispatch(clearFlightErrors());
    dispatch(fetchFlightStats());
    dispatch(fetchFlights({ page: 1, params: buildParams(activeSearch, statusFilter, dateFilter, arrivalDateFilter, sourceFilter, destFilter, sortBy, sortOrder) }));
    return () => { dispatch(clearFlightErrors()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce quick search input → trigger fetch
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActiveSearch(val);
      dispatch(setCurrentPage(1));
      dispatch(fetchFlights({
        page: 1,
        params: buildParams(val, statusFilter, dateFilter, arrivalDateFilter, sourceFilter, destFilter, sortBy, sortOrder)
      }));
    }, 300);
  };

  const handleOpenFilters = () => {
    setDraftSearch(activeSearch);
    setDraftStatus(statusFilter);
    setDraftDate(dateFilter);
    setDraftArrivalDate(arrivalDateFilter);
    setDraftSource(sourceFilter);
    setDraftDest(destFilter);
    setDraftSortBy(sortBy);
    setDraftSortOrder(sortOrder);
    setFilterOpen(true);
  };

  const handleApplyFilters = () => {
    setActiveSearch(draftSearch);
    setSearchInput(draftSearch);
    setStatusFilter(draftStatus);
    setDateFilter(draftDate);
    setArrivalDateFilter(draftArrivalDate);
    setSourceFilter(draftSource);
    setDestFilter(draftDest);
    setSortBy(draftSortBy);
    setSortOrder(draftSortOrder);

    dispatch(setCurrentPage(1));
    dispatch(fetchFlights({
      page: 1,
      params: buildParams(draftSearch, draftStatus, draftDate, draftArrivalDate, draftSource, draftDest, draftSortBy, draftSortOrder)
    }));
    setFilterOpen(false);
  };

  const handleClearFilters = () => {
    clearTimeout(debounceRef.current);
    setSearchInput('');
    setActiveSearch('');
    setStatusFilter('');
    setDateFilter('');
    setArrivalDateFilter('');
    setSourceFilter('');
    setDestFilter('');
    setSortBy('departure_time');
    setSortOrder('desc');

    // Also reset drafts
    setDraftSearch('');
    setDraftStatus('');
    setDraftDate('');
    setDraftArrivalDate('');
    setDraftSource('');
    setDraftDest('');
    setDraftSortBy('departure_time');
    setDraftSortOrder('desc');

    dispatch(setCurrentPage(1));
    dispatch(fetchFlights({ page: 1, params: buildParams('', '', '', '', '', '', 'departure_time', 'desc') }));
    setFilterOpen(false);
  };

  const handleRemoveFilter = (filterKey) => {
    let nextSearch = activeSearch;
    let nextStatus = statusFilter;
    let nextDate = dateFilter;
    let nextArrivalDate = arrivalDateFilter;
    let nextSource = sourceFilter;
    let nextDest = destFilter;
    let nextSortBy = sortBy;
    let nextSortOrder = sortOrder;

    if (filterKey === 'search') {
      nextSearch = '';
      setSearchInput('');
      setActiveSearch('');
    } else if (filterKey === 'status') {
      nextStatus = '';
      setStatusFilter('');
    } else if (filterKey === 'date') {
      nextDate = '';
      setDateFilter('');
    } else if (filterKey === 'arrivalDate') {
      nextArrivalDate = '';
      setArrivalDateFilter('');
    } else if (filterKey === 'source') {
      nextSource = '';
      setSourceFilter('');
    } else if (filterKey === 'dest') {
      nextDest = '';
      setDestFilter('');
    } else if (filterKey === 'sort') {
      nextSortBy = 'departure_time';
      nextSortOrder = 'desc';
      setSortBy('departure_time');
      setSortOrder('desc');
    }

    dispatch(setCurrentPage(1));
    dispatch(fetchFlights({
      page: 1,
      params: buildParams(nextSearch, nextStatus, nextDate, nextArrivalDate, nextSource, nextDest, nextSortBy, nextSortOrder)
    }));
  };

  const hasActiveFilters = !!(
    activeSearch ||
    statusFilter ||
    dateFilter ||
    arrivalDateFilter ||
    sourceFilter ||
    destFilter ||
    sortBy !== 'departure_time' ||
    sortOrder !== 'desc'
  );

  const handlePageChange = (page) => {
    dispatch(setCurrentPage(page));
    dispatch(fetchFlights({ page, params: buildParams(activeSearch, statusFilter, dateFilter, arrivalDateFilter, sourceFilter, destFilter, sortBy, sortOrder) }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id, flightNumber, airline) => setDeleteTarget({ id, flightNumber, airline });

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { id, flightNumber } = deleteTarget;
    const res = await dispatch(deleteFlight(id));
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(`Flight ${flightNumber} deleted successfully.`);
      dispatch(fetchFlightStats());
      const remainingOnPage = flights.length - 1;
      if (remainingOnPage === 0 && currentPage > 1) {
        handlePageChange(currentPage - 1);
      } else {
        dispatch(fetchFlights({ page: currentPage, params: buildParams(activeSearch, statusFilter, dateFilter, arrivalDateFilter, sourceFilter, destFilter, sortBy, sortOrder) }));
      }
    } else {
      toast.error(`Failed to delete ${flightNumber}.`);
    }
    setDeleteTarget(null);
  };

  // Shared toast handler for both import types
  const handleImportResult = (importPromise, label) => {
    toast.promise(importPromise, {
      loading: `Importing routes from ${label}...`,
      success: (res) => {
        setOpen(false);
        dispatch(fetchFlights({ page: currentPage, params: buildParams(activeSearch, statusFilter, dateFilter, arrivalDateFilter, sourceFilter, destFilter, sortBy, sortOrder) }));
        dispatch(fetchFlightStats());
        if (res.errors && res.errors.length > 0) {
          res.errors.forEach(err => {
            const fields = Object.entries(err.errors)
              .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
              .join('; ');
            toast.error(`Flight ${err.flight_number}: ${fields}`, { duration: 6000 });
          });
          return `Imported ${res.created_count} flight(s). ${res.errors.length} failed.`;
        }
        return `Successfully imported ${res.created_count} flight(s)!`;
      },
      error: (err) => err?.detail || `Failed to import ${label} file.`,
    });
  };

  // Unified handler: detect JSON vs CSV by extension
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) {
      handleImportResult(dispatch(bulkImportFlightsCsv(file)).unwrap(), 'CSV');
    } else if (name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          const dataArray = Array.isArray(parsed) ? parsed : (parsed.flights || null);
          if (!dataArray || !Array.isArray(dataArray)) {
            toast.error('Invalid format. JSON must be a list of flight records.');
            return;
          }
          handleImportResult(dispatch(bulkImportFlights(dataArray)).unwrap(), 'JSON');
        } catch {
          toast.error('Failed to parse file. Ensure it is a valid JSON file.');
        }
      };
      reader.readAsText(file);
    } else {
      toast.error('Unsupported file type. Please upload a .json or .csv file.');
    }
    e.target.value = '';
  };

  return (
    <>
      <style>{`.admin-row:hover{background:rgba(255,255,255,0.5)!important}.add-btn:hover{background:#ffe333!important}.act:hover{background:rgba(0,0,0,0.06)!important}.filter-input:focus{border-color:#705d00!important;box-shadow:0 0 0 3px rgba(112,93,0,0.1)!important}`}</style>
      <div style={{ width: '95%', maxWidth: 1800, margin: '0 auto', padding: '88px 24px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans',Inter,sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', letterSpacing: '-0.02em' }}>Flight Management Console</h1>
            <p style={{ fontSize: 14, color: '#5e5e5e', marginTop: 4 }}>Manage flight routes, seat availabilities, schedules and statuses.</p>
          </div>
          <button className="add-btn" onClick={() => { dispatch(clearFlightErrors()); setOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffd700', color: '#1a1c1d', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,215,0,0.4)', transition: 'background 0.2s' }}>
            <Plus size={18} /> Add Flight Route
          </button>
        </div>

        {/* Stats — sourced from backend, stable across pagination */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 28 }}>
          <Stat label="Total Routes"  value={stats.total}     icon={<Plane size={48} color="#705d00" />}            loading={statsLoading} />
          <Stat label="Scheduled"     value={stats.scheduled} icon={<RefreshCw size={48} color="#059669" />} accent="#059669" loading={statsLoading} />
          <Stat label="Delayed"       value={stats.delayed}   icon={<AlertCircle size={48} color="#d97706" />} accent="#d97706" loading={statsLoading} />
          <Stat label="Cancelled"     value={stats.cancelled} icon={<AlertCircle size={48} color="#dc2626" />} accent="#dc2626" loading={statsLoading} />
        </div>

        {/* Main Control & Search Bar */}
        <div className="glass-card" style={{ borderRadius: 16, padding: '14px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', overflow: 'visible' }}>
          {/* Quick Search */}
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 450 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9e9488', pointerEvents: 'none' }} />
            <input
              className="filter-input"
              type="text"
              placeholder="Search flight no., airline, airport..."
              value={searchInput}
              onChange={handleSearchChange}
              style={{ width: '100%', padding: '10px 16px 10px 40px', background: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 12, fontSize: 14, color: '#1a1c1d', fontFamily: 'Inter,sans-serif', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Filter & Sort Modal Button */}
            <button
              onClick={handleOpenFilters}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#1a1c1d', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; e.currentTarget.style.borderColor = 'rgba(112,93,0,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
            >
              <SlidersHorizontal size={15} color="#705d00" />
              <span>Filters & Sorting</span>
              {hasActiveFilters && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: '50%', background: '#705d00', color: '#fff', fontSize: 10, fontWeight: 700, padding: '0 2px' }}>
                  {
                    (activeSearch ? 1 : 0) +
                    (statusFilter ? 1 : 0) +
                    (dateFilter ? 1 : 0) +
                    (arrivalDateFilter ? 1 : 0) +
                    (sourceFilter ? 1 : 0) +
                    (destFilter ? 1 : 0) +
                    (sortBy !== 'departure_time' || sortOrder !== 'desc' ? 1 : 0)
                  }
                </span>
              )}
            </button>

            {/* Clear All quick button */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                style={{ padding: '10px 16px', background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.15)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#dc2626', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,38,38,0.08)'}
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips / Badges */}
        {hasActiveFilters && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5e5e5e', textTransform: 'uppercase', marginRight: 4 }}>Active Filters:</span>
            {activeSearch && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                <span>Search: "{activeSearch}"</span>
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('search')} />
              </div>
            )}
            {statusFilter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                <span>Status: {statusFilter}</span>
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('status')} />
              </div>
            )}
            {dateFilter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                <span>Departure: {dateFilter}</span>
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('date')} />
              </div>
            )}
            {arrivalDateFilter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                <span>Arrival: {arrivalDateFilter}</span>
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('arrivalDate')} />
              </div>
            )}
            {sourceFilter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                <span>From: {sourceFilter.toUpperCase()}</span>
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('source')} />
              </div>
            )}
            {destFilter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                <span>To: {destFilter.toUpperCase()}</span>
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('dest')} />
              </div>
            )}
            {(sortBy !== 'departure_time' || sortOrder !== 'desc') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                <span>Sort: {sortBy.replace('_', ' ')} ({sortOrder === 'asc' ? 'Asc' : 'Desc'})</span>
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('sort')} />
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#b91c1c', fontSize: 13, marginBottom: 20 }}>
            <AlertCircle size={16} />{error}
          </div>
        )}

        {/* Table */}
        <div className="glass-card" style={{ borderRadius: 20, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(248,250,252,0.9)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <Plane size={48} color="#705d00" className="animate-bounce" />
              <div style={{ marginTop: 24, fontSize: 16, fontWeight: 600, color: '#1a1c1d', fontFamily: "'Plus Jakarta Sans',Inter,sans-serif" }}>Fetching flight details...</div>
            </div>
          ) : flights.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <Plane size={44} color="#d0c6ab" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontWeight: 700, fontSize: 16, color: '#5e5e5e' }}>
                {hasActiveFilters ? 'No flights match your filters.' : 'No flights registered yet.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {['Flight No.', 'Airline / Aircraft', 'Route', 'Times (Dep / Arr)', 'Fare (INR)', 'Seats', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '14px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flights.map(f => (
                    <tr key={f.id} className="admin-row" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px', fontWeight: 800, fontSize: 14, color: '#1a1c1d', whiteSpace: 'nowrap' }}>{f.flight_number}</td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1c1d' }}>{f.airline}</div>
                        <div style={{ fontSize: 12, color: '#5e5e5e', marginTop: 2 }}>{f.aircraft}</div>
                      </td>
                      <td style={{ padding: '16px', fontWeight: 700, fontSize: 14, color: '#1a1c1d', whiteSpace: 'nowrap' }}>
                        {f.source_airport}<span style={{ color: '#705d00', margin: '0 4px' }}>→</span>{f.destination_airport}
                      </td>
                      <td style={{ padding: '16px', fontSize: 12, color: '#5e5e5e', lineHeight: 1.7 }}>
                        <div>Dep: {fmtDT(f.departure_time)}</div>
                        <div>Arr: {fmtDT(f.arrival_time)}</div>
                      </td>
                      <td style={{ padding: '16px', fontWeight: 700, fontSize: 14, color: '#1a1c1d', whiteSpace: 'nowrap' }}>{INR(f.base_fare)}</td>
                      <td style={{ padding: '16px', fontSize: 13 }}>
                        <span style={{ fontWeight: 700, color: '#1a1c1d' }}>{f.available_seats}</span>
                        <span style={{ color: '#5e5e5e' }}> / {f.total_seats}</span>
                      </td>
                      <td style={{ padding: '16px' }}><Badge status={f.status} /></td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Link to={`/admin/flights/${f.id}`} className="act" title="View" style={{ padding: 8, borderRadius: 8, color: '#5e5e5e', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}><Eye size={16} /></Link>
                          <Link to={`/admin/flights/${f.id}/edit`} className="act" title="Edit" style={{ padding: 8, borderRadius: 8, color: '#5e5e5e', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}><Edit2 size={16} /></Link>
                          <button className="act" onClick={() => handleDelete(f.id, f.flight_number, f.airline)} title="Delete" style={{ padding: 8, borderRadius: 8, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && flights.length > 0 && (
            <div style={{ padding: '0 20px 20px' }}>
              <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={count} pageSize={10} onPageChange={handlePageChange} />
            </div>
          )}
        </div>

        {/* Add Flight Modal */}
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Add Flight Route">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '8px 4px' }}>
            <p style={{ fontSize: 14, color: '#5e5e5e', margin: 0, textAlign: 'center' }}>
              Choose how you want to register new flight routes in the system.
            </p>

            {/* Manual — full width */}
            <div className="glass-card" style={{ borderRadius: 16, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, border: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(112,93,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={22} color="#705d00" />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', margin: 0 }}>Add Manually</h3>
                  <p style={{ fontSize: 12, color: '#5e5e5e', margin: '2px 0 0', lineHeight: 1.4 }}>Fill out a form to create a single flight route.</p>
                </div>
              </div>
              <button
                onClick={() => { setOpen(false); navigate('/admin/flights/new'); }}
                style={{ flexShrink: 0, background: '#1a1c1d', color: '#ffd700', fontWeight: 700, fontSize: 13, padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#2a2d2e'}
                onMouseLeave={e => e.currentTarget.style.background = '#1a1c1d'}
              >
                Create
              </button>
            </div>

            {/* Single combined import card */}
            <div className="glass-card" style={{ borderRadius: 16, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, border: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(112,93,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UploadCloud size={22} color="#705d00" />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1d', margin: 0 }}>Import JSON / CSV</h3>
                  <p style={{ fontSize: 12, color: '#5e5e5e', margin: '2px 0 0', lineHeight: 1.4 }}>Upload a <strong>.json</strong> array or a <strong>.csv</strong> file — format is detected automatically.</p>
                </div>
              </div>
              <input type="file" accept=".json,.csv" onChange={handleImport} style={{ display: 'none' }} id="import-file-input" />
              <label
                htmlFor="import-file-input"
                style={{ flexShrink: 0, background: '#ffd700', color: '#1a1c1d', fontWeight: 700, fontSize: 13, padding: '10px 20px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', boxShadow: '0 2px 8px rgba(255,215,0,0.2)', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#ffe333'}
                onMouseLeave={e => e.currentTarget.style.background = '#ffd700'}
              >
                Upload File
              </label>
            </div>
          </div>
        </Modal>

        {/* Advanced Filters & Sorting Modal */}
        <Modal isOpen={filterOpen} onClose={() => setFilterOpen(false)} title="Filters & Sorting">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px 4px', maxHeight: '70vh', overflowY: 'auto' }} className="sidebar-scroll">
            
            {/* Sorting Section */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e', marginBottom: 8 }}>Sort Routes By</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Select
                  options={[
                    { value: 'departure_time', label: 'Departure Time' },
                    { value: 'arrival_time', label: 'Arrival Time' },
                    { value: 'base_fare', label: 'Base Fare' },
                    { value: 'flight_number', label: 'Flight Number' },
                    { value: 'airline', label: 'Airline' },
                    { value: 'status', label: 'Status' }
                  ]}
                  value={draftSortBy}
                  onChange={(e) => setDraftSortBy(e.target.value)}
                />
                <Select
                  options={[
                    { value: 'asc', label: 'Ascending' },
                    { value: 'desc', label: 'Descending' }
                  ]}
                  value={draftSortOrder}
                  onChange={(e) => setDraftSortOrder(e.target.value)}
                />
              </div>
            </div>

            {/* Flight Search */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e', marginBottom: 6 }}>Search Query</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9e9488', pointerEvents: 'none' }} />
                <input
                  className="filter-input"
                  type="text"
                  placeholder="Flight no., airline, airport..."
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'rgba(255,255,255,0.65)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 10, fontSize: 14, color: '#1a1c1d', fontFamily: 'Inter,sans-serif', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Routing Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e', marginBottom: 6 }}>Source Airport (IATA)</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9e9488', pointerEvents: 'none' }} />
                  <input
                    className="filter-input"
                    type="text"
                    placeholder="e.g. BOM"
                    maxLength={5}
                    value={draftSource}
                    onChange={(e) => setDraftSource(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'rgba(255,255,255,0.65)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 10, fontSize: 14, color: '#1a1c1d', fontFamily: 'Inter,sans-serif', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e', marginBottom: 6 }}>Destination Airport (IATA)</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9e9488', pointerEvents: 'none' }} />
                  <input
                    className="filter-input"
                    type="text"
                    placeholder="e.g. DEL"
                    maxLength={5}
                    value={draftDest}
                    onChange={(e) => setDraftDest(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'rgba(255,255,255,0.65)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 10, fontSize: 14, color: '#1a1c1d', fontFamily: 'Inter,sans-serif', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* Status and Dates */}
            <div>
              <Select
                label="Flight Status"
                options={STATUS_OPTIONS}
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <DatePicker
                  label="Departure Date"
                  placeholder="Any date"
                  value={draftDate}
                  onChange={(val) => setDraftDate(val)}
                />
              </div>
              <div>
                <DatePicker
                  label="Arrival Date"
                  placeholder="Any date"
                  value={draftArrivalDate}
                  onChange={(val) => setDraftArrivalDate(val)}
                />
              </div>
            </div>

            {/* Space to allow DatePicker calendar dropdowns to render without causing scroll cuts */}
            <div style={{ height: 180 }} />

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
              <button
                onClick={handleClearFilters}
                style={{ padding: '10px 18px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#5e5e5e', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
              >
                Reset All
              </button>
              <button
                onClick={handleApplyFilters}
                style={{ padding: '10px 22px', background: '#1a1c1d', color: '#ffd700', fontWeight: 700, fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#2a2d2e'}
                onMouseLeave={e => e.currentTarget.style.background = '#1a1c1d'}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </Modal>

        {/* Delete confirmation */}
        <DeleteFlightDialog
          open={!!deleteTarget}
          flightNumber={deleteTarget?.flightNumber}
          airline={deleteTarget?.airline}
          loading={actionLoading}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </>
  );
}
