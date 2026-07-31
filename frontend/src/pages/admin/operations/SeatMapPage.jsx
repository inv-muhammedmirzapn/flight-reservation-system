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
import { fetchFlightInstances, fetchSeats, updateSeat, generateSeats, applyPremiumPricing } from '@/store/adminSlices';
import { Zap, Save, X, ArrowLeft, Search, DollarSign } from 'lucide-react';
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
  const [showPricing, setShowPricing] = useState(false);
  const [pricingForm, setPricingForm] = useState({ window_fee: 50, legroom_fee: 150 });

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

  const handleApplyPricing = () => {
    if (!selectedInstanceId) return;
    toast.promise(
      dispatch(applyPremiumPricing({ 
        instanceId: selectedInstanceId, 
        data: pricingForm 
      })).unwrap(),
      {
        loading: 'Applying pricing…',
        success: (res) => {
          loadSeats(selectedInstanceId);
          setShowPricing(false);
          return res?.detail || 'Pricing applied!';
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

  const chunkArray = (arr, size) => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
      arr.slice(i * size, i * size + size)
    );
  };

  // Sort seats numerically by the number part of seat_number so they flow correctly in rows
  const sortedSeats = [...seats].sort((a, b) => {
    const numA = parseInt(a.seat_number.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.seat_number.replace(/\D/g, ''), 10) || 0;
    if (numA === numB) return a.seat_number.localeCompare(b.seat_number);
    return numA - numB;
  });

  const seatRows = chunkArray(sortedSeats, 6);

  return (
    <>
      <style>{`
        .plane-area {
          background-color: #bde0fe;
          padding: 60px 40px;
          display: flex;
          gap: 60px;
          justify-content: center;
          align-items: flex-start;
          border-radius: 12px;
          overflow: hidden;
          margin-top: 24px;
        }
        .legend-card {
          background: white;
          padding: 24px;
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 220px;
          position: sticky;
          top: 100px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 14px;
          color: #333;
        }
        .legend-box {
          width: 24px; height: 24px;
          border-radius: 4px;
          border: 1px solid #ccc;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .legend-box.free { background: #4ade80; border-color: #22c55e; }
        .legend-box.premium { background: #93c5fd; border-color: #60a5fa; }
        .legend-box.super-premium { background: #c084fc; border-color: #a855f7; }
        .legend-box .exit-corner {
          position: absolute; top:0; left:0; width:0; height:0;
          border-top: 8px solid #dc2626; border-right: 8px solid transparent;
        }
        .fuselage {
          background: white;
          width: 420px;
          border-radius: 210px 210px 0 0;
          padding: 80px 40px 60px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .exit-row-marker {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #dc2626;
          font-weight: 800;
          font-size: 11px;
          margin: 32px 0 24px;
          letter-spacing: 0.5px;
        }
        .exit-sign { display: flex; align-items: center; gap: 6px; }
        .exit-sign .bar { width: 2px; height: 16px; background: #dc2626; }
        .seat-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .seat-group { display: flex; gap: 6px; }
        .aisle-gap { width: 30px; }
        .row-number {
          font-size: 12px;
          color: #666;
          width: 20px;
          text-align: center;
          font-weight: 600;
        }
        .col-label {
          width: 36px;
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          color: #555;
          margin-bottom: 12px;
        }
        .seat-box {
          width: 36px;
          height: 36px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          background: white;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .seat-box:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
          z-index: 10;
        }
        .seat-box.unavailable { background: #f9fafb; cursor: not-allowed; }
        .seat-box.unavailable::before, .seat-box.unavailable::after {
          content: ''; position: absolute;
          top: 17px; left: 8px; width: 20px; height: 1px;
          background: #9ca3af;
        }
        .seat-box.unavailable::before { transform: rotate(45deg); }
        .seat-box.unavailable::after { transform: rotate(-45deg); }
        
        .seat-box.available.free { background: #4ade80; border-color: #22c55e; }
        .seat-box.available.premium { background: #93c5fd; border-color: #60a5fa; }
        .seat-box.available.super-premium { background: #c084fc; border-color: #a855f7; }
        
        .seat-box.selected {
          background: #0ea5e9 !important;
          border-color: #0284c7 !important;
          color: white;
        }
        .exit-corner {
          position: absolute; top: 0; left: 0; width: 0; height: 0;
          border-top: 10px solid #dc2626; border-right: 10px solid transparent;
        }
        .xl-text {
          font-size: 10px;
          font-weight: 800;
          color: #666;
          opacity: 0.6;
        }
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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 600, color: '#555', cursor: 'pointer' }}
          >
            <ArrowLeft size={15} /> Back
          </button>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', margin: 0 }}>
            Seat Map
          </h1>
        </div>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 28 }}>Select a flight instance, generate seats, and configure seat mapping visually.</p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <Select
              id="seat-map-instance"
              label="Flight Instance"
              options={[{ value: '', label: '— Select instance —' }, ...instanceOptions]}
              value={selectedInstanceId}
              onChange={(e) => handleInstanceChange(e.target.value)}
            />
          </div>
          <button type="button" className="btn-primary" onClick={handleSearchClick} disabled={!selectedInstanceId || seatsLoading} style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={15} /> Search Seats
          </button>
          {selectedInstanceId && seats.length === 0 && !seatsLoading && (
            <button className="btn-secondary" onClick={handleGenerateSeats} disabled={actionLoading} style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={15} /> Generate Seats
            </button>
          )}
          {selectedInstanceId && seats.length > 0 && !seatsLoading && (
            <button className="btn-secondary" onClick={() => setShowPricing(true)} disabled={actionLoading} style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <DollarSign size={15} /> Set Premium Pricing
            </button>
          )}
        </div>

        {selectedInstanceId && showMap && (
          seatsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 36, height: 36, border: '3px solid rgba(112,93,0,0.15)', borderTopColor: '#705d00', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            </div>
          ) : seats.length === 0 ? (
            <div className="admin-card" style={{ textAlign: 'center', color: '#888', padding: '48px 0', marginTop: 24 }}>
              No seats yet. Click &ldquo;Generate Seats&rdquo; to create them from the aircraft capacity.
            </div>
          ) : (
            <div className="plane-area">
              
              {/* Legend on the Left */}
              <div className="legend-card">
                <div className="legend-item">
                  <div className="legend-box free"></div>
                  <span>Free</span>
                </div>
                <div className="legend-item">
                  <div className="legend-box premium"></div>
                  <span>₹ 1-460</span>
                </div>
                <div className="legend-item">
                  <div className="legend-box super-premium"></div>
                  <span>₹ 461+</span>
                </div>
                <div className="legend-item">
                  <div className="legend-box"><div className="exit-corner" /></div>
                  <span>Exit Row Seats</span>
                </div>
                <div className="legend-item">
                  <div className="legend-box"><span className="xl-text">XL</span></div>
                  <span>Extra Legroom</span>
                </div>
              </div>

              {/* Airplane Layout */}
              <div className="fuselage">
                <svg width="140" height="60" viewBox="0 0 140 60" style={{ margin: '0 auto 20px', display: 'block' }}>
                  <path d="M 20 60 C 40 10, 100 10, 120 60" fill="none" stroke="#555" strokeWidth="12" strokeLinecap="round" strokeDasharray="30 15" />
                </svg>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px', color: '#ccc' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="6" r="2" /><path d="M6 12v7h4v-7" /><path d="M4 12h8" /><circle cx="16" cy="6" r="2" /><path d="M14 12v7h4v-7" /><path d="M12 12h8" /></svg>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="6" r="2" /><path d="M6 12v7h4v-7" /><path d="M4 12h8" /><circle cx="16" cy="6" r="2" /><path d="M14 12v7h4v-7" /><path d="M12 12h8" /></svg>
                </div>

                <div className="exit-row-marker">
                  <div className="exit-sign"><div className="bar"/> ◀ EXIT</div>
                  <div className="exit-sign">EXIT ▶ <div className="bar"/></div>
                </div>

                <div className="seat-row" style={{ marginBottom: 16 }}>
                  <div className="row-number"></div>
                  <div className="seat-group">
                    <div className="col-label">A</div>
                    <div className="col-label">B</div>
                    <div className="col-label">C</div>
                  </div>
                  <div className="aisle-gap"></div>
                  <div className="seat-group">
                    <div className="col-label">D</div>
                    <div className="col-label">E</div>
                    <div className="col-label">F</div>
                  </div>
                  <div className="row-number"></div>
                </div>

                {seatRows.map((rowSeats, i) => {
                  const rowNum = i + 1;
                  const leftGroup = rowSeats.slice(0, 3);
                  const rightGroup = rowSeats.slice(3, 6);
                  
                  return (
                    <div key={rowNum} className="seat-row">
                      <div className="row-number">{rowNum}</div>
                      
                      <div className="seat-group">
                        {leftGroup.map(seat => {
                          const isAvailable = seat.status === 'AVAILABLE';
                          const fee = Number(seat.seat_fee);
                          const isFree = isAvailable && fee === 0;
                          const isPremium = isAvailable && fee > 0 && fee <= 460;
                          const isSuperPremium = isAvailable && fee > 460;
                          const isSelected = editSeat?.id === seat.id;
                          
                          let cls = "seat-box";
                          if (!isAvailable) cls += " unavailable";
                          else if (isFree) cls += " available free";
                          else if (isSuperPremium) cls += " available super-premium";
                          else if (isPremium) cls += " available premium";
                          if (isSelected) cls += " selected";

                          return (
                            <div key={seat.id} className={cls} onClick={() => openEditSeat(seat)} title={`${seat.seat_number} | Fee: ${seat.seat_fee}`}>
                              {seat.exit_row && <div className="exit-corner" />}
                              {(seat.exit_row || fee > 0) && isAvailable && !seat.exit_row && <span className="xl-text">XL</span>}
                              {isSelected && isAvailable && (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ position: 'absolute', zIndex: 2 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="aisle-gap"></div>

                      <div className="seat-group">
                        {rightGroup.map(seat => {
                          const isAvailable = seat.status === 'AVAILABLE';
                          const fee = Number(seat.seat_fee);
                          const isFree = isAvailable && fee === 0;
                          const isPremium = isAvailable && fee > 0 && fee <= 460;
                          const isSuperPremium = isAvailable && fee > 460;
                          const isSelected = editSeat?.id === seat.id;
                          
                          let cls = "seat-box";
                          if (!isAvailable) cls += " unavailable";
                          else if (isFree) cls += " available free";
                          else if (isSuperPremium) cls += " available super-premium";
                          else if (isPremium) cls += " available premium";
                          if (isSelected) cls += " selected";

                          return (
                            <div key={seat.id} className={cls} onClick={() => openEditSeat(seat)} title={`${seat.seat_number} | Fee: ${seat.seat_fee}`}>
                              {seat.exit_row && <div className="exit-corner" />}
                              {(seat.exit_row || fee > 0) && isAvailable && !seat.exit_row && <span className="xl-text">XL</span>}
                              {isSelected && isAvailable && (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ position: 'absolute', zIndex: 2 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="row-number">{rowNum}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
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

      {/* Premium Pricing panel */}
      {showPricing && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: 18, padding: '24px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', width: 360, zIndex: 300 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#1a1c1d' }}>Bulk Premium Pricing</h3>
            <button className="btn-icon" onClick={() => setShowPricing(false)} style={{ padding: '4px 8px' }}><X size={14} /></button>
          </div>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Increase prices for specific seat types. This will apply to all seats of this flight instance.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input id="pricing-window" label="Add to Window Seats" type="number" value={pricingForm.window_fee}
              onChange={(e) => setPricingForm((f) => ({ ...f, window_fee: e.target.value }))} />
            <Input id="pricing-legroom" label="Add to Exit Row (Legroom)" type="number" value={pricingForm.legroom_fee}
              onChange={(e) => setPricingForm((f) => ({ ...f, legroom_fee: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn-secondary" onClick={() => setShowPricing(false)} style={{ flex: 1, justifyContent: 'center' }}><X size={13} /> Cancel</button>
            <button className="btn-primary" onClick={handleApplyPricing} disabled={actionLoading} style={{ flex: 1, justifyContent: 'center' }}>
              <Zap size={13} /> Apply All
            </button>
          </div>
        </div>
      )}
    </>
  );
}
