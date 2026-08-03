import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '@/admin/_core/styles/admin.css';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { fetchFlightInstances, fetchSeats, generateSeats, bulkPriceSeats } from '@/admin/_core/store/adminSlices';
import { Zap, ArrowLeft, AlertTriangle, Check, DollarSign, X } from 'lucide-react';
import toast from 'react-hot-toast';

const ATTRS = [
  { id: 'window', label: 'Window' },
  { id: 'aisle', label: 'Aisle' },
  { id: 'middle', label: 'Middle' },
];
const CLASS_TABS = ['ALL', 'FIRST', 'BUSINESS', 'ECONOMY'];
const CLASS_LABELS = { ALL: 'All Classes', FIRST: 'First', BUSINESS: 'Business', ECONOMY: 'Economy' };
const CLASS_COLORS = { FIRST: '#fbbf24', BUSINESS: '#818cf8', ECONOMY: '#34d399' };

/* Derive position from seat_number column letter + cabin layout.
   E.g. for Economy 3-3 (ABCDEF): A=window, B=middle, C=aisle | D=aisle, E=middle, F=window
   For Business/First 2-2 (ABCD): A=window, B=aisle | C=aisle, D=window */
function derivePosition(seatNumber, seatClass) {
  if (!seatNumber) return '';
  const letter = seatNumber.slice(-1).toUpperCase();
  if (!/[A-Z]/.test(letter)) return '';
  const colIdx = letter.charCodeAt(0) - 65; // A=0, B=1, ...

  // Determine cols_per_row by class
  let cols;
  if (seatClass === 'ECONOMY') cols = 6;
  else cols = 4; // FIRST and BUSINESS use 2-2

  const leftBlock = Math.floor(cols / 2);

  if (colIdx < leftBlock) {
    // Left block: first=window, last=aisle, else middle
    if (colIdx === 0) return 'window';
    if (colIdx === leftBlock - 1) return 'aisle';
    return 'middle';
  } else {
    // Right block: first=aisle, last=window, else middle
    const ri = colIdx - leftBlock;
    const rightBlock = cols - leftBlock;
    if (ri === 0) return 'aisle';
    if (ri === rightBlock - 1) return 'window';
    return 'middle';
  }
}

function getEffectiveAttrs(seat) {
  // Use DB-stored position first, fallback to derivation
  const pos = seat.position || derivePosition(seat.seat_number, seat.seat_class);
  const attrs = [];
  if (pos) attrs.push(pos.toLowerCase());
  if (seat.exit_row) attrs.push('exit_row');
  if (seat.extra_legroom) attrs.push('extra_legroom');
  return attrs;
}

export default function SeatMapPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items: instances } = useSelector(s => s.flightInstance);
  const { items: seats, loading: seatsLoading, actionLoading } = useSelector(s => s.seat);
  const [searchParams] = useSearchParams();
  const instanceParam = searchParams.get('instance') || '';

  const [selInstance, setSelInstance] = useState(instanceParam);
  const [showMap, setShowMap] = useState(!!instanceParam);
  const [activeFilters, setActiveFilters] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [classTab, setClassTab] = useState('ALL');
  const [bulkPrice, setBulkPrice] = useState('');

  const mapRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragCur, setDragCur] = useState(null);
  const [dragMode, setDragMode] = useState('add');

  const load = id => {
    if (!id) return;
    dispatch(fetchSeats({ flight_instance: id, page_size: 2000 }))
      .unwrap()
      .then(() => setShowMap(true))
      .catch(err => toast.error(`Failed to load seats: ${err?.message || err || 'Check if the backend is running'}`));
  };

  useEffect(() => {
    dispatch(fetchFlightInstances({ page_size: 500 }));
  }, [dispatch]);

  useEffect(() => {
    if (instanceParam) {
      setSelInstance(instanceParam);
      load(instanceParam);
    }
  }, [instanceParam]);

  const handleInstanceChange = id => {
    setSelInstance(id); setSelectedIds(new Set()); setActiveFilters([]);
    if (id) load(id); else setShowMap(false);
  };

  const handleGenerate = () => {
    if (!selInstance) return;
    toast.promise(dispatch(generateSeats(selInstance)).unwrap(), {
      loading: 'Generating seats…',
      success: r => { load(selInstance); return r?.detail || 'Seats generated successfully!'; },
      error: e => String(e?.detail || e || 'Failed to generate seats.'),
    });
  };

  // Filter by class scope then attribute
  const scopedSeats = classTab === 'ALL' ? seats : seats.filter(s => s.seat_class === classTab);

  const handleFilterToggle = attrId => {
    setActiveFilters(prev => {
      const next = prev.includes(attrId) ? prev.filter(x => x !== attrId) : [...prev, attrId];
      if (!next.length) { setSelectedIds(new Set()); return next; }
      const sel = new Set();
      scopedSeats.forEach(seat => {
        const ea = getEffectiveAttrs(seat);
        if (next.some(a => ea.includes(a))) sel.add(seat.id);
      });
      setSelectedIds(sel);
      return next;
    });
  };

  // Re-run filter selection when classTab changes
  useEffect(() => {
    if (!activeFilters.length) return;
    const scoped = classTab === 'ALL' ? seats : seats.filter(s => s.seat_class === classTab);
    const sel = new Set();
    scoped.forEach(seat => {
      const ea = getEffectiveAttrs(seat);
      if (activeFilters.some(a => ea.includes(a))) sel.add(seat.id);
    });
    setSelectedIds(sel);
  }, [classTab, seats]);

  const handleSeatClick = (e, seat) => {
    e.preventDefault(); e.stopPropagation();
    setSelectedIds(prev => { const n = new Set(prev); n.has(seat.id) ? n.delete(seat.id) : n.add(seat.id); return n; });
  };

  // Drag selection
  const handlePointerDown = e => {
    if (e.button !== 0 || !mapRef.current) return;
    const r = mapRef.current.getBoundingClientRect();
    setIsDragging(true); setDragStart({ x: e.clientX - r.left, y: e.clientY - r.top });
    setDragCur({ x: e.clientX - r.left, y: e.clientY - r.top });
    setDragMode(e.shiftKey ? 'remove' : 'add');
    e.target.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = e => {
    if (!isDragging || !mapRef.current) return;
    const r = mapRef.current.getBoundingClientRect();
    setDragCur({ x: Math.max(0, Math.min(e.clientX - r.left, r.width)), y: Math.max(0, Math.min(e.clientY - r.top, r.height)) });
  };
  const handlePointerUp = () => {
    if (!isDragging) return; setIsDragging(false);
    if (!dragStart || !dragCur) return;
    const l = Math.min(dragStart.x, dragCur.x), ri = Math.max(dragStart.x, dragCur.x);
    const t = Math.min(dragStart.y, dragCur.y), b = Math.max(dragStart.y, dragCur.y);
    const sel = new Set(selectedIds);
    document.querySelectorAll('[data-seat-id]').forEach(n => {
      const sr = n.getBoundingClientRect(), mr = mapRef.current.getBoundingClientRect();
      const sl = sr.left - mr.left, sR = sr.right - mr.left, st = sr.top - mr.top, sb = sr.bottom - mr.top;
      if (!(ri < sl || l > sR || b < st || t > sb)) {
        const id = parseInt(n.getAttribute('data-seat-id'), 10);
        dragMode === 'add' ? sel.add(id) : sel.delete(id);
      }
    });
    setSelectedIds(sel); setDragStart(null); setDragCur(null);
  };

  const handleBulkApply = () => {
    if (!selectedIds.size) return toast.error('No seats selected.');
    if (!bulkPrice || isNaN(bulkPrice) || Number(bulkPrice) < 0) return toast.error('Enter a valid price.');
    const autoRule = activeFilters.length ? activeFilters.join('+') : '';
    toast.promise(dispatch(bulkPriceSeats({ seatIds: [...selectedIds], price: bulkPrice, ruleLabel: autoRule })).unwrap(), {
      loading: 'Applying…', success: r => { load(selInstance); return r.detail || 'Done!'; }, error: e => String(e),
    });
  };

  // Build seat grid grouped by class
  const parseSeat = s => {
    const m = s.seat_number.match(/^([A-Z]?)(\d+)([A-Z])$/);
    if (!m) {
      const numMatch = s.seat_number.match(/\d+/);
      const row = numMatch ? parseInt(numMatch[0], 10) : 0;
      const letterMatch = s.seat_number.match(/[A-Z]$/);
      const col = letterMatch ? letterMatch[0] : '';
      return { prefix: '', row, col };
    }
    return { prefix: m[1], row: parseInt(m[2], 10), col: m[3] };
  };

  const buildGrid = (seatList) => {
    const byClass = {};
    seatList.forEach(s => {
      if (!byClass[s.seat_class]) byClass[s.seat_class] = {};
      const p = parseSeat(s);
      const rowKey = `${p.prefix}${p.row}`;
      if (!byClass[s.seat_class][rowKey]) byClass[s.seat_class][rowKey] = [];
      byClass[s.seat_class][rowKey].push(s);
    });
    // Sort cols within each row
    Object.values(byClass).forEach(rows => {
      Object.values(rows).forEach(cols => cols.sort((a, b) => a.seat_number.localeCompare(b.seat_number)));
    });
    return byClass;
  };

  const grid = buildGrid(seats);
  const classOrder = ['FIRST', 'BUSINESS', 'ECONOMY'].filter(c => grid[c] && Object.keys(grid[c]).length > 0);

  const instanceOptions = instances.map(i => ({ value: String(i.id), label: `${i.flight_no || i.flight_number} — ${i.date} (${i.status})` }));
  const selInstanceObj = instances.find(i => String(i.id) === String(selInstance));
  const hasSeatCountWarning = selInstanceObj && seats.length > 0 && seats.length !== selInstanceObj.total_capacity;

  // Selection class summary
  const selClasses = new Set();
  selectedIds.forEach(id => { const s = seats.find(x => x.id === id); if (s) selClasses.add(s.seat_class); });
  const selClassLabel = selClasses.size === 0 ? '' : selClasses.size === 1 ? CLASS_LABELS[Array.from(selClasses)[0]] || '' : 'Mixed Classes';

  const dragBox = () => {
    if (!isDragging || !dragStart || !dragCur) return { display: 'none' };
    return {
      position: 'absolute', left: Math.min(dragStart.x, dragCur.x), top: Math.min(dragStart.y, dragCur.y),
      width: Math.abs(dragCur.x - dragStart.x), height: Math.abs(dragCur.y - dragStart.y),
      backgroundColor: dragMode === 'add' ? 'rgba(14,165,233,0.15)' : 'rgba(239,68,68,0.15)',
      border: `1.5px dashed ${dragMode === 'add' ? '#0ea5e9' : '#ef4444'}`, pointerEvents: 'none', zIndex: 100,
    };
  };

  return (
    <>
      <style>{`
        .smp-wrap{width:95%;max-width:1600px;margin:0 auto;padding:88px 20px 24px}
        .smp-body{display:flex;gap:24px;align-items:flex-start}
        .smp-sidebar{width:300px;flex-shrink:0;position:sticky;top:88px;max-height:calc(100vh - 104px);overflow-y:auto}
        .smp-main{flex:1;min-width:0;max-height:calc(100vh - 88px);overflow-y:auto;padding-right:4px}
        .smp-breadcrumb{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
        .smp-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
        .smp-header-left{display:flex;align-items:center;gap:16px}
        .smp-back{display:flex;align-items:center;gap:4px;background:rgba(0,0,0,.05);border:none;border-radius:6px;padding:6px 12px;font-size:13px;font-weight:600;color:#333;cursor:pointer;transition:background 0.2s}
        .smp-back:hover{background:rgba(0,0,0,.08)}
        .smp-title{font-size:24px;font-weight:800;color:#1a1c1d;margin:0}
        
        .smp-section{margin-bottom:12px}
        .smp-section-label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;display:block}
        
        .smp-instance-row{display:flex;align-items:center;gap:8px;width:100%}
        
        .smp-chip-group{display:flex;flex-wrap:wrap;gap:8px;padding-bottom:10px;border-bottom:1px solid #e2e8f0;margin-bottom:10px}
        .smp-chip-group:last-child{border-bottom:none;padding-bottom:0;margin-bottom:0}
        
        .smp-chip{padding:4px 12px;border-radius:20px;border:1px solid #cbd5e1;background:#fff;color:#475569;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s}
        .smp-chip:hover{background:#f8fafc;border-color:#94a3b8}
        .smp-chip.on{background:#0f172a;color:#fff;border-color:#0f172a}
        
        .smp-ctab{padding:4px 12px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;color:#475569;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s}
        .smp-ctab:hover{background:#f8fafc;border-color:#94a3b8}
        .smp-ctab.on{background:#1e293b;color:#fff;border-color:#1e293b}
        
        .smp-warning{display:flex;align-items:center;gap:6px;background:#fef3c7;color:#b45309;padding:6px 10px;border-radius:6px;font-size:12px;font-weight:600;margin-top:8px}
        
        .smp-plane{display:flex;justify-content:center;padding:12px 0}
        .smp-fuselage{background:#fff;width:380px;border-radius:190px 190px 12px 12px;padding:110px 28px 40px;box-shadow:0 6px 24px rgba(0,0,0,.08);position:relative;touch-action:none}
        .smp-class-hdr{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;text-align:center;padding:6px 0 4px;margin:12px 0 6px;border-radius:4px}
        .smp-row{display:flex;align-items:center;justify-content:center;gap:3px;margin-bottom:4px}
        .smp-grp{display:flex;gap:3px}
        .smp-aisle{width:22px}
        .smp-rn{font-size:9px;color:#999;width:16px;text-align:center;font-weight:700}
        .smp-seat{width:28px;height:28px;border:1.5px solid #d1d5db;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;background:#fff;user-select:none;transition:transform .1s;font-size:8px;font-weight:700;color:#666}
        .smp-seat.una{background:#f3f4f6;cursor:not-allowed;opacity:.5}
        .smp-seat.free{background:#dcfce7;border-color:#4ade80}
        .smp-seat.prem{background:#dbeafe;border-color:#93c5fd}
        .smp-seat.sprem{background:#f3e8ff;border-color:#c084fc}
        .smp-seat.sel{border-color:#0ea5e9!important;box-shadow:0 0 0 2px rgba(14,165,233,.3);transform:scale(1.08);z-index:5}
        .smp-conflict{position:absolute;top:-5px;right:-5px;width:13px;height:13px;border-radius:50%;background:#ef4444;color:#fff;display:flex;align-items:center;justify-content:center;z-index:10}
        .smp-legend{display:flex;gap:16px;align-items:center;justify-content:center;padding:4px 0 8px 0;font-size:11px;color:#475569;margin-bottom:0}
        .smp-lbox{width:16px;height:16px;border-radius:4px;border:1px solid #ccc}
        .smp-lbox.fr{background:#4ade80;border-color:#22c55e}
        .smp-lbox.pr{background:#93c5fd;border-color:#60a5fa}
        .smp-lbox.sp{background:#c084fc;border-color:#a855f7}
        .smp-bar{background:#fff;border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,.12);padding:10px 16px;display:flex;align-items:center;gap:12px;position:sticky;bottom:32px;z-index:200;border:1px solid #e2e8f0;width:fit-content;margin:16px auto 0}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="smp-wrap">
        <div className="smp-breadcrumb">
          FLIGHT INSTANCES / SEAT MAP {selInstance ? `(INSTANCE #${selInstance})` : ''}
        </div>

        <div className="smp-header">
          <div className="smp-header-left">
            <button className="smp-back" onClick={() => navigate(-1)}><ArrowLeft size={14} /> Back</button>
            <h1 className="smp-title">Seat Pricing & Selection</h1>
          </div>
        </div>

        <div className="smp-body">
          {/* ── LEFT SIDEBAR ── */}
          <div className="smp-sidebar">

            {/* Filters Section A: Flight Instance */}
            <div className="smp-section">
              <span className="smp-section-label">Flight Instance</span>
              <div className="smp-instance-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Select id="seat-map-instance" options={[{ value: '', label: '— Select Flight Instance —' }, ...instanceOptions]} value={selInstance} onChange={e => handleInstanceChange(e.target.value)} style={{ margin: 0, height: '38px', padding: '0 32px 0 12px' }} />
                </div>
                <button className="btn-primary" onClick={() => { setSelectedIds(new Set()); load(selInstance); }} disabled={!selInstance || seatsLoading} style={{ padding: '0 14px', height: '38px', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {seatsLoading ? 'Loading…' : 'Search Seats'}
                </button>
              </div>
              {hasSeatCountWarning && (
                <div className="smp-warning">
                  <AlertTriangle size={14} />
                  Showing {seats.length} of {selInstanceObj.total_capacity} seats — check seat generation logic, capacity may have changed.
                </div>
              )}
            </div>

            {showMap && seats.length > 0 && (
              <div className="smp-section" style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                {/* Filters Section B: Cabin Class */}
                <div style={{ marginBottom: 10 }}>
                  <span className="smp-section-label">Cabin Class Scope</span>
                  <div className="smp-chip-group">
                    {CLASS_TABS.map(c => (
                      <button key={c} className={`smp-ctab ${classTab === c ? 'on' : ''}`} onClick={() => setClassTab(c)}>{CLASS_LABELS[c]}</button>
                    ))}
                  </div>
                </div>

                {/* Filters Section C: Attributes */}
                <div>
                  <span className="smp-section-label">Select By Attribute</span>
                  <div className="smp-chip-group" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    {ATTRS.map(a => (
                      <button key={a.id} className={`smp-chip ${activeFilters.includes(a.id) ? 'on' : ''}`} onClick={() => handleFilterToggle(a.id)}>{a.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Legend */}
            {showMap && seats.length > 0 && (
              <div className="smp-legend" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="smp-lbox fr" /> Free</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="smp-lbox pr" /> ₹1–460</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="smp-lbox sp" /> ₹461+</span>
              </div>
            )}
            {showMap && seats.length > 0 && (
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, lineHeight: 1.4 }}>Drag to select • Shift+drag to deselect • Click to toggle</p>
            )}
          </div>{/* end sidebar */}

          {/* ── RIGHT COLUMN (seat map) ── */}
          <div className="smp-main">
            {selInstance && showMap && (
              seatsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                  <div style={{ width: 28, height: 28, border: '2.5px solid rgba(15,23,42,.12)', borderTopColor: '#0f172a', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                </div>
              ) : seats.length === 0 ? (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>No Seats Found for this Flight</h3>
                  <p style={{ fontSize: 14, color: '#64748b', maxWidth: 420, margin: '0 auto 20px', lineHeight: 1.5 }}>
                    Seats have not been generated for this flight instance yet. Click below to automatically generate seats based on the aircraft layout.
                  </p>
                  <button className="btn-primary" onClick={handleGenerate} disabled={actionLoading} style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {actionLoading ? 'Generating…' : 'Get Seats'}
                  </button>
                </div>
              ) : (
                <div className="smp-plane">
                  <div className="smp-fuselage" ref={mapRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
                    <div style={dragBox()} />

                    {classOrder.filter(c => classTab === 'ALL' || classTab === c).map(cabinClass => {
                      const rows = grid[cabinClass];
                      const rowKeys = Object.keys(rows).sort((a, b) => {
                        const na = parseInt(a.replace(/\D/g, ''), 10), nb = parseInt(b.replace(/\D/g, ''), 10);
                        return na - nb;
                      });

                      return (
                        <div key={cabinClass}>
                          <div className="smp-class-hdr" style={{ background: `${CLASS_COLORS[cabinClass]}22`, color: CLASS_COLORS[cabinClass] }}>{CLASS_LABELS[cabinClass]}</div>
                          {rowKeys.map(rowKey => {
                            const rowSeats = rows[rowKey];
                            const colCount = cabinClass === 'ECONOMY' ? 6 : 4;
                            const leftCount = Math.floor(colCount / 2);

                            // Pad to expected columns
                            const padded = [];
                            for (let ci = 0; ci < colCount; ci++) {
                              const letter = String.fromCharCode(65 + ci);
                              const found = rowSeats.find(s => s.seat_number.endsWith(letter));
                              padded.push(found || null);
                            }
                            const leftGroup = padded.slice(0, leftCount);
                            const rightGroup = padded.slice(leftCount);
                            const rowNum = rowKey.replace(/\D/g, '');

                            const renderSeat = seat => {
                              if (!seat) return <div key={Math.random()} style={{ width: 28, height: 28 }} />;
                              const avail = seat.status === 'AVAILABLE';
                              const fee = Number(seat.seat_fee);
                              const isSel = selectedIds.has(seat.id);
                              let cls = 'smp-seat';
                              if (!avail) cls += ' una';
                              else if (fee === 0) cls += ' free';
                              else if (fee > 460) cls += ' sprem';
                              else cls += ' prem';
                              if (isSel) cls += ' sel';
                              const ea = getEffectiveAttrs(seat);
                              return (
                                <div key={seat.id} data-seat-id={seat.id} className={cls} onClick={e => avail && handleSeatClick(e, seat)} title={`${seat.seat_number} | ${ea.join(', ')} | ₹${seat.seat_fee}`}>
                                  {isSel ? <Check size={12} strokeWidth={3} color="#0ea5e9" /> : <span>{seat.seat_number}</span>}
                                </div>
                              );
                            };

                            return (
                              <div key={rowKey} className="smp-row">
                                <div className="smp-rn">{rowNum}</div>
                                <div className="smp-grp">{leftGroup.map(renderSeat)}</div>
                                <div className="smp-aisle" />
                                <div className="smp-grp">{rightGroup.map(renderSeat)}</div>
                                <div className="smp-rn">{rowNum}</div>
                              </div>
                            );
                          })}
                          <div style={{ height: 6 }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>{/* end smp-main */}
        </div>{/* end smp-body */}

        {/* Sticky bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="smp-bar">
            <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '5px 10px', borderRadius: 6, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>
              {selectedIds.size} seats {selClassLabel && `— ${selClassLabel}`}
            </div>
            <div style={{ width: 100 }}>
              <Input id="bulk-price" type="text" inputMode="numeric" placeholder="Price ₹" value={bulkPrice} onChange={e => { const val = e.target.value; if (val === '' || /^\d*$/.test(val)) setBulkPrice(val); }} style={{ margin: 0, padding: '5px 8px', fontSize: 12 }} />
            </div>
            <button className="btn-primary" onClick={handleBulkApply} disabled={actionLoading} style={{ padding: '6px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <DollarSign size={13} /> Apply Price
            </button>
            <div style={{ width: '1px', height: '18px', background: '#e2e8f0', margin: '0 4px', flexShrink: 0 }} />
            <button
              onClick={() => { setSelectedIds(new Set()); setActiveFilters([]); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '50%',
                transition: 'background 0.2s, color 0.2s',
                flexShrink: 0
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
              title="Clear selection"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
