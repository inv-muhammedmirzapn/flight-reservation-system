/**
 * FlightInstancesPage — list + create/edit form.
 * On selecting a flight_id, auto-suggests scheduled_departure/arrival from the route's first/last leg.
 * aircraft_id dropdown is filtered to aircraft owned by the flight's airline.
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import DateTimePicker from '@/components/ui/DateTimePicker';
import {
  fetchFlightInstances, fetchFlightInstanceDetail, addFlightInstance,
  updateFlightInstance, removeFlightInstance,
  fetchFlightRoutes, fetchAircraft,
} from '@/store/adminSlices';
import { fetchWithAuth } from '@/services/apiClient';
import {
  Plus, Pencil, Trash2, Save, X, AlertCircle, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'DELAYED', label: 'Delayed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'BOARDING', label: 'Boarding' },
  { value: 'DEPARTED', label: 'Departed' },
  { value: 'ARRIVED', label: 'Arrived' },
];

const EMPTY_FORM = {
  flight: '', date: '', aircraft: '', status: 'SCHEDULED',
  scheduled_departure: '', scheduled_arrival: '',
  boarding_gate: '', departure_terminal: '', arrival_terminal: '',
  checkin_open: '', boarding_time: '',
};

const STATUS_COLORS = {
  SCHEDULED: '#3b82f6', DELAYED: '#f59e0b', CANCELLED: '#ef4444',
  BOARDING: '#8b5cf6', DEPARTED: '#22c55e', ARRIVED: '#14b8a6',
};

export default function FlightInstancesPage() {
  const dispatch = useDispatch();
  const { items: instances, loading, actionLoading, count, error, validationErrors } = useSelector((s) => s.flightInstance);
  const { items: routes } = useSelector((s) => s.flightRoute);
  const { items: allAircraft } = useSelector((s) => s.aircraft);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [localErrors, setLocalErrors] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = (s, p) => dispatch(fetchFlightInstances({ search: s, page: p, page_size: PAGE_SIZE }));

  useEffect(() => {
    load(search, page);
    dispatch(fetchFlightRoutes({ page_size: 500 }));
    dispatch(fetchAircraft({ page_size: 500 }));
  }, []);

  // Auto-suggest times when flight selected
  const handleFlightChange = async (flightId) => {
    setForm((f) => ({ ...f, flight: flightId, aircraft: '' }));
    if (!flightId) return;
    try {
      const data = await fetchWithAuth(`/flights/v2/flight-routes/${flightId}/`);
      const legs = data.legs || [];
      if (legs.length > 0) {
        const firstLeg = legs[0];
        const lastLeg = legs[legs.length - 1];
        setForm((f) => ({
          ...f,
          flight: flightId,
          scheduled_departure: firstLeg.scheduled_departure || '',
          scheduled_arrival: lastLeg.scheduled_arrival || '',
        }));
      }
    } catch (_) {}
  };

  // Filter aircraft by airline matching selected route's airline
  const selectedRoute = routes.find((r) => String(r.id) === String(form.flight));
  const filteredAircraft = selectedRoute
    ? allAircraft.filter((ac) => String(ac.airline) === String(selectedRoute.airline))
    : allAircraft;

  const routeOptions = routes.map((r) => ({ value: r.id, label: `${r.flight_no} (${r.airline_name || r.airline})` }));
  const aircraftOptions = filteredAircraft.map((a) => ({ value: a.id, label: `${a.registration} – ${a.model_display || ''}` }));

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setLocalErrors({}); setShowForm(true); };
  const openEdit = (inst) => {
    setEditId(inst.id);
    setForm({
      flight: inst.flight, date: inst.date, aircraft: inst.aircraft, status: inst.status,
      scheduled_departure: inst.scheduled_departure || '',
      scheduled_arrival: inst.scheduled_arrival || '',
      boarding_gate: inst.boarding_gate || '',
      departure_terminal: inst.departure_terminal || '',
      arrival_terminal: inst.arrival_terminal || '',
      checkin_open: inst.checkin_open || '',
      boarding_time: inst.boarding_time || '',
    });
    setLocalErrors({});
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); };

  const validateForm = () => {
    const e = {};
    if (!form.flight) e.flight = 'Flight route is required.';
    if (!form.date) e.date = 'Date is required.';
    if (!form.aircraft) e.aircraft = 'Aircraft is required.';
    if (!form.scheduled_departure) e.scheduled_departure = 'Scheduled departure is required.';
    if (!form.scheduled_arrival) e.scheduled_arrival = 'Scheduled arrival is required.';
    if (form.scheduled_departure && form.scheduled_arrival) {
      if (new Date(form.scheduled_arrival) <= new Date(form.scheduled_departure)) {
        e.scheduled_arrival = 'Arrival must be after departure.';
      }
    }
    setLocalErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) { toast.error('Fix validation errors.'); return; }
    const promise = editId
      ? dispatch(updateFlightInstance({ id: editId, data: form })).unwrap()
      : dispatch(addFlightInstance(form)).unwrap();
    toast.promise(promise, {
      loading: editId ? 'Updating…' : 'Creating…',
      success: () => { closeForm(); load(search, page); return 'Flight instance saved!'; },
      error: (err) => err?.non_field_errors?.[0] || 'Failed to save.',
    });
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this instance?')) return;
    toast.promise(dispatch(removeFlightInstance(id)).unwrap(), {
      loading: 'Deleting…', success: 'Deleted.', error: 'Failed.',
    });
  };

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 24px 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', margin: 0 }}>Flight Instances</h1>
            <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{count} total instances</p>
          </div>
          <button className="btn-primary" onClick={openCreate} id="add-fi-btn"><Plus size={15} /> Add Instance</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(search, 1); }} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by flight number…"
              style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', fontSize: 13, outline: 'none', background: 'rgba(255,255,255,0.8)' }} />
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '9px 16px' }}>Search</button>
        </form>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', color: '#b91c1c', marginBottom: 20, fontSize: 13 }}>
            <AlertCircle size={15} /><span>{String(error)}</span>
          </div>
        )}

        <div className="admin-card admin-table-wrap">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 36, height: 36, border: '3px solid rgba(112,93,0,0.15)', borderTopColor: '#705d00', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            </div>
          ) : instances?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#888', fontSize: 14 }}>No instances. Create one above.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr><th>Flight No</th><th>Date</th><th>Aircraft</th><th>Status</th><th>Departure</th><th>Arrival</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {instances.map((inst) => (
                    <tr key={inst.id}>
                      <td><strong>{inst.flight_no}</strong></td>
                      <td>{inst.date}</td>
                      <td>{inst.aircraft_registration}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: STATUS_COLORS[inst.status] + '20', color: STATUS_COLORS[inst.status] }}>
                          {inst.status}
                        </span>
                      </td>
                      <td>{inst.scheduled_departure ? new Date(inst.scheduled_departure).toLocaleString() : '—'}</td>
                      <td>{inst.scheduled_arrival ? new Date(inst.scheduled_arrival).toLocaleString() : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-secondary" onClick={() => openEdit(inst)}><Pencil size={13} /> Edit</button>
                          <Link to={`/admin/operations/fares?instance=${inst.id}`} className="btn-secondary">Fares</Link>
                          <Link to={`/admin/operations/seat-map?instance=${inst.id}`} className="btn-secondary">Seats</Link>
                          <Link to={`/admin/operations/meals?instance=${inst.id}`} className="btn-secondary">Meals</Link>
                          <button className="btn-danger" onClick={() => handleDelete(inst.id)}><Trash2 size={13} /> Delete</button>
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
            <button className="btn-secondary" disabled={page === 1} onClick={() => { setPage(page - 1); load(search, page - 1); }}><ChevronLeft size={15} /> Prev</button>
            <span style={{ lineHeight: '34px', fontSize: 13, color: '#888' }}>Page {page} / {totalPages}</span>
            <button className="btn-secondary" disabled={page === totalPages} onClick={() => { setPage(page + 1); load(search, page + 1); }}>Next <ChevronRight size={15} /></button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editId ? 'Edit Instance' : 'Add Instance'}
              </h2>
              <button className="btn-icon" onClick={closeForm}><X size={16} /></button>
            </div>

            {validationErrors?.non_field_errors && (
              <div style={{ display: 'flex', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', color: '#b91c1c', marginBottom: 18, fontSize: 13 }}>
                <AlertCircle size={15} /><span>{validationErrors.non_field_errors.join(', ')}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="admin-form-grid" style={{ marginBottom: 20 }}>
                <Select id="fi_flight" label="Flight Route" options={routeOptions} value={form.flight}
                  onChange={(e) => handleFlightChange(e.target.value)} error={localErrors.flight} />
                <Input id="fi_date" label="Date" type="date" value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} error={localErrors.date} />
                <Select id="fi_aircraft" label="Aircraft (filtered by airline)" options={aircraftOptions}
                  value={form.aircraft} onChange={(e) => setForm((f) => ({ ...f, aircraft: e.target.value }))}
                  error={localErrors.aircraft} />
                <Select id="fi_status" label="Status" options={STATUS_OPTIONS} value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} />
              </div>

              <div className="admin-form-grid" style={{ marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5e5e5e', display: 'block', marginBottom: 6 }}>Scheduled Departure</label>
                  <DateTimePicker value={form.scheduled_departure} onChange={(iso) => setForm((f) => ({ ...f, scheduled_departure: iso }))} />
                  {localErrors.scheduled_departure && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{localErrors.scheduled_departure}</p>}
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5e5e5e', display: 'block', marginBottom: 6 }}>Scheduled Arrival</label>
                  <DateTimePicker value={form.scheduled_arrival} onChange={(iso) => setForm((f) => ({ ...f, scheduled_arrival: iso }))} />
                  {localErrors.scheduled_arrival && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{localErrors.scheduled_arrival}</p>}
                </div>
                <Input id="fi_gate" label="Boarding Gate" placeholder="e.g. G12" value={form.boarding_gate}
                  onChange={(e) => setForm((f) => ({ ...f, boarding_gate: e.target.value }))} />
                <Input id="fi_dep_term" label="Departure Terminal" placeholder="e.g. T1" value={form.departure_terminal}
                  onChange={(e) => setForm((f) => ({ ...f, departure_terminal: e.target.value }))} />
                <Input id="fi_arr_term" label="Arrival Terminal" placeholder="e.g. T2" value={form.arrival_terminal}
                  onChange={(e) => setForm((f) => ({ ...f, arrival_terminal: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 32 }}>
                <button type="button" className="btn-secondary" onClick={closeForm}><X size={14} /> Cancel</button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  <Save size={14} /> {actionLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
