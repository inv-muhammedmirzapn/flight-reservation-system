/**
 * FlightRoutesPage — list + create/edit form for FlightRoute with dynamic nested Flight Leg rows.
 * leg_order is auto-assigned by row position.
 * Cross-row layover validation: each leg's departure must be after prev leg's arrival.
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Input } from '@/components/ui/Input';
import '@/styles/admin-system.css';
import { Select } from '@/components/ui/Select';
import DateTimePicker from '@/components/ui/DateTimePicker';
import {
  fetchFlightRoutes, fetchFlightRouteDetail, addFlightRoute, updateFlightRoute, removeFlightRoute,
  fetchAirlines, fetchAirports,
  flightRouteActions,
} from '@/store/adminSlices';
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

  const handleSubmit = (e) => {
    e.preventDefault();
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

    toast.promise(promise, {
      loading: editId ? 'Updating flight route…' : 'Creating flight route…',
      success: () => { closeForm(); load(search, page); return 'Flight route saved!'; },
      error: (err) => {
        if (typeof err === 'string') return err;
        if (err?.flight_no?.[0]) return err.flight_no[0];
        if (err?.non_field_errors?.[0]) return err.non_field_errors[0];
        if (err && typeof err === 'object') {
          const firstVal = Object.values(err)[0];
          if (Array.isArray(firstVal) && firstVal.length > 0) return firstVal[0];
          if (typeof firstVal === 'string') return firstVal;
        }
        return 'Failed to save.';
      },
    });
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
      <style>{`
        .leg-row { background:rgba(112,93,0,0.04); border:1px solid rgba(112,93,0,0.12);
          border-radius:12px; padding:16px; margin-bottom:12px; }
        .leg-airports-row { display:grid; grid-template-columns:1fr auto 1fr; gap:8px; align-items:end; margin-bottom:12px; }
        .leg-arrow { display:flex; align-items:center; justify-content:center; padding-bottom:8px; color:#999; font-size:18px; line-height:1; }
        .leg-details-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:600px){ .leg-airports-row { grid-template-columns:1fr; } .leg-arrow { display:none; } .leg-details-row { grid-template-columns:1fr; } }
      `}</style>

      <div style={{ width: '95%', maxWidth: 1800, margin: '0 auto', padding: '88px 24px 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', margin: 0 }}>
              Flight Routes
            </h1>
            <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{count} total routes</p>
          </div>
          <button className="btn-primary" onClick={openCreate} id="add-flight-route-btn">
            <Plus size={15} /> Add Route
          </button>
        </div>

        {/* Search */}
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(search, 1); }} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by flight number…"
              style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', fontSize: 13, outline: 'none', background: 'rgba(255,255,255,0.8)' }} />
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '9px 16px' }}>Search</button>
        </form>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '14px 18px', color: '#b91c1c', marginBottom: 20, fontSize: 13 }}>
            <AlertCircle size={16} /><span>{typeof error === 'string' ? error : JSON.stringify(error)}</span>
          </div>
        )}

        {/* Table */}
        <div className="admin-card admin-table-wrap">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 36, height: 36, border: '3px solid rgba(112,93,0,0.15)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            </div>
          ) : routes?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#888', fontSize: 14 }}>No flight routes yet. Click &ldquo;Add Route&rdquo; to create one.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Flight No</th><th>Airline</th><th>Legs & Duration</th>
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
                          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 6, marginBottom: 4 }}>
                            {i > 0 && (
                              <span style={{ fontSize: 10, color: '#888', background: 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: 4 }}>
                                Layover {formatMins(leg.layover_duration_minutes)}
                              </span>
                            )}
                            <span style={{ fontSize: 11, background: 'rgba(112,93,0,0.08)', borderRadius: 6, padding: '3px 8px', fontWeight: 600 }}>
                              {leg.departure_airport_iata || leg.departure_airport} → {leg.arrival_airport_iata || leg.arrival_airport}
                              <span style={{ color: '#666', fontWeight: 400, marginLeft: 4 }}>
                                ({formatMins(leg.flight_duration_minutes)})
                              </span>
                            </span>
                          </span>
                        ))}
                      </td>
                      <td>{r.baggage_weight_allowed_per_person}</td>
                      <td>{r.handbag_weight_allowed_per_person}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-secondary" onClick={() => openEdit(r)}><Pencil size={13} /> Edit</button>
                          <button className="btn-danger" onClick={() => handleDelete(r.id)}><Trash2 size={13} /> Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <div style={{ display: 'flex', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px', color: '#b91c1c', marginBottom: 18, fontSize: 13 }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {typeof validationErrors === 'string' ? (
                    <span>{validationErrors}</span>
                  ) : (
                    Object.entries(validationErrors).map(([key, val]) => {
                      const msg = Array.isArray(val) ? val.join(', ') : String(val);
                      return (
                        <div key={key}>
                          <strong style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}:</strong> {msg}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* General */}
              <div className="admin-form-grid" style={{ marginBottom: 20 }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label htmlFor="flight_no" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e' }}>
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
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: ACCENT, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={14} /> Flight Legs
                  </h3>
                  <button type="button" className="btn-secondary" onClick={addLeg} style={{ fontSize: 12, padding: '5px 10px' }}>
                    <PlusCircle size={13} /> Add Leg
                  </button>
                </div>
                {localErrors.legs && <p style={{ fontSize: 12, color: '#b91c1c', marginBottom: 8 }}>{localErrors.legs}</p>}

                {form.legs.map((leg, i) => (
                  <div key={i} className="leg-row">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Leg {i + 1}</span>
                      {form.legs.length > 1 && (
                        <button type="button" onClick={() => removeLeg(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 32 }}>
                <button type="button" className="btn-secondary" onClick={closeForm}><X size={14} /> Cancel</button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  <Save size={14} /> {actionLoading ? 'Saving…' : 'Save Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
