import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchFlightDetail, patchFlight, clearFlightDetail, deleteFlight } from '@/store/flightSlice';
import { Select } from '@/components/ui/Select';
import { Plane, ArrowLeft, Clock, Users, ShieldAlert, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DeleteFlightDialog } from '@/components/ui/DeleteFlightDialog';
import { fetchWaitlistEntries } from '@/store/waitlistSlice';

/* ── helpers ─────────────────────────────────────────────── */
const INR = (v) => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(v);
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:false });
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
const diffHM = (dep, arr) => { try { const ms=new Date(arr)-new Date(dep); return `${Math.floor(ms/3600000)}h ${Math.floor((ms%3600000)/60000)}m`; } catch(_){ return 'N/A'; } };

const STATUS_OPTS = [
  { value:'SCHEDULED', label:'Scheduled' }, { value:'DELAYED',  label:'Delayed'   },
  { value:'CANCELLED', label:'Cancelled' }, { value:'BOARDING', label:'Boarding'  },
  { value:'DEPARTED',  label:'Departed'  }, { value:'ARRIVED',  label:'Arrived'   },
];

const STATUS_STYLE = {
  SCHEDULED:{ bg:'#d1fae5', color:'#065f46', border:'#6ee7b7' },
  DELAYED:  { bg:'#fef3c7', color:'#92400e', border:'#fcd34d' },
  CANCELLED:{ bg:'#fee2e2', color:'#991b1b', border:'#fca5a5' },
  BOARDING: { bg:'#dbeafe', color:'#1e40af', border:'#93c5fd' },
  DEPARTED: { bg:'#ede9fe', color:'#5b21b6', border:'#c4b5fd' },
  ARRIVED:  { bg:'#f3e8ff', color:'#7c3aed', border:'#d8b4fe' },
};

function Badge({ status }) {
  const s = STATUS_STYLE[status] || { bg:'#f3f4f6', color:'#374151', border:'#d1d5db' };
  return <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}`, borderRadius:9999, padding:'5px 14px', fontSize:12, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase' }}>{status}</span>;
}

function WaitlistStatusBadge({ status }) {
  const styles = {
    PENDING: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
    CONFIRMED: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
    CANCELLED: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
    EXPIRED: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  };
  const s = styles[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 9999, padding: '4px 10px', fontSize: 11, fontWeight: 700,
      letterSpacing: '0.05em', textTransform: 'uppercase', display: 'inline-block'
    }}>
      {status}
    </span>
  );
}

function InfoTile({ icon, label, value, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, background:'rgba(255,255,255,0.55)', border:'1px solid rgba(255,255,255,0.7)', borderRadius:16, padding:'18px 22px' }}>
      <div style={{ width:48, height:48, borderRadius:14, background:'rgba(255,215,0,0.12)', border:'1px solid rgba(255,215,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.06em', color:'#5e5e5e', textTransform:'uppercase', marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:20, fontWeight:800, color:'#1a1c1d', lineHeight:1.1 }}>{value}</div>
        {sub && <div style={{ fontSize:12, color:'#9e9488', marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function AdminFlightDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { detail:flight, detailLoading, actionLoading, error } = useSelector(s => s.flights);
  const { list: waitlistEntries, listLoading: waitlistLoading } = useSelector(s => s.waitlist);
  const [statusVal, setStatusVal] = useState('SCHEDULED');
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, flightNumber, airline }

  useEffect(() => {
    dispatch(fetchFlightDetail(id));
    dispatch(fetchWaitlistEntries(id));
    return () => { dispatch(clearFlightDetail()); };
  }, [dispatch, id]);
  useEffect(() => { if (flight) setStatusVal(flight.status); }, [flight]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { id, flightNumber } = deleteTarget;
    const res = await dispatch(deleteFlight(id));
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(`Flight ${flightNumber} deleted successfully.`);
      navigate('/admin/flights');
    } else {
      toast.error(`Failed to delete ${flightNumber}.`);
    }
    setDeleteTarget(null);
  };

  const handleStatusChange = async (e) => {
    const next = e.target.value;
    setStatusVal(next);
    const patchPromise = dispatch(patchFlight({ id, flightData:{ status:next } })).unwrap();
    toast.promise(patchPromise, {
      loading: 'Updating status…',
      success: `Status updated to ${next}.`,
      error: 'Failed to update status.',
    });
  };

  if (detailLoading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'60vh' }}>
      <div style={{ width:44, height:44, border:'3px solid rgba(112,93,0,0.15)', borderTopColor:'#705d00', borderRadius:'50%', animation:'spin 0.75s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div style={{ maxWidth:900, margin:'0 auto', padding:'88px 24px 48px' }}>
      <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:16, padding:24, color:'#b91c1c', textAlign:'center', marginBottom:24 }}>{error}</div>
      <Link to="/admin/flights" style={{ display:'inline-flex', alignItems:'center', gap:8, color:'#1a1c1d', fontWeight:700, textDecoration:'none', fontSize:14 }}>
        <ArrowLeft size={16}/> Back to Console
      </Link>
    </div>
  );

  if (!flight) return null;

  const duration = diffHM(flight.departure_time, flight.arrival_time);

  return (
    <>
      <style>{`.back-lnk:hover{color:#705d00!important}`}</style>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'88px 24px 48px' }}>

        {/* Back */}
        <Link to="/admin/flights" className="back-lnk" style={{ display:'inline-flex', alignItems:'center', gap:8, color:'#1a1c1d', fontWeight:700, textDecoration:'none', fontSize:14, marginBottom:28, transition:'color 0.2s' }}>
          <ArrowLeft size={16}/> Back to Console
        </Link>

        {/* Main card */}
        <div className="glass-card" style={{ borderRadius:28, padding:'40px 48px', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', gap:32 }}>
          {/* Glows */}
          <div style={{ position:'absolute', top:-48, right:-48, width:200, height:200, borderRadius:'50%', background:'#ba1a1a', filter:'blur(90px)', opacity:0.07, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', bottom:-40, left:-40, width:160, height:160, borderRadius:'50%', background:'#ffd700', filter:'blur(80px)', opacity:0.1, pointerEvents:'none' }}/>

          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:20, paddingBottom:28, borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:'rgba(186,26,26,0.1)', border:'1px solid rgba(186,26,26,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <ShieldAlert size={18} color="#ba1a1a"/>
                </div>
                <h1 style={{ fontFamily:"'Plus Jakarta Sans',Inter,sans-serif", fontSize:30, fontWeight:800, color:'#1a1c1d', letterSpacing:'-0.02em' }}>{flight.flight_number}</h1>
                <Badge status={flight.status}/>
              </div>
              <p style={{ fontSize:14, color:'#5e5e5e', marginLeft:50 }}>{flight.airline} &bull; {flight.aircraft}</p>
            </div>

            {/* Quick status editor */}
            <div style={{ minWidth:180 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#5e5e5e', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Quick Status Edit</div>
              <Select id="detail-status" label="" options={STATUS_OPTS} value={statusVal} onChange={handleStatusChange} disabled={actionLoading}/>
              {actionLoading && <p style={{ fontSize:11, color:'#5e5e5e', marginTop:4 }}>Updating…</p>}
            </div>
          </div>

          {/* Route timeline */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:24, alignItems:'center' }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#5e5e5e', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>Departure</div>
              <div style={{ fontFamily:"'Plus Jakarta Sans',Inter,sans-serif", fontSize:52, fontWeight:800, color:'#1a1c1d', lineHeight:1 }}>{fmtTime(flight.departure_time)}</div>
              <div style={{ fontSize:22, fontWeight:700, color:'#1a1c1d', marginTop:4 }}>{flight.source_airport}</div>
              <div style={{ fontSize:13, color:'#5e5e5e', marginTop:4 }}>{fmtDate(flight.departure_time)}</div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, minWidth:140 }}>
              <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#5e5e5e', fontWeight:600 }}>
                <Clock size={13} color="#705d00"/>{duration}
              </div>
              <div style={{ width:'100%', position:'relative', display:'flex', alignItems:'center' }}>
                <div style={{ flex:1, height:2, background:'#d0c6ab' }}/>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.9)', border:'2px solid rgba(112,93,0,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 -1px', flexShrink:0, zIndex:1 }}>
                  <Plane size={16} color="#705d00"/>
                </div>
                <div style={{ flex:1, height:2, background:'#d0c6ab' }}/>
              </div>
              <div style={{ fontSize:12, color:'#705d00', fontWeight:600 }}>Non-stop</div>
            </div>

            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#5e5e5e', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>Arrival</div>
              <div style={{ fontFamily:"'Plus Jakarta Sans',Inter,sans-serif", fontSize:52, fontWeight:800, color:'#1a1c1d', lineHeight:1 }}>{fmtTime(flight.arrival_time)}</div>
              <div style={{ fontSize:22, fontWeight:700, color:'#1a1c1d', marginTop:4 }}>{flight.destination_airport}</div>
              <div style={{ fontSize:13, color:'#5e5e5e', marginTop:4 }}>{fmtDate(flight.arrival_time)}</div>
            </div>
          </div>

          {/* Info tiles */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:16, paddingTop:28, borderTop:'1px solid rgba(0,0,0,0.06)' }}>
            <InfoTile icon={<span style={{ fontSize:20 }}>₹</span>} label="Base Fare" value={INR(flight.base_fare)} sub="Per seat · Economy"/>
            <InfoTile icon={<Users size={20} color="#705d00"/>} label="Available Seats" value={`${flight.available_seats} / ${flight.total_seats}`} sub="Economy class"/>
            <InfoTile icon={<Clock size={20} color="#705d00"/>} label="Flight Duration" value={duration} sub="Estimated"/>
          </div>

          {/* System metadata */}
          <div style={{ background:'rgba(255,255,255,0.4)', border:'1px solid rgba(0,0,0,0.06)', borderRadius:16, padding:'18px 22px', paddingTop:28, borderTop:'1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1a1c1d', marginBottom:12 }}>System Metadata</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                ['External Sync ID', flight.external_id || 'N/A'],
                ['Sync Source', flight.sync_source || 'Local Database'],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#5e5e5e' }}>
                  <span>{k}</span>
                  <span style={{ fontWeight:600, color:'#1a1c1d' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons outside the card */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button
            onClick={() => navigate(`/admin/flights/${flight.id}/edit`)}
            className="btn-edit-action"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffd700', color: '#1a1c1d', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,215,0,0.2)', transition: 'background 0.2s' }}
          >
            <Edit2 size={16} /> Edit Route
          </button>
          <button
            onClick={() => setDeleteTarget({ id: flight.id, flightNumber: flight.flight_number, airline: flight.airline })}
            className="btn-delete-action"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 12, border: '1px solid #fecaca', cursor: 'pointer', transition: 'background 0.2s' }}
          >
            <Trash2 size={16} /> Delete Route
          </button>
        </div>

        {/* Delete confirmation dialog */}
        <DeleteFlightDialog
          open={!!deleteTarget}
          flightNumber={deleteTarget?.flightNumber}
          airline={deleteTarget?.airline}
          loading={actionLoading}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />

        {/* Waitlist Queue Panel */}
        <div className="glass-card" style={{ borderRadius:28, padding:'40px 48px', marginTop: 32, position:'relative', overflow:'hidden' }}>
          <h2 style={{ fontFamily:"'Plus Jakarta Sans',Inter,sans-serif", fontSize:22, fontWeight:800, color:'#1a1c1d', letterSpacing:'-0.01em', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
            <Users size={20} color="#705d00" />
            Waitlist Queue (FIFO Order)
          </h2>

          {waitlistLoading && waitlistEntries.length === 0 ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}>
              <div style={{ width:32, height:32, border:'3px solid rgba(112,93,0,0.15)', borderTopColor:'#705d00', borderRadius:'50%', animation:'spin 0.75s linear infinite' }} />
            </div>
          ) : waitlistEntries.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#5e5e5e', fontSize:14 }}>
              No passengers currently on the waitlist for this flight.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 700, color: '#5e5e5e', textTransform: 'uppercase' }}>Pos</th>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 700, color: '#5e5e5e', textTransform: 'uppercase' }}>Passenger</th>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 700, color: '#5e5e5e', textTransform: 'uppercase', textAlign: 'center' }}>Seats</th>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 700, color: '#5e5e5e', textTransform: 'uppercase' }}>Total Price</th>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 700, color: '#5e5e5e', textTransform: 'uppercase' }}>Joined At</th>
                    <th style={{ padding: '12px 8px', fontSize: 12, fontWeight: 700, color: '#5e5e5e', textTransform: 'uppercase', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlistEntries.map((entry) => (
                    <tr key={entry.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', fontSize: 14 }}>
                      <td style={{ padding: '12px 8px', fontWeight: 700, color: '#b45309' }}>
                        {entry.status === 'PENDING' ? `#${entry.queue_position}` : '-'}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 600, color: '#1a1c1d' }}>
                        {entry.username}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600 }}>
                        {entry.seat_count}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 600, color: '#705d00' }}>
                        {INR(entry.price)}
                      </td>
                      <td style={{ padding: '12px 8px', color: '#5e5e5e' }}>
                        {new Date(entry.created_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: true
                        })}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        <WaitlistStatusBadge status={entry.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
