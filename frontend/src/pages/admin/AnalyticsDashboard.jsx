import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, Ticket, CheckCircle, XCircle, Percent,
  PlaneTakeoff, RefreshCw, AlertCircle, BarChart2,
} from 'lucide-react';
import {
  fetchAnalyticsSummary,
  fetchMonthlyRevenue,
  fetchPopularRoutes,
  fetchFlightOccupancy,
  fetchPeakBookingHours,
} from '@/services/analytics-service';

// ─── Palette ────────────────────────────────────────────────────────
const GOLD    = '#ffd700';
const DARK    = '#1a1c1d';
const GREEN   = '#059669';
const RED     = '#dc2626';
const BLUE    = '#3b82f6';
const PURPLE  = '#7c3aed';
const AMBER   = '#d97706';
const MUTED   = '#5e5e5e';

const CHART_COLORS = [GOLD, BLUE, GREEN, PURPLE, AMBER, RED, '#06b6d4', '#ec4899', '#84cc16', '#f97316'];

const INR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

// ─── KPI Card ───────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent, loading }) {
  return (
    <div
      className="glass-card"
      style={{
        borderRadius: 20, padding: '22px 24px',
        display: 'flex', alignItems: 'center', gap: 18,
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        background: `${accent}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{
          fontSize: 26, fontWeight: 800, color: loading ? '#d0c6ab' : accent,
          fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", lineHeight: 1,
          transition: 'color 0.3s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {loading ? '—' : value}
        </div>
        {sub && !loading && (
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ─── Chart Card wrapper ──────────────────────────────────────────────
function ChartCard({ title, children, loading }) {
  return (
    <div className="glass-card" style={{ borderRadius: 20, padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: DARK, fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}>
        {title}
      </div>
      {loading ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: 36, height: 36, border: `3px solid rgba(112,93,0,0.15)`,
            borderTopColor: '#705d00', borderRadius: '50%', animation: 'spin 1s linear infinite',
          }} />
        </div>
      ) : children}
    </div>
  );
}

// ─── Custom Tooltip ──────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
      padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 14, fontWeight: 700, color: p.color || DARK }}>
          {currency ? INR(p.value) : p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [summary, setSummary]           = useState(null);
  const [monthly, setMonthly]           = useState([]);
  const [routes, setRoutes]             = useState([]);
  const [occupancy, setOccupancy]       = useState([]);
  const [peakHours, setPeakHours]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, m, r, o, p] = await Promise.all([
        fetchAnalyticsSummary(),
        fetchMonthlyRevenue(12),
        fetchPopularRoutes(10),
        fetchFlightOccupancy(10),
        fetchPeakBookingHours(),
      ]);
      setSummary(s);
      setMonthly(m);
      setRoutes(r);
      setOccupancy(o);
      setPeakHours(p);
    } catch (err) {
      setError(err.message || 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Average occupancy from top flights
  const avgOccupancy = occupancy.length
    ? (occupancy.reduce((sum, f) => sum + f.occupancy_rate, 0) / occupancy.length).toFixed(1)
    : 0;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .chart-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 900px) { .chart-grid-2 { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ width: '95%', maxWidth: 1800, margin: '0 auto', padding: '88px 24px 48px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
          <div>
            <h1 style={{
              fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
              fontSize: 28, fontWeight: 800, color: DARK, letterSpacing: '-0.02em',
            }}>
              Booking Analytics Dashboard
            </h1>
            <p style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>
              Real-time aggregated insights across revenue, bookings, routes and occupancy.
            </p>
          </div>
          <button
            id="analytics-refresh-btn"
            onClick={load}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', background: loading ? 'rgba(0,0,0,0.05)' : DARK,
              color: loading ? MUTED : GOLD, fontWeight: 700, fontSize: 13,
              borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#2a2d2e'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = DARK; }}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 18px', background: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: 12,
            color: '#b91c1c', fontSize: 14, marginBottom: 24,
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
            <button
              onClick={load}
              style={{
                marginLeft: 'auto', padding: '6px 14px', background: RED,
                color: '#fff', fontWeight: 700, fontSize: 12,
                borderRadius: 8, border: 'none', cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <KpiCard
            icon={<TrendingUp size={24} color={GOLD} />}
            label="Total Revenue"
            value={summary ? INR(summary.total_revenue) : '—'}
            sub="from confirmed bookings"
            accent="#705d00"
            loading={loading}
          />
          <KpiCard
            icon={<Ticket size={24} color={BLUE} />}
            label="Total Bookings"
            value={summary?.total_bookings ?? '—'}
            sub="all time"
            accent={BLUE}
            loading={loading}
          />
          <KpiCard
            icon={<CheckCircle size={24} color={GREEN} />}
            label="Confirmed"
            value={summary?.confirmed_bookings ?? '—'}
            sub="active bookings"
            accent={GREEN}
            loading={loading}
          />
          <KpiCard
            icon={<XCircle size={24} color={RED} />}
            label="Cancelled"
            value={summary?.cancelled_bookings ?? '—'}
            sub="total cancellations"
            accent={RED}
            loading={loading}
          />
          <KpiCard
            icon={<Percent size={24} color={AMBER} />}
            label="Cancellation Rate"
            value={summary ? `${summary.cancellation_rate}%` : '—'}
            sub="cancelled / total"
            accent={AMBER}
            loading={loading}
          />
          <KpiCard
            icon={<PlaneTakeoff size={24} color={PURPLE} />}
            label="Avg Occupancy"
            value={loading ? '—' : `${avgOccupancy}%`}
            sub="top 10 flights"
            accent={PURPLE}
            loading={loading}
          />
        </div>

        {/* ── Row 1: Monthly Revenue + Popular Routes ── */}
        <div className="chart-grid-2" style={{ marginBottom: 20 }}>

          {/* Monthly Revenue AreaChart */}
          <ChartCard title="📈 Monthly Revenue (last 12 months)" loading={loading}>
            {monthly.length === 0 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 14 }}>
                <BarChart2 size={32} style={{ opacity: 0.3, marginRight: 8 }} /> No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthly} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#705d00" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#705d00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip currency />} />
                  <Area
                    type="monotone" dataKey="revenue" name="Revenue"
                    stroke="#705d00" strokeWidth={2.5}
                    fill="url(#revGrad)" dot={{ r: 4, fill: '#705d00', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#705d00' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Popular Routes HorizontalBarChart */}
          <ChartCard title="🗺️ Popular Routes (top 10 by bookings)" loading={loading}>
            {routes.length === 0 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 14 }}>
                <BarChart2 size={32} style={{ opacity: 0.3, marginRight: 8 }} /> No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, routes.length * 36)}>
                <BarChart
                  data={routes}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="route" tick={{ fontSize: 11, fill: DARK, fontWeight: 600 }} width={90} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="bookings" name="Bookings" radius={[0, 6, 6, 0]} maxBarSize={22}>
                    {routes.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ── Row 2: Peak Hours + Occupancy ── */}
        <div className="chart-grid-2">

          {/* Peak Booking Hours BarChart */}
          <ChartCard title="🕐 Peak Booking Hours (UTC)" loading={loading}>
            {peakHours.length === 0 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 14 }}>
                <BarChart2 size={32} style={{ opacity: 0.3, marginRight: 8 }} /> No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={peakHours} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false}
                    tickFormatter={h => `${String(h).padStart(2, '0')}:00`}
                    interval={1}
                  />
                  <YAxis tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => [v, 'Bookings']} labelFormatter={h => `Hour ${String(h).padStart(2,'0')}:00`} />
                  <Bar dataKey="bookings" name="Bookings" radius={[4, 4, 0, 0]} maxBarSize={20}>
                    {peakHours.map((entry, i) => {
                      const max = Math.max(...peakHours.map(p => p.bookings));
                      return <Cell key={i} fill={entry.bookings === max ? '#705d00' : `${GOLD}99`} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Flight Occupancy HorizontalBarChart */}
          <ChartCard title="✈️ Flight Occupancy (top 10)" loading={loading}>
            {occupancy.length === 0 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 14 }}>
                <BarChart2 size={32} style={{ opacity: 0.3, marginRight: 8 }} /> No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, occupancy.length * 36)}>
                <BarChart
                  data={occupancy}
                  layout="vertical"
                  margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false}
                    tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="flight_number" tick={{ fontSize: 11, fill: DARK, fontWeight: 600 }} width={60} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div style={{
                          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
                          padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 4 }}>{label} — {d?.route}</div>
                          <div style={{ fontSize: 12, color: MUTED }}>{d?.booked_seats} / {d?.total_seats} seats</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#705d00', marginTop: 4 }}>{d?.occupancy_rate}% occupied</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="occupancy_rate" name="Occupancy %" radius={[0, 6, 6, 0]} maxBarSize={22}>
                    {occupancy.map((f, i) => {
                      const c = f.occupancy_rate >= 80 ? RED : f.occupancy_rate >= 50 ? AMBER : GREEN;
                      return <Cell key={i} fill={c} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ── Occupancy Legend ── */}
        {!loading && occupancy.length > 0 && (
          <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'flex-end' }}>
            {[['≥ 80% — High', RED], ['50–79% — Medium', AMBER], ['< 50% — Low', GREEN]].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                {label}
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
}
