import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { fetchFlights, deleteFlight, setCurrentPage, bulkImportFlights, clearFlightErrors } from '../../store/flightSlice';
import { Modal } from '../../components/ui/Modal';
import { Plus, Edit2, Eye, Plane, RefreshCw, AlertCircle, Trash2, UploadCloud, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { DeleteFlightDialog } from '../../components/ui/DeleteFlightDialog';
import { Pagination } from '../../components/ui/Pagination';

const INR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
const fmtDT = (iso) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

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

export default function AdminFlightsList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list: flights, count, currentPage, totalPages, loading, actionLoading, error } = useSelector(s => s.flights);
  const [open, setOpen] = useState(false);
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

  const openAddOptionModal = () => {
    dispatch(clearFlightErrors());
    setOpen(true);
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

  const handleJsonImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const dataArray = Array.isArray(parsed) ? parsed : (parsed.flights || null);

        if (!dataArray || !Array.isArray(dataArray)) {
          toast.error('Invalid format. JSON must be a list of flight records.');
          return;
        }

        const importPromise = dispatch(bulkImportFlights(dataArray)).unwrap();
        toast.promise(importPromise, {
          loading: 'Importing routes from JSON...',
          success: (res) => {
            setOpen(false);
            dispatch(fetchFlights(currentPage));

            if (res.errors && res.errors.length > 0) {
              res.errors.forEach(err => {
                const fields = Object.entries(err.errors)
                  .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
                  .join('; ');
                toast.error(`Flight ${err.flight_number}: ${fields}`, { duration: 6000 });
              });
              return `Successfully imported ${res.created_count} flight(s). ${res.errors.length} flight(s) failed validation.`;
            }

            return `Successfully imported ${res.created_count} flight(s)!`;
          },
          error: (err) => {
            return err?.detail || 'Failed to import JSON file.';
          }
        });
      } catch (err) {
        toast.error('Failed to parse file. Ensure it is a valid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  return (
    <>
      <style>{`.admin-row:hover{background:rgba(255,255,255,0.5)!important}.add-btn:hover{background:#ffe333!important}.act:hover{background:rgba(0,0,0,0.06)!important}`}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 24px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans',Inter,sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', letterSpacing: '-0.02em' }}>Flight Management Console</h1>
            </div>
            <p style={{ fontSize: 14, color: '#5e5e5e' }}>Manage flight routes, seat availabilities, schedules and statuses.</p>
          </div>
          <button className="add-btn" onClick={openAddOptionModal} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffd700', color: '#1a1c1d', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,215,0,0.4)', transition: 'background 0.2s' }}>
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
                          <Link to={`/admin/flights/${f.id}/edit`} className="act" title="Edit" style={{ padding: 8, borderRadius: 8, color: '#5e5e5e', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}>
                            <Edit2 size={16} />
                          </Link>
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

        {/* Simplified Option Modal */}
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Add Flight Route">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '8px 4px' }}>
            <p style={{ fontSize: 14, color: '#5e5e5e', margin: 0, textAlign: 'center' }}>
              Choose how you want to register new flight routes in the system.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Option 1: Manual Form */}
              <div 
                className="glass-card" 
                style={{ borderRadius: 16, padding: '24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(112,93,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={24} color="#705d00" />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a1c1d', margin: 0 }}>Add Manually</h3>
                  <p style={{ fontSize: 12, color: '#5e5e5e', margin: 0, lineHeight: 1.4 }}>
                    Fill out a detailed form to create a single flight route manually.
                  </p>
                </div>
                <button
                  onClick={() => { setOpen(false); navigate('/admin/flights/new'); }}
                  style={{ width: '100%', background: '#1a1c1d', color: '#ffd700', fontWeight: 700, fontSize: 13, padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#2a2d2e'}
                  onMouseLeave={e => e.currentTarget.style.background = '#1a1c1d'}
                >
                  Create Manually
                </button>
              </div>

              {/* Option 2: JSON Import */}
              <div 
                className="glass-card" 
                style={{ borderRadius: 16, padding: '24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(112,93,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UploadCloud size={24} color="#705d00" />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a1c1d', margin: 0 }}>Import JSON</h3>
                  <p style={{ fontSize: 12, color: '#5e5e5e', margin: 0, lineHeight: 1.4 }}>
                    Upload a JSON file containing a list of flight records to import in bulk.
                  </p>
                </div>
                
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleJsonImport} 
                  style={{ display: 'none' }} 
                  id="json-file-input" 
                />
                <label 
                  htmlFor="json-file-input"
                  style={{ width: '100%', display: 'block', background: '#ffd700', color: '#1a1c1d', fontWeight: 700, fontSize: 13, padding: '10px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', border: 'none', boxShadow: '0 2px 8px rgba(255,215,0,0.2)', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#ffe333'}
                  onMouseLeave={e => e.currentTarget.style.background = '#ffd700'}
                >
                  Upload JSON File
                </label>
              </div>
            </div>
          </div>
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
