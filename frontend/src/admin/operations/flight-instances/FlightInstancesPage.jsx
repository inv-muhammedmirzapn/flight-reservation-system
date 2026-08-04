/**
 * FlightInstancesPage — list + create/edit form.
 * On selecting a flight_id, auto-suggests scheduled_departure/arrival from the route's first/last leg.
 * aircraft_id dropdown is filtered to aircraft owned by the flight's airline.
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '@/admin/_core/styles/admin.css';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ComboInput } from '@/components/ui/ComboInput';
import DateTimePicker from '@/components/ui/DateTimePicker';
import DatePicker from '@/components/ui/DatePicker';
import {
  fetchFlightInstances, fetchFlightInstanceDetail, addFlightInstance,
  updateFlightInstance, removeFlightInstance,
  fetchFlightRoutes, fetchAircraft, fetchAirports,
} from '@/admin/_core/store/adminSlices';
import { fetchWithAuth } from '@/services/apiClient';
import { Pagination } from '@/components/ui/Pagination';
import {
  Plus, Pencil, Trash2, Save, X, AlertCircle, Search, ChevronLeft, ChevronRight,
  Banknote, Armchair, Utensils
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeParam = searchParams.get('route');
  const autoCreate = searchParams.get('autoCreate');

  const { items: instances, loading, actionLoading, count, error, validationErrors } = useSelector((s) => s.flightInstance);
  const { items: routes } = useSelector((s) => s.flightRoute);
  const { items: allAircraft } = useSelector((s) => s.aircraft);
  const { items: airports } = useSelector((s) => s.airport);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [localErrors, setLocalErrors] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const load = (s, p) => dispatch(fetchFlightInstances({ search: s, page: p, page_size: PAGE_SIZE }));

  useEffect(() => {
    load(search, page);
    dispatch(fetchFlightRoutes({ page_size: 500 }));
    dispatch(fetchAircraft({ page_size: 500 }));
    dispatch(fetchAirports({ page_size: 500 }));
  }, []);

  useEffect(() => {
    if (routeParam && autoCreate && routes.length > 0) {
      setEditId(null);
      setForm({ ...EMPTY_FORM, flight: routeParam });
      setLocalErrors({});
      setShowForm(true);
    }
  }, [routeParam, autoCreate, routes]);

  const calculateArrival = (routeObj, depStr) => {
    if (!routeObj || !depStr || !routeObj.legs || routeObj.legs.length === 0) return '';
    const depDate = new Date(depStr);
    if (isNaN(depDate.getTime())) return '';
    const totalMins = routeObj.legs.reduce((acc, leg) => {
      return acc + Number(leg.flight_duration_minutes || 0) + Number(leg.layover_duration_minutes || 0);
    }, 0);
    if (totalMins <= 0) return '';
    const arrDate = new Date(depDate.getTime() + totalMins * 60000);
    const yyyy = arrDate.getFullYear();
    const mm = String(arrDate.getMonth() + 1).padStart(2, '0');
    const dd = String(arrDate.getDate()).padStart(2, '0');
    const hh = String(arrDate.getHours()).padStart(2, '0');
    const mns = String(arrDate.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mns}`;
  };

  // Auto-suggest times when flight selected
  const handleFlightChange = async (flightId) => {
    setForm((f) => {
      const nextForm = { ...f, flight: flightId, aircraft: '' };
      const routeObj = routes.find((r) => String(r.id) === String(flightId));
      if (routeObj && nextForm.scheduled_departure) {
        const computedArr = calculateArrival(routeObj, nextForm.scheduled_departure);
        if (computedArr) nextForm.scheduled_arrival = computedArr;
      }
      return nextForm;
    });
  };

  // Filter aircraft by airline matching selected route's airline
  const selectedRoute = routes.find((r) => String(r.id) === String(form.flight));
  const filteredAircraft = selectedRoute
    ? allAircraft.filter((ac) => String(ac.airline) === String(selectedRoute.airline))
    : allAircraft;

  const routeOptions = routes.map((r) => ({ value: r.id, label: `${r.flight_no} (${r.airline_name || r.airline})` }));
  const aircraftOptions = filteredAircraft.map((a) => ({ value: a.id, label: `${a.registration} – ${a.model_display || ''}` }));

  // Find terminals from departure/arrival airports
  const firstLeg = selectedRoute?.legs?.[0];
  const lastLeg = selectedRoute?.legs?.[(selectedRoute?.legs?.length || 1) - 1];
  const depAirport = airports.find(a => String(a.id) === String(firstLeg?.departure_airport));
  const arrAirport = airports.find(a => String(a.id) === String(lastLeg?.arrival_airport));

  const depTerminalOptions = (depAirport?.terminals || []).map(t => ({ value: t, label: t }));
  const arrTerminalOptions = (arrAirport?.terminals || []).map(t => ({ value: t, label: t }));

  // Gate suggestions from existing instances on the same route, or generic gate list
  const usedGates = [...new Set(
    instances.filter((i) => i.boarding_gate && String(i.flight) === String(form.flight)).map((i) => i.boarding_gate)
  )].map((g) => ({ value: g, label: g }));
  const GENERIC_GATES = ['A1','A2','A3','A4','B1','B2','B3','B4','C1','C2','D1','D2',
    'G1','G2','G3','G4','G5','G6','G10','G11','G12','G13','G14'].map((g) => ({ value: g, label: g }));
  const gateOptions = usedGates.length > 0 ? usedGates : GENERIC_GATES;

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

  // Clear a single field error as soon as the user provides a value
  const clearError = (field) => setLocalErrors(prev => { const e = { ...prev }; delete e[field]; return e; });

  const validateForm = () => {
    const e = {};
    if (!form.flight) e.flight = 'Flight route is required.';
    if (!form.date) {
      e.date = 'Date is required.';
    }
    if (!form.aircraft) e.aircraft = 'Aircraft is required.';
    if (!form.scheduled_departure) e.scheduled_departure = 'Scheduled departure is required.';
    if (!form.scheduled_arrival) e.scheduled_arrival = 'Scheduled arrival is required.';
    if (form.scheduled_departure && form.scheduled_arrival) {
      if (new Date(form.scheduled_arrival) <= new Date(form.scheduled_departure)) {
        e.scheduled_arrival = 'Arrival must be after departure.';
      }
    }
    if (!form.boarding_gate || !form.boarding_gate.trim()) e.boarding_gate = 'Boarding gate is required.';
    if (!form.departure_terminal || !form.departure_terminal.trim()) e.departure_terminal = 'Departure terminal is required.';
    if (!form.arrival_terminal || !form.arrival_terminal.trim()) e.arrival_terminal = 'Arrival terminal is required.';
    setLocalErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e, followUpTarget = null) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateForm()) return; // inline errors already shown via localErrors

    // Optional datetime fields must be null (not empty string "") for the backend
    const OPTIONAL_DATETIMES = ['checkin_open', 'boarding_time', 'actual_departure', 'actual_arrival'];
    const payload = { ...form };
    OPTIONAL_DATETIMES.forEach(field => {
      if (!payload[field]) payload[field] = null;
    });

    const action = editId
      ? updateFlightInstance({ id: editId, data: payload })
      : addFlightInstance(payload);

    try {
      const res = await dispatch(action).unwrap();
      toast.success('Flight instance saved!');
      closeForm();
      const targetId = res?.id || editId;
      if (followUpTarget && targetId) {
        navigate(`/admin/operations/${followUpTarget}?instance=${targetId}`);
      } else {
        load(search, page);
      }
    } catch (err) {
      // DRF field errors come as { fieldName: ["msg", ...] | "msg" }
      // Normalise every value to a plain string so input error props work
      if (err && typeof err === 'object') {
        const normalised = {};
        Object.entries(err).forEach(([key, val]) => {
          if (Array.isArray(val)) normalised[key] = val[0];
          else if (typeof val === 'string') normalised[key] = val;
        });
        setLocalErrors(prev => ({ ...prev, ...normalised }));
        // Show non-field errors (cross-field / global) as a toast only
        if (err.non_field_errors) {
          toast.error(Array.isArray(err.non_field_errors) ? err.non_field_errors[0] : err.non_field_errors);
        } else if (!Object.keys(normalised).length) {
          toast.error('Failed to save. Please try again.');
        }
      } else {
        toast.error('Failed to save. Please try again.');
      }
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this instance?')) return;
    toast.promise(dispatch(removeFlightInstance(id)).unwrap(), {
      loading: 'Deleting…', success: 'Deleted.', error: 'Failed.',
    });
  };

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <>
      <div className="admin-page-wrap">
        {routeParam && (
          <div className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/30 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow">
                1/4
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-blue-600">
                  Instance Setup Flow • Step 1 (Flight Instance)
                </div>
                <div className="text-sm font-bold text-slate-800">
                  Creating Flight Instance for Route #{routeParam}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => navigate(`/admin/operations/fares?route=${routeParam}`)}
                className="px-3.5 py-2 rounded-xl bg-[#705d00] hover:bg-[#5a4b00] text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all border-none"
              >
                Skip / Next: Fares <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/operations/flight-routes')}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-semibold text-xs transition-all border border-slate-200 cursor-pointer"
              >
                Finish Flow
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-7">
          <div>
            <h1 className="admin-page-title">Flight Instances</h1>
            <p className="admin-page-subtitle">{count} total instances</p>
          </div>
          <button className="btn-primary" onClick={openCreate} id="add-fi-btn"><Plus size={15} /> Add Instance</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(search, 1); }} className="flex gap-2 mb-5">
          <div className="admin-toolbar-search" style={{ flex: 1 }}>
            <Search size={14} className="search-icon" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by flight number…"
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => { setSearch(''); setPage(1); load('', 1); }}
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '7px 14px', fontSize: 13 }}>Search</button>
        </form>

        {error && (
          <div className="admin-error">
            <AlertCircle size={15} /><span>{String(error)}</span>
          </div>
        )}

        <div className="admin-card admin-table-wrap">
          {loading ? (
            <div className="admin-spinner-wrap"><div className="admin-spinner" /></div>
          ) : instances?.length === 0 ? (
            <div className="admin-empty"><p>No instances. Create one above.</p></div>
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
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.03)', borderRadius: 8, padding: 2 }}>
                            <Link to={`/admin/operations/fares?instance=${inst.id}`} style={{ padding: '6px 10px', color: '#1a1c1d', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12, fontWeight: 600, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(0,0,0,0.05)'} onMouseLeave={e => e.currentTarget.style.background='transparent'} title="Manage Fares">
                              <Banknote size={13} /> Fares
                            </Link>
                            <Link to={`/admin/operations/seat-map?instance=${inst.id}`} style={{ padding: '6px 10px', color: '#1a1c1d', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12, fontWeight: 600, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(0,0,0,0.05)'} onMouseLeave={e => e.currentTarget.style.background='transparent'} title="Manage Seats">
                              <Armchair size={13} /> Seats
                            </Link>
                            <Link to={`/admin/operations/meals?instance=${inst.id}`} style={{ padding: '6px 10px', color: '#1a1c1d', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12, fontWeight: 600, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(0,0,0,0.05)'} onMouseLeave={e => e.currentTarget.style.background='transparent'} title="Manage Meals">
                              <Utensils size={13} /> Meals
                            </Link>
                          </div>

                          <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
                            <button className="btn-secondary" title="Edit" onClick={() => openEdit(inst)} style={{ padding: '6px 8px' }}>
                              <Pencil size={14} />
                            </button>
                            <button className="btn-danger" title="Delete" onClick={() => handleDelete(inst.id)} style={{ padding: '6px 8px' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
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
          totalCount={count || instances?.length || 0}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => { setPage(p); load(search, p); }}
          entityLabel="instances"
        />
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
              <div className="admin-error">
                <AlertCircle size={15} /><span>{validationErrors.non_field_errors.join(', ')}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="admin-form-grid" style={{ marginBottom: 20 }}>
                <Select id="fi_flight" label="Flight Route" options={routeOptions} value={form.flight}
                  onChange={(e) => { handleFlightChange(e.target.value); clearError('flight'); }} error={localErrors.flight} />
                <Select id="fi_aircraft" label="Aircraft (filtered by airline)" options={aircraftOptions}
                  value={form.aircraft} onChange={(e) => { setForm((f) => ({ ...f, aircraft: e.target.value })); clearError('aircraft'); }}
                  error={localErrors.aircraft} />
                <Select id="fi_status" label="Status" options={STATUS_OPTIONS} value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} />
              </div>

              <div className="admin-form-grid mb-5">
                <div>
                  <label className="text-[11px] font-bold tracking-[.06em] uppercase text-[#5e5e5e] block mb-1.5">Scheduled Departure</label>
                  <DateTimePicker value={form.scheduled_departure} error={localErrors.scheduled_departure} onChange={(e) => {
                    const depTime = e.target.value;
                    const opDate = depTime ? (depTime.includes('T') ? depTime.split('T')[0] : depTime.split(' ')[0]) : '';
                    setForm((f) => {
                      const nextForm = { ...f, scheduled_departure: depTime, date: opDate || f.date };
                      const routeObj = routes.find((r) => String(r.id) === String(f.flight));
                      if (routeObj && depTime) {
                        const computedArr = calculateArrival(routeObj, depTime);
                        if (computedArr) nextForm.scheduled_arrival = computedArr;
                      }
                      return nextForm;
                    });
                    if (depTime) clearError('scheduled_departure');
                  }} />
                  {localErrors.scheduled_departure && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{localErrors.scheduled_departure}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-bold tracking-[.06em] uppercase text-[#5e5e5e] block mb-1.5">Scheduled Arrival</label>
                  <DateTimePicker value={form.scheduled_arrival} error={localErrors.scheduled_arrival} onChange={(e) => {
                    setForm((f) => ({ ...f, scheduled_arrival: e.target.value }));
                    if (e.target.value) clearError('scheduled_arrival');
                  }} />
                  {localErrors.scheduled_arrival && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{localErrors.scheduled_arrival}</p>}
                </div>
                <ComboInput id="fi_gate" label="Boarding Gate" placeholder="e.g. G12"
                  value={form.boarding_gate} options={gateOptions}
                  onChange={(e) => { setForm((f) => ({ ...f, boarding_gate: e.target.value })); if (e.target.value) clearError('boarding_gate'); }}
                  error={localErrors.boarding_gate} />
                <ComboInput id="fi_dep_term" label="Departure Terminal" placeholder="e.g. Terminal 1"
                  value={form.departure_terminal} options={depTerminalOptions}
                  onChange={(e) => { setForm((f) => ({ ...f, departure_terminal: e.target.value })); if (e.target.value) clearError('departure_terminal'); }}
                  error={localErrors.departure_terminal} />
                <ComboInput id="fi_arr_term" label="Arrival Terminal" placeholder="e.g. Terminal 2"
                  value={form.arrival_terminal} options={arrTerminalOptions}
                  onChange={(e) => { setForm((f) => ({ ...f, arrival_terminal: e.target.value })); if (e.target.value) clearError('arrival_terminal'); }}
                  error={localErrors.arrival_terminal} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-200 mt-8">
                <button type="button" className="btn-secondary" onClick={closeForm}><X size={14} /> Cancel</button>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="submit" className="btn-secondary" disabled={actionLoading} onClick={(e) => handleSubmit(e, null)}>
                    <Save size={14} /> {actionLoading ? 'Saving…' : 'Save'}
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={(e) => handleSubmit(e, 'fares')}
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
