import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, Ticket, CheckCircle, XCircle, Percent,
  PlaneTakeoff, AlertCircle, BarChart2, Building2, Gauge,
} from 'lucide-react';
import {
  fetchAnalyticsSummary, fetchMonthlyRevenue, fetchPopularRoutes,
  fetchFlightOccupancy, fetchPeakBookingHours,
  fetchAirlinePerformance, fetchAircraftUtilization,
} from '@/services/analytics-service';
import AnalyticsFilterBar from './components/AnalyticsFilterBar';
import { INR } from '@/utils/formatters';


// ─── Palette (JS constants — Recharts reads raw SVG colour strings) ─────────
const GOLD = '#ffd700';
const GOLD_DARK = '#705d00';
const DARK = '#1a1c1d';
const GREEN = '#059669';
const RED = '#dc2626';
const BLUE = '#3b82f6';
const PURPLE = '#7c3aed';
const AMBER = '#d97706';
const MUTED = '#5e5e5e';
const REFRESH_INTERVAL_MS = 30_000;

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent, loading, tooltip }) {
  return (
    <div className="backdrop-blur-[25px] border border-white/50 bg-[rgba(255,255,255,0.72)] shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex items-center gap-3.5 rounded-admin-lg min-w-0 relative cursor-default transition-all duration-200 py-[18px] px-[20px] hover:z-50 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)] lg:gap-2.5 lg:px-[14px] lg:py-[16px] xl:gap-3.5 xl:px-[20px] xl:py-[22px] group">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 lg:w-10 lg:h-10 lg:rounded-xl xl:w-12 xl:h-12 xl:rounded-2xl" style={{ background: `${accent}18` }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold tracking-[0.07em] uppercase text-[#5e5e5e] mb-1 whitespace-nowrap overflow-hidden text-ellipsis">{label}</div>
        <div className="font-ui font-extrabold text-[22px] xl:text-[26px] leading-none whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-300" style={{ color: loading ? '#d0c6ab' : accent }}>
          {loading ? '—' : value}
        </div>
        {sub && !loading && <div className="text-[11px] text-[#5e5e5e] mt-[3px] whitespace-nowrap overflow-hidden text-ellipsis">{sub}</div>}
      </div>
      {tooltip && !loading && (
        <div className="invisible opacity-0 pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1 backdrop-blur-[10px] text-[#ffd700] font-bold text-sm rounded-admin-sm whitespace-nowrap z-[100] transition-all duration-150 top-[calc(100%+8px)] bg-[rgba(26,28,29,0.95)] py-[7px] px-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.25)] after:absolute after:left-1/2 after:-translate-x-1/2 after:border-[6px] after:border-transparent after:content-[''] after:bottom-[100%] after:border-b-[rgba(26,28,29,0.95)] group-hover:visible group-hover:opacity-100 group-hover:translate-y-0">{tooltip}</div>
      )}
    </div>
  );
}

// ─── Chart Card ──────────────────────────────────────────────────────────────
function ChartCard({ title, children, loading, action }) {
  return (
    <div className="backdrop-blur-[25px] border border-white/50 bg-[rgba(255,255,255,0.72)] shadow-[0_10px_30px_rgba(0,0,0,0.04)] rounded-admin-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="text-base font-bold text-[#1a1c1d]">{title}</div>
        {action}
      </div>
      {loading ? (
        <div className="h-72 flex items-center justify-center">
          <div className="w-9 h-9 rounded-full border-[3px] border-[#705d00]/15 animate-spin border-t-[#705d00]" />
        </div>
      ) : children}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function Empty() {
  return (
    <div className="h-72 flex flex-col items-center justify-center gap-2 text-[#5e5e5e]">
      <BarChart2 size={32} style={{ opacity: 0.3 }} />
      <span className="text-sm">No data</span>
    </div>
  );
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)',
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

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const { t } = useTranslation();

  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [occupancy, setOccupancy] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [airlinePerf, setAirlinePerf] = useState([]);
  const [aircraftUtil, setAircraftUtil] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});
  const intervalRef = useRef(null);

  const load = useCallback(async (isSilent = false, f = {}) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const dateFilters = { startDate: f.startDate, endDate: f.endDate, airlineId: f.airlineId, aircraftId: f.aircraftId };
      const [s, m, r, o, p, ap, au] = await Promise.all([
        fetchAnalyticsSummary(dateFilters),
        fetchMonthlyRevenue(12, dateFilters),
        fetchPopularRoutes(10, dateFilters),
        fetchFlightOccupancy(10, dateFilters),
        fetchPeakBookingHours(dateFilters),
        fetchAirlinePerformance(10, { startDate: f.startDate, endDate: f.endDate }),
        fetchAircraftUtilization(10, { startDate: f.startDate, endDate: f.endDate }),
      ]);
      setSummary(s);
      setMonthly((m || []).sort((a, b) => new Date(a.month) - new Date(b.month)));
      setRoutes((r || []).sort((a, b) => (b.bookings || 0) - (a.bookings || 0)));
      setOccupancy((o || []).sort((a, b) => (b.occupancy_rate || 0) - (a.occupancy_rate || 0)));
      setPeakHours((p || []).sort((a, b) => (a.hour || 0) - (b.hour || 0)));
      setAirlinePerf((ap || []).sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0)));
      setAircraftUtil((au || []).sort((a, b) => (b.total_flights || 0) - (a.total_flights || 0)));
    } catch (err) {
      if (!isSilent) setError(err.message || 'Failed to load analytics data.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false, filters);
    intervalRef.current = setInterval(() => load(true, filters), REFRESH_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(true, filters); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(intervalRef.current); document.removeEventListener('visibilitychange', onVisible); };
  }, [load, filters]);

  const handleFilterChange = useCallback((f) => { setFilters(f); load(false, f); }, [load]);



  return (
    <div className="min-h-screen font-ui pt-[88px] pb-[60px] bg-[linear-gradient(135deg,#f7f4ee_0%,#edeade_50%,#f0ede4_100%)]">
      <div className="w-[95%] max-w-[1800px] mx-auto px-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="font-ui text-2xl font-extrabold text-[#1a1c1d] tracking-[-0.02em] m-0 leading-tight">{t('admin.analytics.title')}</h1>
            <p className="text-sm text-[#5e5e5e] mt-1 mb-0">{t('admin.analytics.subtitle')}</p>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="flex items-center gap-3 bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] p-4 rounded-admin-lg mb-6 font-ui text-sm">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button className="font-bold underline cursor-pointer bg-transparent border-none p-0 ml-auto transition-opacity hover:opacity-70 text-[#dc2626]" onClick={() => load(false, filters)}>{t('admin.analytics.retry')}</button>
          </div>
        )}

        {/* ── Filter Bar ── */}
        <AnalyticsFilterBar onFilterChange={handleFilterChange} disabled={loading} />

        {/* ── KPI Grid ── */}
        <div className="grid mb-6 grid-cols-2 gap-[10px] sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 lg:gap-3 xl:gap-4">
          <KpiCard icon={<TrendingUp size={20} color={GOLD_DARK} />} label={t('admin.analytics.kpi.totalRevenue')} value={summary ? INR(summary.total_revenue) : '—'} sub={t('admin.analytics.kpi.revenueSub')} accent={GOLD_DARK} loading={loading}
            tooltip={summary ? `Exact: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(summary.total_revenue)}` : undefined} />
          <KpiCard icon={<Ticket size={20} color={BLUE} />} label={t('admin.analytics.kpi.totalBookings')} value={summary ? summary.total_bookings.toLocaleString() : '—'} sub={t('admin.analytics.kpi.bookingsSub')} accent={BLUE} loading={loading} />
          <KpiCard icon={<CheckCircle size={20} color={GREEN} />} label={t('admin.analytics.kpi.confirmed')} value={summary ? summary.confirmed_bookings.toLocaleString() : '—'} sub={t('admin.analytics.kpi.confirmedSub')} accent={GREEN} loading={loading} />
          <KpiCard icon={<XCircle size={20} color={RED} />} label={t('admin.analytics.kpi.cancelled')} value={summary ? summary.cancelled_bookings.toLocaleString() : '—'} sub={t('admin.analytics.kpi.cancelledSub')} accent={RED} loading={loading} />
          <KpiCard icon={<Percent size={20} color={AMBER} />} label={t('admin.analytics.kpi.cancellationRate')} value={summary ? `${summary.cancellation_rate}%` : '—'} sub={t('admin.analytics.kpi.rateSub')} accent={AMBER} loading={loading} />

        </div>

        {/* ── Row 1: Monthly Revenue + Popular Routes ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
          <ChartCard title={t('admin.analytics.charts.monthlyRevenue')} loading={loading}>
            {monthly.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthly} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOLD_DARK} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={GOLD_DARK} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
                  <YAxis width={90} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 10_000_000 ? `₹${(v / 10_000_000).toFixed(1)}Cr` : v >= 100_000 ? `₹${(v / 100_000).toFixed(0)}L` : `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip currency />} />
                  <Area type="monotone" dataKey="revenue" stroke={GOLD_DARK} strokeWidth={2.5} fill="url(#revGrad)"
                    dot={{ r: 4, fill: GOLD_DARK, strokeWidth: 0 }} activeDot={{ r: 6, fill: GOLD_DARK }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title={t('admin.analytics.charts.popularRoutes')} loading={loading}>
            {routes.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={routes} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} tickFormatter={v => v.toLocaleString()} />
                  <YAxis type="category" dataKey="route" tick={{ fontSize: 11, fill: DARK, fontWeight: 600 }} width={110} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="bookings" radius={[0, 6, 6, 0]} maxBarSize={22} fill={GOLD} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ── Row 2: Peak Hours + Flight Occupancy ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
          <ChartCard title={t('admin.analytics.charts.peakHours')} loading={loading}>
            {peakHours.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={peakHours} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false}
                    tickFormatter={h => `${String(h).padStart(2, '0')}:00`} interval={1} />
                  <YAxis width={80} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="bookings" radius={[4, 4, 0, 0]} maxBarSize={20}>
                    {peakHours.map((entry, i) => {
                      const max = Math.max(...peakHours.map(p => p.bookings));
                      return <Cell key={i} fill={entry.bookings === max ? GOLD_DARK : `${GOLD}80`} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title={t('admin.analytics.charts.flightOccupancy')} loading={loading}>
            {occupancy.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={occupancy} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="flight_number" tick={{ fontSize: 11, fill: DARK, fontWeight: 600 }} width={90} tickLine={false} axisLine={false} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="bg-white/95 backdrop-blur-xl border border-black/8 rounded-xl px-3.5 py-2.5 shadow-2xl">
                        <div className="text-xs font-bold text-gray-700 mb-1">{label} — {d?.route}</div>
                        <div className="text-xs text-gray-500">{d?.booked_seats} / {d?.total_seats} seats</div>
                        <div className="text-sm font-bold mt-1" style={{ color: GOLD_DARK }}>{d?.occupancy_rate}% occupied</div>
                      </div>
                    );
                  }} />
                  <Bar dataKey="occupancy_rate" radius={[0, 6, 6, 0]} maxBarSize={20}>
                    {occupancy.map((f, i) => {
                      const c = f.occupancy_rate >= 80 ? GOLD_DARK : f.occupancy_rate >= 60 ? '#9b7d00' : f.occupancy_rate >= 40 ? '#c9a800' : GOLD;
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
          <div className="flex gap-[18px] justify-end mt-3 flex-wrap">
            {[
              [GOLD_DARK, '≥ 80%'], ['#9b7d00', '60–79%'], ['#c9a800', '40–59%'], [GOLD, '< 40%'],
            ].map(([color, label]) => (
              <div key={label} className="flex items-center gap-[5px] text-[11px] text-[#5e5e5e]">
                <div className="w-2.5 h-2.5 rounded shrink-0" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        )}

        {/* ── Row 3: Airline Performance + Aircraft Utilization ── */}
        {!(filters.airlineId || filters.aircraftId) && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">

            {/* Airline Performance */}
            <ChartCard title="Airline Performance" loading={loading} action={
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: GOLD_DARK }}>
                <Building2 size={13} /> Top 10
              </span>
            }>
              {airlinePerf.length === 0 ? <Empty /> : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={airlinePerf} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="iata_code" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
                      <YAxis width={80} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false}
                        tickFormatter={v => v >= 100_000 ? `₹${(v / 100_000).toFixed(0)}L` : v.toLocaleString()} />
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="bg-white/95 backdrop-blur-xl border border-black/8 rounded-xl px-3.5 py-2.5 shadow-2xl min-w-[180px]">
                            <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 4 }}>{d?.airline_name}</div>
                            <div style={{ fontSize: 12, color: MUTED }}>Revenue: <b style={{ color: DARK }}>{INR(d?.total_revenue)}</b></div>
                            <div style={{ fontSize: 12, color: MUTED }}>Bookings: <b style={{ color: DARK }}>{d?.total_bookings?.toLocaleString()}</b></div>
                            <div style={{ fontSize: 12, color: MUTED }}>Cancel rate: <b style={{ color: RED }}>{d?.cancellation_rate}%</b></div>
                          </div>
                        );
                      }} />
                      <Bar dataKey="total_revenue" radius={[4, 4, 0, 0]} maxBarSize={32} fill={GOLD} />
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Mini table */}
                  <div className="mt-4 space-y-1.5">
                    {airlinePerf.slice(0, 5).map(a => (
                      <div key={a.airline_id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg" style={{ background: 'rgba(112,93,0,0.04)' }}>
                        <span className="font-semibold" style={{ color: DARK }}>{a.iata_code} <span style={{ color: MUTED, fontWeight: 400 }}>{a.airline_name}</span></span>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold" style={{ color: GOLD_DARK }}>{INR(a.total_revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </ChartCard>

            {/* Aircraft Utilization */}
            <ChartCard title="Aircraft Utilization" loading={loading} action={
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: PURPLE }}>
                <Gauge size={13} /> Top 10
              </span>
            }>
              {aircraftUtil.length === 0 ? <Empty /> : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={aircraftUtil} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="registration" tick={{ fontSize: 11, fill: DARK, fontWeight: 600 }} width={80} tickLine={false} axisLine={false} />
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="bg-white/95 backdrop-blur-xl border border-black/8 rounded-xl px-3.5 py-2.5 shadow-2xl min-w-[200px]">
                            <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 4 }}>{label} · {d?.aircraft_model}</div>
                            <div style={{ fontSize: 12, color: MUTED }}>Flights: <b style={{ color: DARK }}>{d?.total_flights}</b></div>
                            <div style={{ marginTop: 6, fontSize: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: MUTED }}><span>Economy</span><b style={{ color: DARK }}>{d?.economy_fill_rate}%</b></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: MUTED }}><span>Business</span><b style={{ color: DARK }}>{d?.business_fill_rate}%</b></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: MUTED }}><span>First</span><b style={{ color: DARK }}>{d?.first_fill_rate}%</b></div>
                            </div>
                          </div>
                        );
                      }} />
                      <Bar dataKey="total_flights" radius={[0, 6, 6, 0]} maxBarSize={20} fill={GOLD} />
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Cabin fill breakdown */}
                  <div className="mt-4 space-y-1.5">
                    {aircraftUtil.slice(0, 4).map(ac => (
                      <div key={ac.aircraft_id} className="flex items-center gap-3 text-xs px-2 py-1.5 rounded-lg" style={{ background: 'rgba(112,93,0,0.04)' }}>
                        <span className="font-semibold w-20 flex-shrink-0" style={{ color: DARK }}>{ac.registration}</span>
                        <div className="flex-1 flex gap-2">
                          {[['E', ac.economy_fill_rate, GREEN], ['B', ac.business_fill_rate, BLUE], ['F', ac.first_fill_rate, GOLD_DARK]].map(([cls, rate, color]) => (
                            <div key={cls} className="flex items-center gap-1">
                              <span style={{ color: MUTED }}>{cls}:</span>
                              <span className="font-semibold" style={{ color }}>{rate}%</span>
                            </div>
                          ))}
                        </div>
                        <span style={{ color: MUTED }}>{ac.total_flights} flt</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </ChartCard>
          </div>
        )}

      </div>
    </div>
  );
}