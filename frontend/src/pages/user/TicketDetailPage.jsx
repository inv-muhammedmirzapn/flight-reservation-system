import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyBookings, cancelBooking } from '@/store/bookingSlice';
import { fetchWaitlistEntries, cancelWaitlistEntry } from '@/store/waitlistSlice';
import {
  Plane, ArrowLeft, AlertCircle, Loader,
  CheckCircle, XCircle, Clock, User, Phone,
  Calendar, CreditCard, Users, Hash,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { INR, fmtTime, fmtDate, diffHM } from '@/utils/formatters';

const fmtBookingDate = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

function StatusBadge({ status }) {
  const styles = {
    CONFIRMED: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', icon: <CheckCircle size={12} /> },
    CANCELLED: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', icon: <XCircle size={12} /> },
    PENDING:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', icon: <Clock size={12} /> },
    EXPIRED:   { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd', icon: <XCircle size={12} /> },
  };
  const s = styles[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db', icon: null };
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 9999, padding: '5px 14px',
      fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {s.icon}{status}
    </span>
  );
}

function FlightStatusBanner({ status }) {
  if (!status || status === 'SCHEDULED') return null;
  const cfg = {
    DELAYED:  { bg: '#fffbeb', border: '#fef3c7', color: '#92400e', icon: '#f59e0b', msg: 'This flight is delayed. Please check updated times.' },
    CANCELLED:{ bg: '#fef2f2', border: '#fee2e2', color: '#991b1b', icon: '#ef4444', msg: 'This flight has been cancelled. Contact support for refund/rebooking.' },
    BOARDING: { bg: '#eff6ff', border: '#dbeafe', color: '#1e40af', icon: '#3b82f6', msg: 'Flight is now boarding. Please proceed to gate immediately.' },
    DEPARTED: { bg: '#f9fafb', border: '#e5e7eb', color: '#4b5563', icon: '#6b7280', msg: 'This flight has departed.' },
    ARRIVED:  { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: '#22c55e', msg: 'This flight has arrived at its destination.' },
  };
  const c = cfg[status] || cfg.DELAYED;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 16,
      padding: '14px 18px', marginBottom: 24,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <AlertCircle size={20} color={c.icon} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: c.color, marginBottom: 2 }}>Flight Status: {status}</div>
        <div style={{ fontSize: 13, color: c.color, opacity: 0.85 }}>{c.msg}</div>
      </div>
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const { pathname } = useLocation();
  // Derive type from the URL path segment: /my-bookings/booking/:id or /my-bookings/waitlist/:id
  const type = pathname.includes('/waitlist/') ? 'waitlist' : 'booking';
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [showCancel, setShowCancel] = useState(false);

  const { list: bookingsList, listLoading: bLoading, cancelLoadingId: bCancelId } =
    useSelector((s) => s.bookings);
  const { list: waitlistList, listLoading: wLoading, cancelLoadingId: wCancelId } =
    useSelector((s) => s.waitlist);

  // Track whether at least one full round-trip has completed so we don't flash
  // "not found" while the API call is still in-flight.
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    Promise.all([
      dispatch(fetchMyBookings()),
      dispatch(fetchWaitlistEntries()),
    ]).finally(() => setHasFetched(true));
  }, [dispatch]);

  const isBooking = type === 'booking';
  const record = isBooking
    ? bookingsList.find((b) => String(b.id) === id)
    : waitlistList.find((w) => String(w.id) === id);
  const loading = isBooking ? bLoading : wLoading;
  const stillFetching = !hasFetched || loading;
  const cancellingId = isBooking ? bCancelId : wCancelId;

  const flight = record?.flight_detail;

  const handleCancel = () => {
    if (isBooking) {
      dispatch(cancelBooking(record.id)).then((a) => {
        if (!a.error) { toast.success('Booking cancelled.'); setShowCancel(false); }
      });
    } else {
      dispatch(cancelWaitlistEntry(record.id)).then((a) => {
        if (!a.error) { toast.success('Waitlist request cancelled.'); setShowCancel(false); }
      });
    }
  };

  if (stillFetching && !record) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader size={36} color="#705d00" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!record || !flight) {
    return (
      <div style={{ maxWidth: 560, margin: '120px auto', textAlign: 'center', padding: '0 24px' }}>
        <AlertCircle size={48} color="#fcd34d" style={{ marginBottom: 16 }} />
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 22, color: '#1a1c1d', marginBottom: 8 }}>
          Ticket not found
        </h2>
        <p style={{ color: '#5e5e5e', marginBottom: 24 }}>
          We couldn't find this {isBooking ? 'booking' : 'waitlist entry'}. It may have been removed.
        </p>
        <Link to="/my-bookings" style={{
          background: '#ffd700', color: '#1a1c1d', fontWeight: 700, fontSize: 14,
          padding: '12px 28px', borderRadius: 12, textDecoration: 'none',
        }}>
          Back to My Bookings
        </Link>
      </div>
    );
  }

  const isPast = new Date(flight.departure_time) < new Date();
  const isFlightCancelled = flight.status === 'CANCELLED';
  const isFlightDepartedOrArrived = flight.status === 'DEPARTED' || flight.status === 'ARRIVED';
  const isFlightBoarding = flight.status === 'BOARDING';
  const isConfirmed = record.status === 'CONFIRMED';
  const isPending  = record.status === 'PENDING';
  const canCancel = isBooking
    ? (isConfirmed && !isPast && !isFlightCancelled && !isFlightDepartedOrArrived && !isFlightBoarding)
    : (isPending && !isPast && !isFlightCancelled && !isFlightDepartedOrArrived && !isFlightBoarding);

  const passengers = record.passengers || [];
  const duration = diffHM(flight.departure_time, flight.arrival_time);

  return (
    <>
      <style>{`
        @keyframes fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .td-card { animation: fade-up 0.35s ease both; }
        .td-passenger-row:nth-child(even) { background: rgba(0,0,0,0.02); }
        @media (min-width:860px) { .td-layout { display:grid; grid-template-columns:1fr 340px; gap:32px; align-items:start; } .td-sidebar { position:sticky; top:92px; } }
      `}</style>

      <div style={{ width: '95%', maxWidth: 1200, margin: '0 auto', padding: '120px 0 72px' }}>

        {/* Back link */}
        <button
          onClick={() => navigate('/my-bookings')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, color: '#5e5e5e',
            marginBottom: 28, padding: 0,
          }}
        >
          <ArrowLeft size={16} /> Back to My Bookings
        </button>

        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
            fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 800,
            color: '#1a1c1d', letterSpacing: '-0.02em', margin: '0 0 6px',
          }}>
            {isBooking ? 'Booking' : 'Waitlist'} Ticket
          </h1>
          <p style={{ fontSize: 14, color: '#5e5e5e', margin: 0 }}>
            {isBooking ? `Reference: ${String(record.id).slice(0, 8).toUpperCase()}` : `Waitlist ID: ${String(record.id).slice(0, 8).toUpperCase()}`}
          </p>
        </div>

        <div className="td-layout">

          {/* ── Left: Main content ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Flight status alert */}
            <FlightStatusBanner status={flight.status} />

            {/* Boarding pass style card */}
            <div className="td-card" style={{
              background: '#fff', borderRadius: 24, overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.06)',
            }}>
              {/* Dark header */}
              <div style={{ background: '#1a1c1d', padding: '20px 28px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position:'absolute', top:-40, right:-20, width:140, height:140, borderRadius:'50%', background:'#ffd700', opacity:0.08, filter:'blur(30px)' }} />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,215,0,0.15)', border:'1px solid rgba(255,215,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Plane size={16} color="#ffd700" style={{ transform:'rotate(-45deg)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'-0.01em' }}>{flight.flight_number}</div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)' }}>{flight.airline} · {flight.aircraft}</div>
                    </div>
                  </div>
                  <StatusBadge status={record.status} />
                </div>
              </div>

              {/* Route */}
              <div style={{ padding: '28px 28px 20px', borderBottom: '1px dashed rgba(0,0,0,0.1)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:16 }}>
                  <div>
                    <div style={{ fontSize:40, fontWeight:800, color:'#1a1c1d', lineHeight:1 }}>{fmtTime(flight.departure_time)}</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'#1a1c1d', marginTop:4 }}>{flight.source_airport}</div>
                    <div style={{ fontSize:13, color:'#5e5e5e', marginTop:4 }}>{fmtDate(flight.departure_time)}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4, width:80 }}>
                      <div style={{ flex:1, height:2, background:'#d0c6ab' }} />
                      <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,215,0,0.12)', border:'1px solid rgba(255,215,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Plane size={12} color="#705d00" />
                      </div>
                      <div style={{ flex:1, height:2, background:'#d0c6ab' }} />
                    </div>
                    <div style={{ fontSize:11, color:'#705d00', fontWeight:700 }}>{duration}</div>
                    <div style={{ fontSize:10, color:'#9e9488', fontWeight:600 }}>Direct</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:40, fontWeight:800, color:'#1a1c1d', lineHeight:1 }}>{fmtTime(flight.arrival_time)}</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'#1a1c1d', marginTop:4 }}>{flight.destination_airport}</div>
                    <div style={{ fontSize:13, color:'#5e5e5e', marginTop:4 }}>{fmtDate(flight.arrival_time)}</div>
                  </div>
                </div>
              </div>

              {/* Meta grid */}
              <div style={{ padding:'20px 28px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:16 }}>
                {[
                  { icon: <Hash size={14} color="#705d00" />,      label: isBooking ? 'Booking Ref' : 'Waitlist ID', value: String(record.id).slice(0,8).toUpperCase() },
                  { icon: <Users size={14} color="#705d00" />,     label: 'Passengers',   value: `${record.seat_count} seat${record.seat_count > 1 ? 's' : ''}` },
                  { icon: <CreditCard size={14} color="#705d00" />,label: isBooking ? 'Total Fare' : 'Pre-auth Total', value: INR(isBooking ? (record.total_price || flight.base_fare * record.seat_count) : record.price) },
                  { icon: <Calendar size={14} color="#705d00" />,  label: isBooking ? 'Booked On' : 'Requested On', value: fmtBookingDate(record.created_at) },
                  ...(!isBooking && record.queue_position ? [{ icon: <Clock size={14} color="#d97706" />, label: 'Queue Position', value: `#${record.queue_position}` }] : []),
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      {icon}
                      <span style={{ fontSize:10, fontWeight:700, color:'#9e9488', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</span>
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1a1c1d' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Passengers table */}
            <div className="td-card" style={{
              background:'#fff', borderRadius:20, overflow:'hidden',
              boxShadow:'0 4px 20px rgba(0,0,0,0.05)', border:'1px solid rgba(0,0,0,0.06)',
              animationDelay:'0.08s',
            }}>
              <div style={{ padding:'18px 24px', borderBottom:'1px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:10 }}>
                <Users size={18} color="#705d00" />
                <h2 style={{ margin:0, fontSize:16, fontWeight:800, color:'#1a1c1d' }}>
                  Passenger Details
                  <span style={{ marginLeft:8, fontSize:12, fontWeight:600, color:'#9e9488' }}>({passengers.length})</span>
                </h2>
              </div>

              {passengers.length === 0 ? (
                <div style={{ padding:'32px 24px', textAlign:'center', color:'#9e9488', fontSize:14 }}>
                  <User size={28} style={{ marginBottom:8, opacity:0.3 }} />
                  <p style={{ margin:0 }}>No passenger details on record.</p>
                </div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                    <thead>
                      <tr style={{ background:'#f8f9fa' }}>
                        {['#', 'Name', 'Age', 'Gender', 'Phone'].map((h) => (
                          <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#9e9488', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {passengers.map((p, i) => (
                        <tr key={p.id || i} className="td-passenger-row" style={{ borderTop:'1px solid rgba(0,0,0,0.04)' }}>
                          <td style={{ padding:'12px 16px', color:'#9e9488', fontWeight:600 }}>{i + 1}</td>
                          <td style={{ padding:'12px 16px', fontWeight:700, color:'#1a1c1d', display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,215,0,0.12)', border:'1px solid rgba(255,215,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <User size={13} color="#705d00" />
                            </div>
                            {p.name}
                          </td>
                          <td style={{ padding:'12px 16px', color:'#374151' }}>{p.age}</td>
                          <td style={{ padding:'12px 16px', color:'#374151', textTransform:'capitalize' }}>{p.gender?.toLowerCase()}</td>
                          <td style={{ padding:'12px 16px', color:'#374151', display:'flex', alignItems:'center', gap:5 }}>
                            <Phone size={12} color="#9e9488" />{p.phone_number || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* ── Right: Sidebar actions ── */}
          <div className="td-sidebar">
            <div style={{
              background:'#fff', borderRadius:20, overflow:'hidden',
              boxShadow:'0 4px 20px rgba(0,0,0,0.06)', border:'1px solid rgba(0,0,0,0.06)',
            }}>
              <div style={{ background:'#1a1c1d', padding:'16px 20px' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Actions</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{isBooking ? 'Manage Booking' : 'Manage Waitlist'}</div>
              </div>

              <div style={{ padding:'20px' }}>
                {/* Cancellation action */}
                {canCancel ? (
                  <button
                    id={`view-ticket-cancel-btn-${record.id}`}
                    onClick={() => setShowCancel(true)}
                    style={{
                      width:'100%', background:'#fff1f2', border:'none',
                      color:'#e11d48', fontWeight:700, fontSize:14,
                      padding:'13px 16px', borderRadius:12, cursor:'pointer',
                      transition:'all 0.2s', display:'flex', justifyContent:'center', alignItems:'center', gap:6,
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#ffe4e6'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#fff1f2'}
                  >
                    <XCircle size={16} /> {isBooking ? 'Cancel Reservation' : 'Cancel Waitlist Request'}
                  </button>
                ) : (
                  <div style={{
                    textAlign:'center', padding:'13px 16px',
                    background:'#f3f4f6', borderRadius:12,
                    color:'#9e9488', fontSize:13, fontWeight:600,
                    border:'1px solid rgba(0,0,0,0.05)',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  }}>
                    <XCircle size={14} opacity={0.4} />
                    {record.status === 'CANCELLED' && 'Already cancelled'}
                    {record.status === 'EXPIRED' && 'Entry has expired'}
                    {(isConfirmed || isPending) && isPast && 'Flight has departed'}
                    {(isConfirmed || isPending) && !isPast && isFlightCancelled && 'Cancellation unavailable: Flight cancelled'}
                    {(isConfirmed || isPending) && !isPast && isFlightDepartedOrArrived && 'Cancellation unavailable: Flight departed'}
                    {(isConfirmed || isPending) && !isPast && isFlightBoarding && 'Cancellation unavailable: Flight is boarding'}
                  </div>
                )}

                <div style={{ height:1, background:'rgba(0,0,0,0.06)', margin:'16px 0' }} />

                <Link
                  to="/my-bookings"
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    background:'rgba(0,0,0,0.04)', border:'1px solid rgba(0,0,0,0.07)',
                    color:'#374151', fontWeight:700, fontSize:14,
                    padding:'12px 16px', borderRadius:12,
                    textDecoration:'none', transition:'all 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.07)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                >
                  <ArrowLeft size={15} /> Back to My Bookings
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Cancel Confirm Modal */}
      {showCancel && createPortal(
        <div style={{
          position:'fixed', top:0, left:0, right:0, bottom:0,
          background:'rgba(0,0,0,0.5)', zIndex:9999, backdropFilter:'blur(4px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }}>
          <div style={{
            background:'#fff', borderRadius:20, padding:28, width:'100%', maxWidth:400,
            boxShadow:'0 20px 40px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'#fff1f2', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <AlertCircle size={26} color="#e11d48" />
              </div>
            </div>
            <h3 style={{ margin:'0 0 8px', fontSize:18, color:'#1a1c1d', fontWeight:800, textAlign:'center' }}>
              {isBooking ? 'Cancel Reservation' : 'Cancel Waitlist Request'}
            </h3>
            <p style={{ margin:'0 0 16px', color:'#5e5e5e', fontSize:14, textAlign:'center', lineHeight:1.5 }}>
              Are you sure you want to cancel{' '}
              <strong>{String(record.id).slice(0,8).toUpperCase()}</strong>?{' '}
              This action cannot be undone.
            </p>
            {isBooking && (
              <div style={{ padding:'12px', background:'#fff1f2', borderRadius:12, marginBottom:20, textAlign:'center' }}>
                <p style={{ margin:0, fontSize:12, color:'#be123c', fontWeight:600 }}>
                  A 10% cancellation fee ({INR((record.total_price || flight.base_fare) * 0.10)}) will be deducted.
                </p>
              </div>
            )}
            {!isBooking && (
              <div style={{ padding:'12px', background:'#fff1f2', borderRadius:12, marginBottom:20, textAlign:'center' }}>
                <p style={{ margin:0, fontSize:12, color:'#be123c', fontWeight:600 }}>
                  A 5% processing fee ({INR(record.price * 0.05)}) will be deducted.
                </p>
              </div>
            )}
            <div style={{ display:'flex', gap:12 }}>
              <button
                onClick={() => setShowCancel(false)}
                style={{
                  flex:1, background:'#f3f4f6', border:'none', color:'#374151',
                  fontWeight:700, fontSize:14, padding:'12px', borderRadius:12, cursor:'pointer',
                }}
              >
                No, Keep it
              </button>
              <button
                onClick={handleCancel}
                disabled={!!cancellingId}
                style={{
                  flex:1, background:'#e11d48', border:'none', color:'#fff',
                  fontWeight:700, fontSize:14, padding:'12px', borderRadius:12, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  opacity: cancellingId ? 0.7 : 1,
                }}
              >
                {cancellingId ? <Loader size={16} style={{ animation:'spin 1s linear infinite' }} /> : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
