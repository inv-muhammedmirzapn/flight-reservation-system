import { useEffect, useState, useRef, Fragment, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '@/admin/_core/styles/admin.css';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { fetchFlightInstances, fetchSeats, generateSeats, bulkPriceSeats } from '@/admin/_core/store/adminSlices';
import { ArrowLeft, AlertTriangle, Check, DollarSign, X, ChevronRight, Utensils } from 'lucide-react';
import toast from 'react-hot-toast';
import { parseApiError } from '@/utils/errorUtils';

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
  const inFlow = searchParams.get('inFlow') === '1';

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

  const load = useCallback(id => {
    if (!id) return;
    dispatch(fetchSeats({ flight_instance: id, page_size: 2000 }))
      .unwrap()
      .then(() => setShowMap(true))
      .catch(err => toast.error(parseApiError(err, 'Failed to load seats. Check if the backend is running.')));
  }, [dispatch]);

  useEffect(() => {
    if (!instances || instances.length === 0) {
      dispatch(fetchFlightInstances({ page_size: 500 }));
    }
  }, [dispatch, instances.length]);

  useEffect(() => {
    if (instanceParam) {
      setSelInstance(instanceParam);
      load(instanceParam);
    }
  }, [instanceParam, load]);

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
  }, [classTab, seats, activeFilters]);

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
      <div className="smp-wrap">
        <div className="smp-breadcrumb">
          FLIGHT INSTANCES / SEAT MAP {selInstance ? `(INSTANCE #${selInstance})` : ''}
        </div>

        <div className="smp-header">
          <div className="smp-header-left">
            {instanceParam && (
              <button
                className="smp-back"
                onClick={() => {
                  const fromPage = searchParams.get('fromPage');
                  if (fromPage) {
                    navigate(`/admin/operations/flight-instances?page=${fromPage}&highlightInstance=${instanceParam}`);
                  } else {
                    navigate('/admin/operations/flight-instances');
                  }
                }}
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
            <h1 className="smp-title">Seat Pricing & Selection</h1>
          </div>
          {instanceParam && inFlow && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const fromPage = searchParams.get('fromPage');
                  navigate(`/admin/operations/meals?instance=${instanceParam}&inFlow=1${fromPage ? `&fromPage=${fromPage}` : ''}`);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#705d00] hover:bg-[#5a4b00] text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all border-none"
              >
                <Utensils size={14} /> Skip / Next: Flight Meals <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const fromPage = searchParams.get('fromPage');
                  if (fromPage) {
                    navigate(`/admin/operations/flight-instances?page=${fromPage}&highlightInstance=${instanceParam}`);
                  } else {
                    navigate('/admin/operations/flight-instances');
                  }
                }}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-semibold text-xs transition-all border border-slate-200 cursor-pointer"
              >
                Finish Flow
              </button>
            </div>
          )}
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

                            // Get layout string from flight instance or fallback
                            let layoutStr = '3-3';
                            if (selInstanceObj) {
                              if (cabinClass === 'FIRST') layoutStr = selInstanceObj.aircraft_first_class_layout || '2-2';
                              else if (cabinClass === 'BUSINESS') layoutStr = selInstanceObj.aircraft_business_layout || '2-2';
                              else if (cabinClass === 'ECONOMY') layoutStr = selInstanceObj.aircraft_economy_layout || '3-3';
                            }
                            const layout = layoutStr.split('-').map(x => parseInt(x, 10)).filter(x => !isNaN(x) && x > 0);
                            if (layout.length === 0) layout.push(3, 3);
                            const colCount = layout.reduce((a, b) => a + b, 0);

                            // Pad to expected columns
                            const padded = [];
                            for (let ci = 0; ci < colCount; ci++) {
                              const letter = String.fromCharCode(65 + ci);
                              const found = rowSeats.find(s => s.seat_number.endsWith(letter));
                              padded.push(found || null);
                            }

                            const groups = [];
                            let currentOffset = 0;
                            layout.forEach((segSize) => {
                              groups.push(padded.slice(currentOffset, currentOffset + segSize));
                              currentOffset += segSize;
                            });

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
                                {groups.map((group, gIdx) => (
                                  <Fragment key={gIdx}>
                                    <div className="smp-grp">{group.map(renderSeat)}</div>
                                    {gIdx < groups.length - 1 && <div className="smp-aisle" />}
                                  </Fragment>
                                ))}
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
              Apply Price
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
