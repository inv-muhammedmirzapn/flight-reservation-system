/**
 * FlightRoutesPage — list + create/edit form for FlightRoute with dynamic nested Flight Leg rows.
 * leg_order is auto-assigned by row position.
 * Cross-row layover validation: each leg's departure must be after prev leg's arrival.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchWithAuth } from '@/services/apiClient';
import { Input } from '@/components/ui/Input';
import '@/admin/_core/styles/admin.css';
import DeleteConfirmationModal from '../../_core/DeleteConfirmationModal';
import { Select } from '@/components/ui/Select';
import {
  fetchFlightRoutes, addFlightRoute, updateFlightRoute, removeFlightRoute,
  flightRouteActions,
  ADMIN_PAGE_SIZE,
} from '@/admin/_core/store/adminSlices';
import { Pagination } from '@/components/ui/Pagination';
import {
  Plus, Pencil, Trash2, Save, X, AlertCircle, ChevronRight,
  Search, PlusCircle, MinusCircle, MapPin, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useDeleteAction from '../../_core/hooks/useDeleteAction';
import { SpinnerLoader } from '@/components/ui/Loaders';
import { parseApiError } from '@/utils/errorUtils';

// const ACCENT = '#705d00';
const EMPTY_LEG = { departure_airport: '', arrival_airport: '', flight_duration_minutes: 120, layover_duration_minutes: 0 };

const EMPTY_FORM = {
  flight_no: '', airline: '',
  baggage_weight_allowed_per_person: '20',
  baggage_number_allowed_per_person: '',
  handbag_weight_allowed_per_person: '7',
  legs: [{ ...EMPTY_LEG }],
};

export default function FlightRoutesPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightRoute = searchParams.get('highlightRoute');
  const { items: routes, loading, actionLoading, count, error, validationErrors } = useSelector((s) => s.flightRoute);
  const [airlines, setAirlines] = useState([]);
  const [airports, setAirports] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [localErrors, setLocalErrors] = useState({});
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [isFlightNoFocused, setIsFlightNoFocused] = useState(false);
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const initialPage = isNaN(pageParam) ? 1 : pageParam;
  const [page, setPage] = useState(initialPage);

  const searchSuggestions = useMemo(() => {
    if (!search || search.trim().length < 2 || !routes) return [];
    const q = search.toLowerCase().trim();
    const map = new Map();
    routes.forEach(r => {
      if (r.flight_no?.toLowerCase().includes(q)) map.set(r.flight_no, 'Flight No');
      if (r.airline_name?.toLowerCase().includes(q)) map.set(r.airline_name, 'Airline');
      (r.legs || []).forEach(leg => {
         if (leg.departure_airport_iata?.toLowerCase().includes(q)) map.set(leg.departure_airport_iata, 'Airport Code');
         if (leg.arrival_airport_iata?.toLowerCase().includes(q)) map.set(leg.arrival_airport_iata, 'Airport Code');
      });
    });
    return Array.from(map.entries()).map(([value, category]) => ({ value, category })).slice(0, 5);
  }, [search, routes]);

  const load = useCallback((s, p) => {
    dispatch(fetchFlightRoutes({ search: s, page: p }));
  }, [dispatch]);

  const pageStr = searchParams.get('page') || '1';

  useEffect(() => {
    const p = parseInt(pageStr, 10);
    const resolvedPage = isNaN(p) ? 1 : p;
    setPage(resolvedPage);
    load(activeSearch, resolvedPage);
  }, [pageStr, activeSearch, load]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!searchParams.has('highlightRoute')) return;

      const tableContainer = document.querySelector('.admin-table-wrap');
      if (tableContainer && !tableContainer.contains(e.target)) {
        const isInteractiveModal =
          e.target.closest('.admin-modal') ||
          e.target.closest('.toast') ||
          e.target.closest('.admin-sidebar') ||
          e.target.closest('.admin-navbar') ||
          e.target.closest('nav');
        if (isInteractiveModal) return;

        setSearchParams((prev) => {
          if (!prev.has('highlightRoute')) return prev;
          const nextParams = new URLSearchParams(prev);
          nextParams.delete('highlightRoute');
          return nextParams;
        });
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [searchParams, setSearchParams]);

  const handleRowClick = (e, routeId) => {
    const tag = e.target.tagName.toLowerCase();
    if (
      tag === 'button' ||
      tag === 'a' ||
      tag === 'input' ||
      tag === 'svg' ||
      tag === 'path' ||
      e.target.closest('a') ||
      e.target.closest('button') ||
      e.target.closest('input')
    ) {
      return;
    }
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      const currentHighlight = nextParams.get('highlightRoute');
      if (currentHighlight === String(routeId)) {
        nextParams.delete('highlightRoute');
      } else {
        nextParams.set('highlightRoute', String(routeId));
      }
      return nextParams;
    });
  };

  const loadLookups = () => {
    if (airlines.length === 0) {
      fetchWithAuth('/flights/v2/airlines/?page_size=1000')
        .then((data) => setAirlines(data.results || data || []))
        .catch((err) => console.error('Failed to load airlines lookup:', err));
    }
    if (airports.length === 0) {
      fetchWithAuth('/flights/v2/airports/?page_size=1000')
        .then((data) => setAirports(data.results || data || []))
        .catch((err) => console.error('Failed to load airports lookup:', err));
    }
  };

  const airlineOptions = airlines.map((a) => ({ value: a.id, label: `${a.iata_airline_code} – ${a.airline_name}` }));
  const airportOptions = airports.map((a) => ({ value: a.id, label: `${a.iata_code} – ${a.airport_name}` }));

  const openCreate = () => {
    loadLookups();
    dispatch(flightRouteActions.clearErrors());
    setEditId(null);
    setForm(EMPTY_FORM);
    setLocalErrors({});
    setShowForm(true);
  };

  const openEdit = (route) => {
    loadLookups();
    dispatch(flightRouteActions.clearErrors());
    setEditId(route.id);
    const selectedAirline = airlines.find((a) => String(a.id) === String(route.airline));
    let numericFlightNo = route.flight_no || '';
    if (selectedAirline && selectedAirline.iata_airline_code) {
      const regex = new RegExp(`^${selectedAirline.iata_airline_code}[-]?`, 'i');
      numericFlightNo = numericFlightNo.replace(regex, '');
    }
    setForm({
      flight_no: numericFlightNo,
      airline: route.airline || '',
      baggage_weight_allowed_per_person: route.baggage_weight_allowed_per_person || '20',
      baggage_number_allowed_per_person: route.baggage_number_allowed_per_person ?? '',
      handbag_weight_allowed_per_person: route.handbag_weight_allowed_per_person || '7',
      legs: (route.legs || []).map((leg) => ({
        departure_airport: leg.departure_airport,
        arrival_airport: leg.arrival_airport,
        flight_duration_minutes: leg.flight_duration_minutes || 120,
        layover_duration_minutes: leg.layover_duration_minutes || 0,
      })),
    });
    setLocalErrors({});
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); dispatch(flightRouteActions.clearErrors()); };

  // ─── Leg management ─────────────────────────────────────────────────────────
  const addLeg = () => setForm((f) => {
    const newLeg = { ...EMPTY_LEG };
    if (f.legs.length > 0) {
      const prevLeg = f.legs[f.legs.length - 1];
      newLeg.departure_airport = prevLeg.arrival_airport;
      newLeg.layover_duration_minutes = 60; // 1 hour default layover
    }
    return { ...f, legs: [...f.legs, newLeg] };
  });
  const removeLeg = (i) => setForm((f) => ({ ...f, legs: f.legs.filter((_, idx) => idx !== i) }));
  const updateLeg = (i, key, val) =>
    setForm((f) => ({
      ...f,
      legs: f.legs.map((l, idx) => idx === i ? { ...l, [key]: val } : l),
    }));

  // ─── Validation ──────────────────────────────────────────────────────────────
  const validateForm = () => {
    const e = {};
    if (!form.flight_no || !/^\d+$/.test(form.flight_no.trim())) {
      e.flight_no = 'Flight number must be numeric (e.g., 202).';
    }
    if (!form.airline) e.airline = 'Airline is required.';
    if (form.legs.length === 0) e.legs = 'At least one leg is required.';
    if (Number(form.baggage_weight_allowed_per_person) < 0) e.baggage_weight_allowed_per_person = 'Cannot be negative.';
    if (Number(form.handbag_weight_allowed_per_person) < 0) e.handbag_weight_allowed_per_person = 'Cannot be negative.';

    form.legs.forEach((leg, i) => {
      if (!leg.departure_airport) e[`leg_${i}_dep_apt`] = 'Departure airport required.';
      if (!leg.arrival_airport) e[`leg_${i}_arr_apt`] = 'Arrival airport required.';
      if (leg.departure_airport && leg.arrival_airport && leg.departure_airport === leg.arrival_airport) {
        e[`leg_${i}_arr_apt`] = 'Arrival must differ from departure.';
      }
      if (!leg.flight_duration_minutes || Number(leg.flight_duration_minutes) <= 0) {
        e[`leg_${i}_duration`] = 'Flight duration must be > 0 mins.';
      }
      if (i > 0 && Number(leg.layover_duration_minutes) < 0) {
        e[`leg_${i}_layover`] = 'Layover duration cannot be negative.';
      }
    });

    setLocalErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e, goNext = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateForm()) { toast.error('Fix validation errors.'); return; }

    const selectedAirline = airlines.find((a) => String(a.id) === String(form.airline));
    const prefix = selectedAirline ? `${selectedAirline.iata_airline_code}-` : '';
    const fullFlightNo = `${prefix}${form.flight_no.trim()}`;

    const payload = {
      ...form,
      flight_no: fullFlightNo,
      baggage_weight_allowed_per_person: form.baggage_weight_allowed_per_person ? Number(form.baggage_weight_allowed_per_person) : 20,
      baggage_number_allowed_per_person: form.baggage_number_allowed_per_person ? Number(form.baggage_number_allowed_per_person) : null,
      handbag_weight_allowed_per_person: form.handbag_weight_allowed_per_person ? Number(form.handbag_weight_allowed_per_person) : 7,
      legs: form.legs.map((leg, i) => ({
        ...leg,
        leg_order: i + 1,
        flight_duration_minutes: Number(leg.flight_duration_minutes),
        layover_duration_minutes: i > 0 ? Number(leg.layover_duration_minutes) : 0,
      })),
    };

    let promise;
    if (editId) {
      promise = dispatch(updateFlightRoute({ id: editId, data: payload })).unwrap();
    } else {
      promise = dispatch(addFlightRoute(payload)).unwrap();
    }

    try {
      const res = await promise;
      toast.success('Flight route saved!');
      closeForm();
      const routeId = res?.id || editId;
      if (goNext && routeId) {
        navigate(`/admin/operations/route-fare-classes?route=${routeId}&autoOpen=true&fromPage=${page}`);
      } else {
        load(activeSearch, page);
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to save.'));
    }
  };

  const { deleteItem, setDeleteItem, deleteLoading, confirmDelete } = useDeleteAction({
    thunk: removeFlightRoute,
    onSuccess: () => load(activeSearch, page),
    successMessage: 'Flight route deleted successfully.',
    errorMessage: 'Failed to delete flight route.'
  });

  const formatMins = (mins) => {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}` : `${m}m`;
  };

  const totalPages = count ? Math.ceil(count / ADMIN_PAGE_SIZE) : 1;

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="flex justify-between items-center mb-7">
          <div>
            <h1 className="admin-page-title">Flight Routes</h1>
            <p className="admin-page-subtitle">{count} total routes</p>
          </div>
          <button className="btn-primary" onClick={openCreate} id="add-flight-route-btn">
            <Plus size={15} /> Add Route
          </button>
        </div>

        {/* Search */}
        <form onSubmit={(e) => { e.preventDefault(); setActiveSearch(search); setPage(1); }} className="flex gap-2 mb-5">
          <div className="admin-toolbar-search" style={{ position: 'relative' }}>
            <Search size={14} className="search-icon" />
            <input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="Search by flight number…" 
            />
            {searchFocus && searchSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, maxHeight: 180, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 4 }}>
                {searchSuggestions.map((sug, idx) => (
                  <div
                    key={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearch(sug.value);
                      setActiveSearch(sug.value);
                      setPage(1);
                      setSearchFocus(false);
                    }}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: idx < searchSuggestions.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(112,93,0,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontWeight: 600, color: '#1a1c1d', fontSize: 13 }}>{sug.value}</span>
                    <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{sug.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="submit" className="btn-primary">Search</button>
        </form>

        {error && (
          <div className="admin-error">
            <AlertCircle size={16} /><span>{typeof error === 'string' ? error : JSON.stringify(error)}</span>
          </div>
        )}

        {/* Table */}
        <div className="admin-card admin-table-wrap fr-table">
          {loading ? (
            <SpinnerLoader />
          ) : routes?.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon"><MapPin size={28} /></div>
              <h3>No flight routes yet</h3>
              <p>Click &ldquo;Add Route&rdquo; to create one.</p>
              <button className="btn-primary" onClick={openCreate}><Plus size={14} /> Add Route</button>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Flight No</th><th>Airline</th><th>Legs &amp; Duration</th>
                  <th>Baggage (kg)</th><th>Handbag (kg)</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => {
                  const isHighlighted = String(r.id) === String(highlightRoute);
                  return (
                    <tr
                      key={r.id}
                      onClick={(e) => handleRowClick(e, r.id)}
                      className={`admin-row cursor-pointer ${isHighlighted ? 'admin-row-highlight' : ''}`}
                    >
                    <td><strong>{r.flight_no}</strong></td>
                    <td>{r.airline_name || r.airline}</td>
                    <td className="fr-legs-cell">
                      <div className="flex flex-col gap-1">
                        {(r.legs || []).map((leg, i) => (
                          <div key={i} className="flex flex-col gap-0.5">
                            {i > 0 && (
                              <div className="fr-layover-row flex items-center gap-1 pl-1">
                                <div className="w-px h-3 bg-[#ccc]" />
                                <span className="fr-layover-pill text-[10px] text-[#888] bg-black/5 px-1.5 py-px rounded leading-none">
                                  Layover {formatMins(leg.layover_duration_minutes)}
                                </span>
                              </div>
                            )}
                            <span className="fr-leg-badge text-[11px] bg-[rgba(112,93,0,0.08)] rounded-md px-2 py-0.5 font-semibold whitespace-nowrap w-max">
                              {leg.departure_airport_iata || leg.departure_airport} → {leg.arrival_airport_iata || leg.arrival_airport}
                              <span className="text-[#666] font-normal ml-1">({formatMins(leg.flight_duration_minutes)})</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>{r.baggage_weight_allowed_per_person}</td>
                    <td>{r.handbag_weight_allowed_per_person}</td>
                    <td className="text-right whitespace-nowrap">
                      <div className="flex gap-1.5 items-center justify-end">
                        <button
                          className="btn-secondary"
                          title="Route Fare Templates"
                          onClick={() => navigate(`/admin/operations/route-fare-classes?route=${r.id}&fromPage=${page}`)}
                          style={{ padding: '5px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Tag size={12} className="text-[#705d00]" /> Fares
                        </button>
                        <button className="btn-secondary" title="Edit" onClick={() => openEdit(r)} style={{ padding: '6px 8px' }}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-danger" title="Delete" onClick={() => setDeleteItem(r)} style={{ padding: '6px 8px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={count || routes?.length || 0}
          pageSize={ADMIN_PAGE_SIZE}
          onPageChange={(p) => {
            setSearchParams((prev) => {
              const nextParams = new URLSearchParams(prev);
              nextParams.set('page', String(p));
              return nextParams;
            });
          }}
          entityLabel="routes"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editId ? 'Edit Flight Route' : 'Add Flight Route'}
              </h2>
              <button className="btn-icon" onClick={closeForm}><X size={16} /></button>
            </div>

            {validationErrors && (
              <div className="admin-error">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <div className="flex flex-col gap-1">
                  {typeof validationErrors === 'string' ? (
                    <span>{validationErrors}</span>
                  ) : (
                    Object.entries(validationErrors).map(([key, val]) => {
                      const msg = Array.isArray(val) ? val.join(', ') : String(val);
                      return (
                        <div key={key}>
                          <strong className="capitalize">{key.replace('_', ' ')}:</strong> {msg}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Row 1: Airline + Flight Number */}
              <div className="admin-form-grid" style={{ marginBottom: 16 }}>
                 <Select id="airline" label="Airline" options={airlineOptions} value={form.airline}
                  onChange={(e) => {
                    const airlineId = e.target.value;
                    setForm((f) => ({
                      ...f,
                      airline: airlineId,
                      flight_no: '',
                    }));
                  }}
                  error={localErrors.airline} />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="flight_no" className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e]">
                    Flight Number
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {form.airline ? (() => {
                      const selected = airlines.find((a) => String(a.id) === String(form.airline));
                      if (selected) {
                        return (
                          <div style={{
                            padding: '9px 14px',
                            background: 'rgba(0, 0, 0, 0.04)',
                            border: `1.5px solid ${
                              (localErrors.flight_no || validationErrors?.flight_no)
                                ? '#b91c1c'
                                : (isFlightNoFocused ? '#888888' : 'rgba(0,0,0,0.1)')
                            }`,
                            borderRight: 'none',
                            borderRadius: '10px 0 0 10px',
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#5e5e5e',
                            fontFamily: 'Inter, sans-serif',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            boxSizing: 'border-box',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            {selected.iata_airline_code} -
                          </div>
                        );
                      }
                      return null;
                    })() : null}
                    <input
                      id="flight_no"
                      placeholder={form.airline ? "e.g. 202" : "Select airline first..."}
                      value={form.flight_no}
                      disabled={!!editId || !form.airline}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, ''); // only allow digits
                        setForm((f) => ({ ...f, flight_no: val }));
                      }}
                      onFocus={() => setIsFlightNoFocused(true)}
                      onBlur={() => setIsFlightNoFocused(false)}
                      style={{
                        flex: 1,
                        background: form.airline
                          ? (isFlightNoFocused ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.65)')
                          : 'rgba(0,0,0,0.03)',
                        border: `1.5px solid ${
                          (localErrors.flight_no || validationErrors?.flight_no)
                            ? '#b91c1c'
                            : (isFlightNoFocused ? '#888888' : 'rgba(0,0,0,0.1)')
                        }`,
                        borderLeft: form.airline ? 'none' : undefined,
                        borderRadius: form.airline ? '0 10px 10px 0' : '10px',
                        padding: '9px 13px',
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#1a1c1d',
                        fontFamily: 'Inter, sans-serif',
                        outline: 'none',
                        height: '40px',
                        boxSizing: 'border-box',
                        boxShadow: (localErrors.flight_no || validationErrors?.flight_no)
                          ? (isFlightNoFocused ? '0 0 0 3px rgba(185,28,28,0.18)' : '0 0 0 3px rgba(185,28,28,0.1)')
                          : (isFlightNoFocused ? '0 0 0 3px rgba(0,0,0,0.05)' : 'none'),
                        transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s'
                      }}
                    />
                  </div>
                  {(localErrors.flight_no || validationErrors?.flight_no) && (
                    <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 2, paddingLeft: 2 }}>
                      {localErrors.flight_no || (Array.isArray(validationErrors.flight_no) ? validationErrors.flight_no.join(', ') : validationErrors.flight_no)}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: Baggage Allowance + Baggage Count + Handbag Allowance */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20, alignItems: 'start' }}>
                <div>
                  <Input id="baggage_weight" label="Default Checked Baggage (kg)" type="number"
                    value={form.baggage_weight_allowed_per_person}
                    onChange={(e) => setForm((f) => ({ ...f, baggage_weight_allowed_per_person: e.target.value }))} />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Route default checked baggage limit (e.g. 20 kg).
                  </span>
                </div>
                <div>
                  <Input id="baggage_number" label="Max Checked Pieces (optional)" type="number"
                    value={form.baggage_number_allowed_per_person}
                    placeholder="e.g. 1 or 2"
                    onChange={(e) => setForm((f) => ({ ...f, baggage_number_allowed_per_person: e.target.value }))} />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Maximum number of bags per passenger.
                  </span>
                </div>
                <div>
                  <Input id="handbag_weight" label="Cabin Carry-on Allowance (kg)" type="number"
                    value={form.handbag_weight_allowed_per_person}
                    onChange={(e) => setForm((f) => ({ ...f, handbag_weight_allowed_per_person: e.target.value }))} />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Hand luggage limit per passenger (e.g. 7 kg).
                  </span>
                </div>
              </div>

              {/* Legs */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="m-0 text-[13px] font-bold uppercase tracking-[.06em] text-[#705d00] flex items-center gap-1.5">
                    <MapPin size={14} /> Flight Legs
                  </h3>
                  <button type="button" className="btn-secondary" onClick={addLeg} style={{ fontSize: 12, padding: '5px 10px' }}>
                    <PlusCircle size={13} /> Add Leg
                  </button>
                </div>
                {localErrors.legs && <p className="text-xs text-[#b91c1c] mb-2">{localErrors.legs}</p>}

                {form.legs.map((leg, i) => (
                  <div key={i} className="leg-row">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-[#705d00]">Leg {i + 1}</span>
                      {form.legs.length > 1 && (
                        <button type="button" onClick={() => removeLeg(i)} className="bg-transparent border-none cursor-pointer text-[#b91c1c] p-0">
                          <MinusCircle size={16} />
                        </button>
                      )}
                    </div>
                    {/* Airports row: DEP ──▶ ARR */}
                    <div className="leg-airports-row">
                      <Select id={`dep_apt_${i}`} label="Departure Airport" options={airportOptions}
                        value={leg.departure_airport}
                        onChange={(e) => updateLeg(i, 'departure_airport', e.target.value)}
                        error={localErrors[`leg_${i}_dep_apt`]} />
                      <div className="leg-arrow-container select-none">
                        <div style={{ height: 21 }} />
                        <div className="leg-arrow">→</div>
                      </div>
                      <Select id={`arr_apt_${i}`} label="Arrival Airport" options={airportOptions}
                        value={leg.arrival_airport}
                        onChange={(e) => updateLeg(i, 'arrival_airport', e.target.value)}
                        error={localErrors[`leg_${i}_arr_apt`]} />
                    </div>

                    {/* Duration + Layover row */}
                    <div className="leg-details-row">
                      <Input id={`duration_${i}`} label="Flight Duration (mins)" type="number"
                        placeholder="e.g. 150"
                        value={leg.flight_duration_minutes}
                        onChange={(e) => updateLeg(i, 'flight_duration_minutes', e.target.value)}
                        error={localErrors[`leg_${i}_duration`]} />
                      {i > 0 ? (
                        <Input id={`layover_${i}`} label="Layover Before This Leg (mins)" type="number"
                          placeholder="e.g. 60"
                          value={leg.layover_duration_minutes}
                          onChange={(e) => updateLeg(i, 'layover_duration_minutes', e.target.value)}
                          error={localErrors[`leg_${i}_layover`]} />
                      ) : <div />}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-200 mt-8">
                <button type="button" className="btn-secondary" onClick={closeForm}><X size={14} /> Cancel</button>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn-secondary" disabled={actionLoading} onClick={(e) => handleSubmit(e, false)}>
                    <Save size={14} /> {actionLoading ? 'Saving…' : 'Save'}
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={(e) => handleSubmit(e, true)}
                    className="px-4 py-2 rounded-xl bg-[#705d00] hover:bg-[#5a4b00] text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all border-none"
                  >
                    Save & Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={deleteItem !== null}
        loading={deleteLoading}
        title="Delete Flight Route"
        message="Are you sure you want to delete this flight route?"
        details={deleteItem ? { 'FLIGHT NO': deleteItem.flight_no, AIRLINE: deleteItem.airline_name, ID: deleteItem.id } : null}
        onClose={() => setDeleteItem(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
