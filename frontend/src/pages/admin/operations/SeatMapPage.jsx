/**
 * SeatMapPage — per-flight-instance seat map.
 * Features:
 *  - Instance selector dropdown
 *  - "Generate Seats" bulk action
 *  - Visual grid (clickable cells) for editing status/exit_row/seat_fee
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import '@/styles/admin-system.css';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { fetchFlightInstances, fetchSeats, updateSeat, generateSeats } from '@/store/adminSlices';
import { Zap, Save, X, ArrowLeft, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  AVAILABLE: '#22c55e',
  HELD: '#f59e0b',
  BOOKED: '#3b82f6',
  BLOCKED: '#6b7280',
};

const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'HELD', label: 'Held' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'BLOCKED', label: 'Blocked' },
];

export default function SeatMapPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items: instances } = useSelector((s) => s.flightInstance);
  const { items: seats, loading: seatsLoading, actionLoading } = useSelector((s) => s.seat);

  const [searchParams] = useSearchParams();
  const instanceParam = searchParams.get('instance') || '';

  const [selectedInstanceId, setSelectedInstanceId] = useState(instanceParam);
  const [editSeat, setEditSeat] = useState(null);
  const [seatForm, setSeatForm] = useState({});
  const [showMap, setShowMap] = useState(!!instanceParam);

  useEffect(() => {
    dispatch(fetchFlightInstances({ page_size: 500 }));
  }, [dispatch]);

  // Once instances are loaded, if URL has ?instance=X, select it and load seats
  useEffect(() => {
    if (instanceParam && instances.length > 0) {
      setSelectedInstanceId(instanceParam);
      loadSeats(instanceParam).then(() => setShowMap(true)).catch(() => {});
    }
  }, [instanceParam, instances.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSeats = (id) => {
    if (!id) return;
    return dispatch(fetchSeats({ flight_instance: id, page_size: 500 })).unwrap();
  };

  const handleInstanceChange = (id) => {
    setSelectedInstanceId(id);
    setEditSeat(null);
    if (id) {
      loadSeats(id).then(() => setShowMap(true)).catch(() => {});
    } else {
      setShowMap(false);
    }
  };

  const handleSearchClick = () => {
    if (!selectedInstanceId) {
      toast.error('Please select a flight instance first.');
      return;
    }
    setEditSeat(null);
    loadSeats(selectedInstanceId).then(() => setShowMap(true)).catch(() => {});
  };

  const handleGenerateSeats = async () => {
    if (!selectedInstanceId) return;

    try {
      const res = await loadSeats(selectedInstanceId);
      const fetchedSeats = res.results || res;
      if (fetchedSeats && fetchedSeats.length > 0) {
        setShowMap(true);
        toast.success('Seats loaded.');
        return;
      }
    } catch (err) {
      // ignore
    }

    toast.promise(
      dispatch(generateSeats(selectedInstanceId)).unwrap(),
      {
        loading: 'Generating seats…',
        success: (res) => {
          loadSeats(selectedInstanceId);
          setShowMap(true);
          return res?.detail || 'Seats generated!';
        },
        error: (err) => String(err),
      }
    );
  };

  const openEditSeat = (seat) => {
    setEditSeat(seat);
    setSeatForm({
      status: seat.status,
      exit_row: seat.exit_row,
      seat_fee: seat.seat_fee,
      position: seat.position,
    });
  };

  const handleSaveSeat = () => {
    if (seatForm.seat_fee === '' || Number(seatForm.seat_fee) < 0) {
      toast.error('Seat fee must be a non-negative number.');
      return;
    }
    toast.promise(
      dispatch(updateSeat({ id: editSeat.id, data: { ...editSeat, ...seatForm } })).unwrap(),
      {
        loading: 'Saving seat…',
        success: () => { setEditSeat(null); return 'Seat updated!'; },
        error: 'Failed to update seat.',
      }
    );
  };

  const instanceOptions = instances.map((i) => ({
    value: i.id,
    label: `${i.flight_no} — ${i.date} (${i.status})`,
  }));

  // Group seats by class
  const economy = seats.filter((s) => s.seat_class === 'ECONOMY');
  const business = seats.filter((s) => s.seat_class === 'BUSINESS');
  const first = seats.filter((s) => s.seat_class === 'FIRST');

  const SeatGrid = ({ title, seatList, color }) => (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color, marginBottom: 12 }}>
        {title} ({seatList.length} seats)
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {seatList.map((seat) => (
          <button
            key={seat.id}
            onClick={() => openEditSeat(seat)}
            title={`${seat.seat_number} | ${seat.status} | ${seat.position}${seat.exit_row ? ' | EXIT ROW' : ''} | Fee: ${seat.seat_fee}`}
            style={{
              width: 44, height: 44, borderRadius: 8,
              background: STATUS_COLORS[seat.status] + '22',
              border: `2px solid ${STATUS_COLORS[seat.status]}`,
              color: STATUS_COLORS[seat.status],
              fontSize: 10, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 1,
              transition: 'transform .15s',
              outline: editSeat?.id === seat.id ? `3px solid #705d00` : 'none',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span>{seat.seat_number}</span>
            {seat.exit_row && <span style={{ fontSize: 8 }}>EXIT</span>}
          </button>
        ))}
        {seatList.length === 0 && <span style={{ fontSize: 13, color: '#888' }}>No seats in this class.</span>}
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        .legend-dot { width:12px; height:12px; border-radius:3px; display:inline-block; }
      `}</style>

      <div style={{ width: '95%', maxWidth: 1800, margin: '0 auto', padding: '88px 24px 48px' }}>
        {instanceParam && (
          <div className="admin-breadcrumb" style={{ marginBottom: 16 }}>
            <span>
              <Link to="/admin/operations/flight-instances">Flight Instances</Link>
              <span style={{ margin: '0 8px' }}>/</span>
            </span>
            <span>Seats (Instance #{instanceParam})</span>
          </div>
        )}
        {/* Back button + title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 600, color: '#555', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
          >
            <ArrowLeft size={15} /> Back
          </button>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', margin: 0 }}>
            Seat Map
          </h1>
        </div>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 28 }}>Select a flight instance, generate seats, and click any seat to edit its status.</p>

        {/* Instance selector + search / generate */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <Select
              id="seat-map-instance"
              label="Flight Instance"
              options={[{ value: '', label: '— Select instance —' }, ...instanceOptions]}
              value={selectedInstanceId}
              onChange={(e) => handleInstanceChange(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSearchClick}
            disabled={!selectedInstanceId || seatsLoading}
            id="search-seats-btn"
            style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          >
            <Search size={15} /> Search Seats
          </button>
          {selectedInstanceId && seats.length === 0 && !seatsLoading && (
            <button className="btn-secondary" onClick={handleGenerateSeats} disabled={actionLoading} id="generate-seats-btn" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <Zap size={15} /> Generate Seats
            </button>
          )}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666' }}>
              <span className="legend-dot" style={{ background: color + '33', border: `2px solid ${color}` }} />
              {status}
            </div>
          ))}
        </div>

        {/* Seat grid */}
        {selectedInstanceId && showMap ? (
          seatsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 36, height: 36, border: '3px solid rgba(112,93,0,0.15)', borderTopColor: '#705d00', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            </div>
          ) : (
            <div className="admin-card" style={{ padding: 32 }}>
              {seats.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#888', fontSize: 14, padding: '32px 0' }}>
                  No seats yet. Click &ldquo;Generate Seats&rdquo; to create them from the aircraft capacity.
                </div>
              ) : (
                <>
                  <SeatGrid title="First Class" seatList={first} color="#b45309" />
                  <SeatGrid title="Business" seatList={business} color="#6d28d9" />
                  <SeatGrid title="Economy" seatList={economy} color="#047857" />
                </>
              )}
            </div>
          )
        ) : (
          <div className="admin-card" style={{ textAlign: 'center', color: '#aaa', padding: '48px 0', fontSize: 15 }}>
            Select a flight instance above and click "Generate Seats" to view or generate its seat map.
          </div>
        )}
      </div>

      {/* Edit seat panel */}
      {editSeat && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#fff', borderRadius: 18, padding: '24px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', width: 320, zIndex: 300 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#1a1c1d' }}>Seat {editSeat.seat_number}</h3>
            <button className="btn-icon" onClick={() => setEditSeat(null)} style={{ padding: '4px 8px' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Select id="edit-status" label="Status" options={STATUS_OPTIONS} value={seatForm.status}
              onChange={(e) => setSeatForm((f) => ({ ...f, status: e.target.value }))} />
            <Input id="edit-seat-fee" label="Seat Fee" type="number" value={seatForm.seat_fee}
              onChange={(e) => setSeatForm((f) => ({ ...f, seat_fee: e.target.value }))} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="edit-exit-row" checked={!!seatForm.exit_row}
                onChange={(e) => setSeatForm((f) => ({ ...f, exit_row: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: '#705d00' }} />
              <label htmlFor="edit-exit-row" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Exit Row</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn-secondary" onClick={() => setEditSeat(null)} style={{ flex: 1, justifyContent: 'center' }}><X size={13} /> Cancel</button>
            <button className="btn-primary" onClick={handleSaveSeat} disabled={actionLoading} style={{ flex: 1, justifyContent: 'center' }}>
              <Save size={13} /> Save
            </button>
          </div>
        </div>
      )}
    </>
  );
}
