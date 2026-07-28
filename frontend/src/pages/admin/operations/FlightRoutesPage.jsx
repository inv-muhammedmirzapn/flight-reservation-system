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
import {
  Plus, Pencil, Trash2, Save, X, AlertCircle, ChevronLeft, ChevronRight,
  Search, PlusCircle, MinusCircle, MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';

const ACCENT = '#705d00';
const EMPTY_LEG = {
  departure_airport: '', arrival_airport: '',
  scheduled_departure: '', scheduled_arrival: '',
};
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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = (s, p) => dispatch(fetchFlightRoutes({ search: s, page: p, page_size: PAGE_SIZE }));

  useEffect(() => {
    load(search, page);
    dispatch(fetchAirlines({}));
    dispatch(fetchAirports({ page_size: 500 }));
  }, []);

  const airlineOptions = airlines.map((a) => ({ value: a.id, label: `${a.iata_airline_code} – ${a.airline_name}` }));
  const airportOptions = airports.map((a) => ({ value: a.id, label: `${a.iata_code} – ${a.airport_name}` }));

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setLocalErrors({});
    setShowForm(true);
  };

  const openEdit = (route) => {
    setEditId(route.id);
    setForm({
      flight_no: route.flight_no || '',
      airline: route.airline || '',
      baggage_weight_allowed_per_person: route.baggage_weight_allowed_per_person || '20',
      baggage_number_allowed_per_person: route.baggage_number_allowed_per_person || '',
      handbag_weight_allowed_per_person: route.handbag_weight_allowed_per_person || '7',
      legs: (route.legs || []).map((leg) => ({
        departure_airport: leg.departure_airport,
        arrival_airport: leg.arrival_airport,
        scheduled_departure: leg.scheduled_departure || '',
        scheduled_arrival: leg.scheduled_arrival || '',
      })),
    });
    setLocalErrors({});
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); };

  // ─── Leg management ─────────────────────────────────────────────────────────
  const addLeg = () => setForm((f) => {
    const newLeg = { ...EMPTY_LEG };
    if (f.legs.length > 0) {
      newLeg.departure_airport = f.legs[f.legs.length - 1].arrival_airport;
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
    if (!form.flight_no) e.flight_no = 'Flight number is required.';
    if (!form.airline) e.airline = 'Airline is required.';
    if (form.legs.length === 0) e.legs = 'At least one leg is required.';

    form.legs.forEach((leg, i) => {
      if (!leg.departure_airport) e[`leg_${i}_dep_apt`] = 'Departure airport required.';
      if (!leg.arrival_airport) e[`leg_${i}_arr_apt`] = 'Arrival airport required.';
      if (!leg.scheduled_departure) e[`leg_${i}_dep_time`] = 'Departure time required.';
      if (!leg.scheduled_arrival) e[`leg_${i}_arr_time`] = 'Arrival time required.';
      if (leg.departure_airport && leg.arrival_airport && leg.departure_airport === leg.arrival_airport) {
        e[`leg_${i}_arr_apt`] = 'Arrival must differ from departure.';
      }
      if (leg.scheduled_departure && leg.scheduled_arrival) {
        if (new Date(leg.scheduled_arrival) <= new Date(leg.scheduled_departure)) {
          e[`leg_${i}_arr_time`] = 'Arrival must be after departure.';
        }
      }
      // Cross-leg layover
      if (i > 0) {
        const prev = form.legs[i - 1];
        if (prev.scheduled_arrival && leg.scheduled_departure) {
          if (new Date(leg.scheduled_departure) < new Date(prev.scheduled_arrival)) {
            e[`leg_${i}_dep_time`] = 'Departure must be after previous leg arrival.';
          }
        }
      }
    });

    setLocalErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) { toast.error('Fix validation errors.'); return; }

    const payload = {
      ...form,
      legs: form.legs.map((leg, i) => ({ ...leg, leg_order: i + 1 })),
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
      error: (err) => err?.non_field_errors?.[0] || 'Failed to save.',
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

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <>
      <style>{`
        .leg-row { background:rgba(112,93,0,0.04); border:1px solid rgba(112,93,0,0.12);
          border-radius:12px; padding:16px; margin-bottom:12px; }
        .leg-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:600px){ .leg-grid { grid-template-columns:1fr; } }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 24px 48px' }}>
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
                    <th>Flight No</th><th>Airline</th><th>Legs</th>
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
                          <span key={i} style={{ fontSize: 11, background: 'rgba(112,93,0,0.08)', borderRadius: 6, padding: '2px 7px', marginRight: 4, display: 'inline-block' }}>
                            {leg.departure_airport_iata || leg.departure_airport} → {leg.arrival_airport_iata || leg.arrival_airport}
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

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            <button className="btn-secondary" disabled={page === 1} onClick={() => { setPage(page - 1); load(search, page - 1); }}>
              <ChevronLeft size={15} /> Prev
            </button>
            <span style={{ lineHeight: '34px', fontSize: 13, color: '#888' }}>Page {page} / {totalPages}</span>
            <button className="btn-secondary" disabled={page === totalPages} onClick={() => { setPage(page + 1); load(search, page + 1); }}>
              Next <ChevronRight size={15} />
            </button>
          </div>
        )}
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

            {validationErrors?.non_field_errors && (
              <div style={{ display: 'flex', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', color: '#b91c1c', marginBottom: 18, fontSize: 13 }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{validationErrors.non_field_errors.join(', ')}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* General */}
              <div className="admin-form-grid" style={{ marginBottom: 20 }}>
                <Input id="flight_no" label="Flight Number" placeholder="e.g. 6E-202" value={form.flight_no}
                  onChange={(e) => setForm((f) => ({ ...f, flight_no: e.target.value }))}
                  error={localErrors.flight_no} disabled={!!editId} />
                <Select id="airline" label="Airline" options={airlineOptions} value={form.airline}
                  onChange={(e) => setForm((f) => ({ ...f, airline: e.target.value }))}
                  error={localErrors.airline} />
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
                    <div className="leg-grid">
                      <Select id={`dep_apt_${i}`} label="Departure Airport" options={airportOptions}
                        value={leg.departure_airport}
                        onChange={(e) => updateLeg(i, 'departure_airport', e.target.value)}
                        error={localErrors[`leg_${i}_dep_apt`]} />
                      <Select id={`arr_apt_${i}`} label="Arrival Airport" options={airportOptions}
                        value={leg.arrival_airport}
                        onChange={(e) => updateLeg(i, 'arrival_airport', e.target.value)}
                        error={localErrors[`leg_${i}_arr_apt`]} />
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5e5e5e', display: 'block', marginBottom: 6 }}>Scheduled Departure</label>
                        <DateTimePicker value={leg.scheduled_departure} onChange={(e) => updateLeg(i, 'scheduled_departure', e.target.value)} />
                        {localErrors[`leg_${i}_dep_time`] && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{localErrors[`leg_${i}_dep_time`]}</p>}
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5e5e5e', display: 'block', marginBottom: 6 }}>Scheduled Arrival</label>
                        <DateTimePicker value={leg.scheduled_arrival} onChange={(e) => updateLeg(i, 'scheduled_arrival', e.target.value)} />
                        {localErrors[`leg_${i}_arr_time`] && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{localErrors[`leg_${i}_arr_time`]}</p>}
                      </div>
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
