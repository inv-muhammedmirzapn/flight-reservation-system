import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import EmptyState from './EmptyState';
import { GOLD, GOLD_DARK, DARK, MUTED } from '../constants';

export default function FlightOccupancyChart({ data, loading, title }) {
  return (
    <>
      <ChartCard title={title} loading={loading}>
        {data.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="flight_number" tick={{ fontSize: 11, fill: DARK, fontWeight: 600 }} width={90} tickLine={false} axisLine={false} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="bg-white/95 backdrop-blur-xl border border-admin-border rounded-xl px-3.5 py-2.5 shadow-admin-lg">
                    <div className="text-xs font-bold text-admin-ink mb-1">{label} — {d?.route}</div>
                    <div className="text-xs text-admin-muted">{d?.booked_seats} / {d?.total_seats} seats</div>
                    <div className="text-sm font-bold mt-1" style={{ color: GOLD_DARK }}>{d?.occupancy_rate}% occupied</div>
                  </div>
                );
              }} />
              <Bar dataKey="occupancy_rate" radius={[0, 6, 6, 0]} maxBarSize={20}>
                {data.map((f, i) => {
                  const c = f.occupancy_rate >= 80 ? GOLD_DARK : f.occupancy_rate >= 60 ? '#9b7d00' : f.occupancy_rate >= 40 ? '#c9a800' : GOLD;
                  return <Cell key={i} fill={c} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
      {/* ── Occupancy Legend ── */}
      {!loading && data.length > 0 && (
        <div className="flex gap-[18px] justify-end mt-3 flex-wrap">
          {[
            [GOLD_DARK, '≥ 80%'], ['#9b7d00', '60–79%'], ['#c9a800', '40–59%'], [GOLD, '< 40%'],
          ].map(([color, label]) => (
            <div key={label} className="flex items-center gap-[5px] text-[11px] text-admin-muted">
              <div className="w-2.5 h-2.5 rounded shrink-0" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
