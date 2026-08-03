/**
 * FlightRoutesPage — list + create/edit form for FlightRoute with dynamic nested Flight Leg rows.
 * leg_order is auto-assigned by row position.
 * Cross-row layover validation: each leg's departure must be after prev leg's arrival.
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import '@/admin/_core/styles/admin.css';
import { Select } from '@/components/ui/Select';
import DateTimePicker from '@/components/ui/DateTimePicker';
import {
  fetchFlightRoutes, fetchFlightRouteDetail, addFlightRoute, updateFlightRoute, removeFlightRoute,
  fetchAirlines, fetchAirports,
  flightRouteActions,
} from '@/admin/_core/store/adminSlices';
import { Pagination } from '@/components/ui/Pagination';
import {
  Plus, Pencil, Trash2, Save, X, AlertCircle, ChevronLeft, ChevronRight,
  Search, PlusCircle, MinusCircle, MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';

const ACCENT = '#705d00';
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
  const { items: routes, loading, actionLoading, count, error, validationErrors } = useSelector((s) => s.flightRoute);
  const { items: airlines } = useSelector((s) => s.airline);
  const { items: airports } = useSelector((s) => s.airport);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [localErrors, setLocalErrors] = useState({});
  const [search, setSearch] = useState('');
  const [isFlightNoFocused, setIsFlightNoFocused] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const load = (s, p) => dispatch(fetchFlightRoutes({ search: s, page: p, page_size: PAGE_SIZE }));

  useEffect(() => {
    load(search, page);
    dispatch(fetchAirlines({}));
    dispatch(fetchAirports({ page_size: 500 }));
  }, []);

  const airlineOptions = airlines.map((a) => ({ value: a.id, label: `${a.iata_airline_code} – ${a.airline_name}` }));
  const airportOptions = airports.map((a) => ({ value: a.id, label: `${a.iata_code} – ${a.airport_name}` }));

  const openCreate = () => {
    dispatch(flightRouteActions.clearErrors());
    setEditId(null);
    setForm(EMPTY_FORM);
    setLocalErrors({});
    setShowForm(true);
  };

  const openEdit = (route) => {
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
      baggage_number_allowed_per_person: route.baggage_number_allowed_per_person || '',
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
        navigate(`/admin/operations/flight-instances?route=${routeId}&autoCreate=1`);
      } else {
        load(search, page);
      }
    } catch (err) {
      if (typeof err === 'string') toast.error(err);
      else if (err?.flight_no?.[0]) toast.error(err.flight_no[0]);
      else if (err?.non_field_errors?.[0]) toast.error(err.non_field_errors[0]);
      else toast.error('Failed to save.');
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this flight route?')) return;
    toast.promise(dispatch(removeFlightRoute(id)).unwrap(), {
      loading: 'Deleting…',
      success: 'Deleted.',
      error: 'Failed to delete.',
    });
  };

  const formatMins = (mins) => {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}` : `${m}m`;
  };

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <>

      <div className="admin-page-wrap">
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
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(search, 1); }} className="flex gap-2 mb-5">
          <div className="admin-toolbar-search" style={{ flex: 1 }}>
            <Search size={14} className="search-icon" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by flight number…" />
          </div>
          <button type="submit" className="btn-primary">Search</button>
        </form>

        {error && (
          <div className="admin-error">
            <AlertCircle size={16} /><span>{typeof error === 'string' ? error : JSON.stringify(error)}</span>
          </div>
        )}

        {/* Table */}
        <div className="admin-card admin-table-wrap">
          {loading ? (
            <div className="admin-spinner-wrap"><div className="admin-spinner" /></div>
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
                  <th>Baggage (kg)</th><th>Handbag (kg)</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.flight_no}</strong></td>
                    <td>{r.airline_name || r.airline}</td>
                    <td>
                      {(r.legs || []).map((leg, i) => (
                        <span key={i} className="inline-flex items-center gap-1 mr-1.5 mb-1">
                          {i > 0 && (
                            <span className="text-[10px] text-[#888] bg-black/5 px-1.5 py-px rounded">
                              Layover {formatMins(leg.layover_duration_minutes)}
                            </span>
                          )}
                          <span className="text-[11px] bg-[rgba(112,93,0,0.08)] rounded-md px-2 py-0.5 font-semibold">
                            {leg.departure_airport_iata || leg.departure_airport} → {leg.arrival_airport_iata || leg.arrival_airport}
                            <span className="text-[#666] font-normal ml-1">({formatMins(leg.flight_duration_minutes)})</span>
                          </span>
                        </span>
                      ))}
                    </td>
                    <td>{r.baggage_weight_allowed_per_person}</td>
                    <td>{r.handbag_weight_allowed_per_person}</td>
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn-secondary" onClick={() => openEdit(r)}><Pencil size={13} /> Edit</button>
                        <button className="btn-danger" onClick={() => handleDelete(r.id)}><Trash2 size={13} /> Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={count || routes?.length || 0}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => { setPage(p); load(search, p); }}
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
              {/* General */}
              <div className="admin-form-grid mb-5">
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
                <Input id="baggage_weight" label="Baggage Allowance (kg)" type="number"
                  value={form.baggage_weight_allowed_per_person}
                  onChange={(e) => setForm((f) => ({ ...f, baggage_weight_allowed_per_person: e.target.value }))} />
                <Input id="baggage_number" label="Baggage Count (optional)" type="number"
                  value={form.baggage_number_allowed_per_person}
                  onChange={(e) => setForm((f) => ({ ...f, baggage_number_allowed_per_person: e.target.value }))} />
                <Input id="handbag_weight" label="Handbag Allowance (kg)" type="number"
                  value={form.handbag_weight_allowed_per_person}
                  onChange={(e) => setForm((f) => ({ ...f, handbag_weight_allowed_per_person: e.target.value }))} />
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
                      <div className="leg-arrow">→</div>
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
    </>
  );
}
