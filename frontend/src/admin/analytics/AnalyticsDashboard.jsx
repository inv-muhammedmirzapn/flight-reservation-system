import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, Ticket, CheckCircle, XCircle, Percent,
  PlaneTakeoff, AlertCircle, BarChart2,
} from 'lucide-react';
import {
  fetchAnalyticsSummary,
  fetchMonthlyRevenue,
  fetchPopularRoutes,
  fetchFlightOccupancy,
  fetchPeakBookingHours,
} from '@/services/analytics-service';
import { INR } from '@/utils/formatters';
import '@/admin/_core/styles/admin.css';

// ─── Palette ────────────────────────────────────────────────────────────────
// Kept as JS constants — Recharts reads these as raw SVG colour strings, not CSS classes.
const GOLD      = '#ffd700';
const GOLD_DARK = '#705d00';
const DARK      = '#1a1c1d';
const GREEN     = '#059669';
const RED       = '#dc2626';
const BLUE      = '#3b82f6';
const PURPLE    = '#7c3aed';
const AMBER     = '#d97706';
const MUTED     = '#5e5e5e';
const REFRESH_INTERVAL_MS = 30_000;

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent, loading, tooltip }) {
  return (
    <div className="glass-card kpi-card">
      {/* icon background tint is a runtime prop → must stay inline */}
      <div className="kpi-icon-wrap" style={{ background: `${accent}18` }}>
        {icon}
      </div>

      <div className="kpi-text">
        <div className="kpi-label">{label}</div>
        {/* text colour is a runtime prop → must stay inline */}
        <div
          className="kpi-value"
          style={{ color: loading ? '#d0c6ab' : accent }}
        >
          {loading ? '—' : value}
        </div>
        {sub && !loading && <div className="kpi-sub">{sub}</div>}
      </div>

      {/* Tooltip — shown on hover via pure CSS (.kpi-card:hover .kpi-tooltip) */}
      {tooltip && !loading && (
        <div className="kpi-tooltip">{tooltip}</div>
      )}
    </div>
  );
}

// ─── Chart Card ──────────────────────────────────────────────────────────────
function ChartCard({ title, children, loading }) {
  return (
    <div className="chart-card">
      <div className="chart-card-title">{title}</div>
      {loading ? (
        <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="admin-spinner" />
        </div>
      ) : children}
    </div>
  );
}

// ─── Custom Recharts Tooltip ─────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
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

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const { t } = useTranslation();
  const [summary,   setSummary]   = useState(null);
  const [monthly,   setMonthly]   = useState([]);
  const [routes,    setRoutes]    = useState([]);
  const [occupancy, setOccupancy] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const intervalRef = useRef(null);

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const [s, m, r, o, p] = await Promise.all([
        fetchAnalyticsSummary(),
        fetchMonthlyRevenue(12),
        fetchPopularRoutes(10),
        fetchFlightOccupancy(15),
        fetchPeakBookingHours(),
      ]);
      setSummary(s);
      setMonthly(m);
      setRoutes(r);
      setOccupancy(o);
      setPeakHours(p);
    } catch (err) {
      if (!isSilent) setError(err.message || 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    intervalRef.current = setInterval(() => load(true), REFRESH_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const avgOccupancy = summary?.avg_occupancy ?? 0;

  return (
    <div className="admin-page">
      <div className="admin-container">

        {/* ── Page Header ── */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">{t('admin.analytics.title')}</h1>
            <p className="admin-page-subtitle">{t('admin.analytics.subtitle')}</p>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="admin-error">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => load(false)}>
              {t('admin.analytics.retry')}
            </button>
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div className="kpi-grid">
          <KpiCard
            icon={<TrendingUp size={22} color={GOLD_DARK} />}
            label={t('admin.analytics.kpi.totalRevenue')}
            value={summary ? INR(summary.total_revenue) : '—'}
            sub={t('admin.analytics.kpi.revenueSub')}
            accent={GOLD_DARK}
            loading={loading}
            tooltip={summary
              ? `Exact: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(summary.total_revenue)}`
              : undefined}
          />
          <KpiCard
            icon={<Ticket size={22} color={BLUE} />}
            label={t('admin.analytics.kpi.totalBookings')}
            value={summary ? summary.total_bookings.toLocaleString() : '—'}
            sub={t('admin.analytics.kpi.bookingsSub')}
            accent={BLUE}
            loading={loading}
          />
          <KpiCard
            icon={<CheckCircle size={22} color={GREEN} />}
            label={t('admin.analytics.kpi.confirmed')}
            value={summary ? summary.confirmed_bookings.toLocaleString() : '—'}
            sub={t('admin.analytics.kpi.confirmedSub')}
            accent={GREEN}
            loading={loading}
          />
          <KpiCard
            icon={<XCircle size={22} color={RED} />}
            label={t('admin.analytics.kpi.cancelled')}
            value={summary ? summary.cancelled_bookings.toLocaleString() : '—'}
            sub={t('admin.analytics.kpi.cancelledSub')}
            accent={RED}
            loading={loading}
          />
          <KpiCard
            icon={<Percent size={22} color={AMBER} />}
            label={t('admin.analytics.kpi.cancellationRate')}
            value={summary ? `${summary.cancellation_rate}%` : '—'}
            sub={t('admin.analytics.kpi.rateSub')}
            accent={AMBER}
            loading={loading}
          />
          <KpiCard
            icon={<PlaneTakeoff size={22} color={PURPLE} />}
            label={t('admin.analytics.kpi.avgOccupancy')}
            value={loading ? '—' : `${avgOccupancy}%`}
            sub={t('admin.analytics.kpi.occupancySub')}
            accent={PURPLE}
            loading={loading}
          />
        </div>

        {/* ── Row 1: Monthly Revenue + Popular Routes ── */}
        <div className="chart-grid-2">

          <ChartCard title={t('admin.analytics.charts.monthlyRevenue')} loading={loading}>
            {monthly.length === 0 ? (
              <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 14, gap: 8 }}>
                <BarChart2 size={28} style={{ opacity: 0.3 }} /> {t('admin.analytics.noData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthly} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={GOLD_DARK} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={GOLD_DARK} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
                  <YAxis width={90} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false}
                    tickFormatter={v =>
                      v >= 10_000_000 ? `₹${(v / 10_000_000).toFixed(1)}Cr`
                      : v >= 100_000   ? `₹${(v / 100_000).toFixed(0)}L`
                      :                  `₹${(v / 1000).toFixed(0)}k`
                    }
                  />
                  <Tooltip content={<CustomTooltip currency />} />
                  <Area
                    type="monotone" dataKey="revenue" name={t('admin.analytics.tooltip.revenue')}
                    stroke={GOLD_DARK} strokeWidth={2.5}
                    fill="url(#revGrad)"
                    dot={{ r: 4, fill: GOLD_DARK, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: GOLD_DARK }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title={t('admin.analytics.charts.popularRoutes')} loading={loading}>
            {routes.length === 0 ? (
              <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 14, gap: 8 }}>
                <BarChart2 size={28} style={{ opacity: 0.3 }} /> {t('admin.analytics.noData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={routes} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false}
                    tickFormatter={v => v.toLocaleString()} />
                  <YAxis type="category" dataKey="route"
                    tick={{ fontSize: 11, fill: DARK, fontWeight: 600 }}
                    width={110} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="bookings" name={t('admin.analytics.tooltip.bookings')}
                    radius={[0, 6, 6, 0]} maxBarSize={22} fill={GOLD} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ── Row 2: Peak Hours + Flight Occupancy ── */}
        <div className="chart-grid-2" style={{ marginBottom: 0 }}>

          <ChartCard title={t('admin.analytics.charts.peakHours')} loading={loading}>
            {peakHours.length === 0 ? (
              <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 14, gap: 8 }}>
                <BarChart2 size={28} style={{ opacity: 0.3 }} /> {t('admin.analytics.noData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={peakHours} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false}
                    tickFormatter={h => `${String(h).padStart(2,'0')}:00`} interval={1} />
                  <YAxis width={80} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />}
                    formatter={(v) => [v, t('admin.analytics.tooltip.bookings')]}
                    labelFormatter={h => `${t('admin.analytics.tooltip.hour')} ${String(h).padStart(2,'0')}:00`} />
                  <Bar dataKey="bookings" name={t('admin.analytics.tooltip.bookings')} radius={[4, 4, 0, 0]} maxBarSize={20}>
                    {peakHours.map((entry, i) => {
                      const max = Math.max(...peakHours.map(p => p.bookings));
                      return <Cell key={i} fill={entry.bookings === max ? GOLD_DARK : `${GOLD}99`} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title={t('admin.analytics.charts.flightOccupancy')} loading={loading}>
            {occupancy.length === 0 ? (
              <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 14, gap: 8 }}>
                <BarChart2 size={28} style={{ opacity: 0.3 }} /> {t('admin.analytics.noData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={occupancy} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false}
                    tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="flight_number"
                    tick={{ fontSize: 11, fill: DARK, fontWeight: 600 }}
                    width={90} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div style={{
                          background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
                          padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 4 }}>{label} — {d?.route}</div>
                          <div style={{ fontSize: 12, color: MUTED }}>{d?.booked_seats} / {d?.total_seats} {t('admin.analytics.tooltip.seats')}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: GOLD_DARK, marginTop: 4 }}>{d?.occupancy_rate}% {t('admin.analytics.tooltip.occupied')}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="occupancy_rate" name={t('admin.analytics.tooltip.occupancy')} radius={[0, 6, 6, 0]} maxBarSize={20}>
                    {occupancy.map((f, i) => {
                      const c = f.occupancy_rate >= 80 ? GOLD_DARK
                              : f.occupancy_rate >= 60 ? '#9b7d00'
                              : f.occupancy_rate >= 40 ? '#c9a800'
                              : GOLD;
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
          <div className="occupancy-legend">
            {[
              [GOLD_DARK,  t('admin.analytics.legend.gte80')],
              ['#9b7d00', t('admin.analytics.legend.60to79')],
              ['#c9a800', t('admin.analytics.legend.40to59')],
              [GOLD,       t('admin.analytics.legend.lt40')],
            ].map(([color, label]) => (
              <div key={label} className="occupancy-legend-item">
                <div className="occupancy-legend-dot" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}