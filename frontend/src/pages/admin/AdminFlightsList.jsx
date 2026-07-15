import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchFlights, addFlight, updateFlight, clearFlightErrors, deleteFlight, setCurrentPage } from '../../store/flightSlice';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Plus, Edit2, Eye, Plane, RefreshCw, AlertCircle, ShieldAlert, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DeleteFlightDialog } from '../../components/ui/DeleteFlightDialog';
import { Pagination } from '../../components/ui/Pagination';

const INR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
const fmtDT = (iso) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

const EMPTY = { flight_number: '', airline: '', aircraft: '', source_airport: '', destination_airport: '', departure_time: '', arrival_time: '', base_fare: '', total_seats: '', available_seats: '', status: 'SCHEDULED' };
const STATUS_OPTS = [
  { value: 'SCHEDULED', label: 'Scheduled' }, { value: 'DELAYED', label: 'Delayed' },
  { value: 'CANCELLED', label: 'Cancelled' }, { value: 'BOARDING', label: 'Boarding' },
  { value: 'DEPARTED', label: 'Departed' }, { value: 'ARRIVED', label: 'Arrived' },
];
const STATUS_STYLE = {
  SCHEDULED: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  DELAYED: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  CANCELLED: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  BOARDING: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  DEPARTED: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  ARRIVED: { bg: '#f3e8ff', color: '#7c3aed', border: '#d8b4fe' },
};

function Badge({ status }) {
  const s = STATUS_STYLE[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 9999, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{status}</span>;
}

function Stat({ label, value, icon, accent }) {
  return (
    <div className="glass-card" style={{ borderRadius: 20, padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#5e5e5e', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: accent || '#1a1c1d', fontFamily: "'Plus Jakarta Sans',Inter,sans-serif" }}>{value}</div>
      </div>
      <div style={{ opacity: 0.18 }}>{icon}</div>
    </div>
  );
}

function Err({ msg }) { return msg ? <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4, paddingLeft: 4 }}>{msg}</p> : null; }

export default function AdminFlightsList() {
  const dispatch = useDispatch();
  const { list: flights, count, currentPage, totalPages, loading, actionLoading, validationErrors, error } = useSelector(s => s.flights);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, flightNumber, airline }

  useEffect(() => {
    dispatch(clearFlightErrors());
    dispatch(fetchFlights(currentPage));
    return () => {
      dispatch(clearFlightErrors());
    };
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageChange = (page) => {
    dispatch(setCurrentPage(page));
    dispatch(fetchFlights(page));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAdd = () => { dispatch(clearFlightErrors()); setErrs({}); setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (f) => {
    dispatch(clearFlightErrors()); setErrs({});
    setForm({ flight_number: f.flight_number, airline: f.airline, aircraft: f.aircraft, source_airport: f.source_airport, destination_airport: f.destination_airport, departure_time: f.departure_time.substring(0, 16), arrival_time: f.arrival_time.substring(0, 16), base_fare: f.base_fare, total_seats: f.total_seats, available_seats: f.available_seats, status: f.status });
    setEditId(f.id); setOpen(true);
  };

  const handleDelete = (id, flightNumber, airline) => {
    setDeleteTarget({ id, flightNumber, airline });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { id, flightNumber } = deleteTarget;
    const res = await dispatch(deleteFlight(id));
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(`Flight ${flightNumber} deleted successfully.`);
      // If we deleted the last item on a non-first page, go back one page
      const remainingOnPage = flights.length - 1;
      if (remainingOnPage === 0 && currentPage > 1) {
        handlePageChange(currentPage - 1);
      } else {
        dispatch(fetchFlights(currentPage));
      }
    } else {
      toast.error(`Failed to delete ${flightNumber}.`);
    }
    setDeleteTarget(null);
  };

  const onChange = (e) => { const { name, value } = e.target; setForm({ ...form, [name]: value }); if (errs[name]) setErrs({ ...errs, [name]: null }); };

  const validate = () => {
    const e = {};
    if (!form.flight_number.trim()) e.flight_number = 'Required';
    if (!form.airline.trim()) e.airline = 'Required';
    if (!form.aircraft.trim()) e.aircraft = 'Required';
    if (!form.source_airport.trim()) e.source_airport = 'Required';
    else if (form.source_airport.trim().length !== 3) e.source_airport = 'Must be 3 chars';
    if (!form.destination_airport.trim()) e.destination_airport = 'Required';
    else if (form.destination_airport.trim().length !== 3) e.destination_airport = 'Must be 3 chars';
    if (form.source_airport && form.destination_airport && form.source_airport.trim().toUpperCase() === form.destination_airport.trim().toUpperCase()) e.destination_airport = 'Cannot be same as source';
    if (!form.departure_time) e.departure_time = 'Required';
    if (!form.arrival_time) e.arrival_time = 'Required';
    if (form.departure_time && form.arrival_time && new Date(form.arrival_time) <= new Date(form.departure_time)) e.arrival_time = 'Must be after departure';
    const fare = parseFloat(form.base_fare); if (isNaN(fare) || fare < 0) e.base_fare = 'Must be non-negative number';
    const ts = parseInt(form.total_seats, 10), as = parseInt(form.available_seats, 10);
    if (isNaN(ts) || ts < 0) e.total_seats = 'Must be non-negative integer';
    if (isNaN(as) || as < 0) e.available_seats = 'Must be non-negative integer';
    if (!isNaN(ts) && !isNaN(as) && as > ts) e.available_seats = 'Cannot exceed total seats';
    setErrs(e); return Object.keys(e).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault(); if (!validate()) return;
    const payload = { ...form, source_airport: form.source_airport.toUpperCase(), destination_airport: form.destination_airport.toUpperCase(), base_fare: parseFloat(form.base_fare).toFixed(2), total_seats: parseInt(form.total_seats, 10), available_seats: parseInt(form.available_seats, 10) };
    const res = editId ? await dispatch(updateFlight({ id: editId, flightData: payload })) : await dispatch(addFlight(payload));
    if (res.meta.requestStatus === 'fulfilled') {
      setOpen(false);
      // After add, go to page 1 to see new flight; after edit, stay on current page
      const targetPage = editId ? currentPage : 1;
      if (!editId) dispatch(setCurrentPage(1));
      dispatch(fetchFlights(targetPage));
      toast.success(editId ? `Flight ${form.flight_number} updated successfully.` : `Flight ${form.flight_number} added successfully.`);
    } else {
      toast.error(editId ? 'Failed to update flight. Please check the form.' : 'Failed to add flight. Please check the form.');
    }
  };

  return (
    <>
      <style>{`.admin-row:hover{background:rgba(255,255,255,0.5)!important}.add-btn:hover{background:#ffe333!important}.act:hover{background:rgba(0,0,0,0.06)!important}.save-btn:hover{background:#2a2d2e!important}`}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 24px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans',Inter,sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', letterSpacing: '-0.02em' }}>Flight Management Console</h1>
            </div>
            <p style={{ fontSize: 14, color: '#5e5e5e' }}>Manage flight routes, seat availabilities, schedules and statuses.</p>
          </div>
          <button className="add-btn" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffd700', color: '#1a1c1d', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,215,0,0.4)', transition: 'background 0.2s' }}>
            <Plus size={18} /> Add Flight Route
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 28 }}>
          <Stat label="Total Routes" value={count} icon={<Plane size={48} color="#705d00" />} />
          <Stat label="Scheduled" value={flights.filter(f => f.status === 'SCHEDULED').length} icon={<RefreshCw size={48} color="#059669" />} accent="#059669" />
          <Stat label="Delayed" value={flights.filter(f => f.status === 'DELAYED').length} icon={<AlertCircle size={48} color="#d97706" />} accent="#d97706" />
          <Stat label="Cancelled" value={flights.filter(f => f.status === 'CANCELLED').length} icon={<AlertCircle size={48} color="#dc2626" />} accent="#dc2626" />
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#b91c1c', fontSize: 13, marginBottom: 20 }}>
            <AlertCircle size={16} />{error}
          </div>
        )}

        {/* Table */}
        <div className="glass-card" style={{ borderRadius: 20, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <div style={{ width: 44, height: 44, border: '3px solid rgba(112,93,0,0.15)', borderTopColor: '#705d00', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            </div>
          ) : flights.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <Plane size={44} color="#d0c6ab" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontWeight: 700, fontSize: 16, color: '#5e5e5e' }}>No flights registered yet.</p>
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
                          <Link to={`/admin/flights/${f.id}`} className="act" title="View" style={{ padding: 8, borderRadius: 8, color: '#5e5e5e', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}>
                            <Eye size={16} />
                          </Link>
                          <button className="act" onClick={() => openEdit(f)} title="Edit" style={{ padding: 8, borderRadius: 8, color: '#5e5e5e', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}>
                            <Edit2 size={16} />
                          </button>
                          <button className="act" onClick={() => handleDelete(f.id, f.flight_number, f.airline)} title="Delete" style={{ padding: 8, borderRadius: 8, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination bar */}
          {!loading && flights.length > 0 && (
            <div style={{ padding: '0 20px 20px' }}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={count}
                pageSize={10}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>

        {/* Modal */}
        <Modal isOpen={open} onClose={() => setOpen(false)} title={editId ? 'Edit Flight Route' : 'Add Flight Route'}>
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {validationErrors?.non_field_errors && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#b91c1c', fontSize: 13 }}>
                <AlertCircle size={16} />{validationErrors.non_field_errors[0]}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Input id="flight_number" name="flight_number" label="Flight Number" required value={form.flight_number} onChange={onChange} /><Err msg={errs.flight_number || validationErrors?.flight_number?.[0]} /></div>
              <div><Input id="airline" name="airline" label="Airline" required value={form.airline} onChange={onChange} /><Err msg={errs.airline || validationErrors?.airline?.[0]} /></div>
            </div>
            <div><Input id="aircraft" name="aircraft" label="Aircraft Model" required value={form.aircraft} onChange={onChange} /><Err msg={errs.aircraft || validationErrors?.aircraft?.[0]} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Input id="source_airport" name="source_airport" label="From (IATA)" required maxLength={3} value={form.source_airport} onChange={onChange} /><Err msg={errs.source_airport || validationErrors?.source_airport?.[0]} /></div>
              <div><Input id="destination_airport" name="destination_airport" label="To (IATA)" required maxLength={3} value={form.destination_airport} onChange={onChange} /><Err msg={errs.destination_airport || validationErrors?.destination_airport?.[0]} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label htmlFor="departure_time" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e' }}>Departure Time</label>
                <input type="datetime-local" id="departure_time" name="departure_time" value={form.departure_time} onChange={onChange} required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.65)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '9px 13px', fontSize: 14, fontWeight: 500, color: '#1a1c1d', fontFamily: 'Inter,sans-serif', outline: 'none' }}
                  onFocus={e => { e.target.style.borderColor = '#705d00'; e.target.style.boxShadow = '0 0 0 3px rgba(112,93,0,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                />
                <Err msg={errs.departure_time || validationErrors?.departure_time?.[0]} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label htmlFor="arrival_time" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e' }}>Arrival Time</label>
                <input type="datetime-local" id="arrival_time" name="arrival_time" value={form.arrival_time} onChange={onChange} required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.65)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '9px 13px', fontSize: 14, fontWeight: 500, color: '#1a1c1d', fontFamily: 'Inter,sans-serif', outline: 'none' }}
                  onFocus={e => { e.target.style.borderColor = '#705d00'; e.target.style.boxShadow = '0 0 0 3px rgba(112,93,0,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                />
                <Err msg={errs.arrival_time || validationErrors?.arrival_time?.[0]} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><Input id="base_fare" name="base_fare" label="Fare (₹)" type="number" step="0.01" required value={form.base_fare} onChange={onChange} /><Err msg={errs.base_fare || validationErrors?.base_fare?.[0]} /></div>
              <div><Input id="total_seats" name="total_seats" label="Total Seats" type="number" required value={form.total_seats} onChange={onChange} /><Err msg={errs.total_seats || validationErrors?.total_seats?.[0]} /></div>
              <div><Input id="available_seats" name="available_seats" label="Available" type="number" required value={form.available_seats} onChange={onChange} /><Err msg={errs.available_seats || validationErrors?.available_seats?.[0]} /></div>
            </div>
            <Select id="status" name="status" label="Flight Status" options={STATUS_OPTS} value={form.status} onChange={onChange} />
            <button type="submit" disabled={actionLoading} className="save-btn" style={{ width: '100%', background: '#1a1c1d', color: '#ffd700', fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 12, border: 'none', cursor: actionLoading ? 'not-allowed' : 'pointer', marginTop: 8, transition: 'background 0.2s', opacity: actionLoading ? 0.7 : 1 }}>
              {actionLoading ? 'Saving…' : (editId ? '✓ Update Flight Route' : '+ Save Flight Route')}
            </button>
          </form>
        </Modal>

        {/* Delete confirmation dialog */}
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
