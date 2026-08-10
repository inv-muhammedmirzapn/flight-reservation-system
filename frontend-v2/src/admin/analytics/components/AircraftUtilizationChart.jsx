import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Gauge } from 'lucide-react';
import ChartCard from './ChartCard';
import EmptyState from './EmptyState';
import { GOLD, GOLD_DARK, GREEN, BLUE, DARK, MUTED } from '../constants';

export default function AircraftUtilizationChart({ data, loading, title }) {
  return (
    <ChartCard title={title} loading={loading} action={
      <span className="flex items-center gap-1.5 text-xs font-semibold text-status-purple">
        <Gauge size={13} /> Top 10
      </span>
    }>
      {data.length === 0 ? <EmptyState /> : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="registration" tick={{ fontSize: 11, fill: DARK, fontWeight: 600 }} width={80} tickLine={false} axisLine={false} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="bg-white/95 backdrop-blur-xl border border-admin-border rounded-xl px-3.5 py-2.5 shadow-admin-lg min-w-[200px]">
                    <div className="text-[13px] font-bold text-admin-ink mb-1">{label} · {d?.aircraft_model}</div>
                    <div className="text-xs text-admin-muted">Flights: <b className="text-admin-ink">{d?.total_flights}</b></div>
                    <div className="text-xs text-admin-muted">Avg occupancy: <b className="text-admin-accent-dark">{d?.avg_occupancy}%</b></div>
                    <div className="mt-1.5 text-xs">
                      <div className="flex justify-between text-admin-muted"><span>Economy</span><b className="text-admin-ink">{d?.economy_fill_rate}%</b></div>
                      <div className="flex justify-between text-admin-muted"><span>Business</span><b className="text-admin-ink">{d?.business_fill_rate}%</b></div>
                      <div className="flex justify-between text-admin-muted"><span>First</span><b className="text-admin-ink">{d?.first_fill_rate}%</b></div>
                    </div>
                  </div>
                );
              }} />
              <Bar dataKey="avg_occupancy" radius={[0, 6, 6, 0]} maxBarSize={20}>
                {data.map((ac, i) => {
                  const c = ac.avg_occupancy >= 80 ? GOLD_DARK : ac.avg_occupancy >= 60 ? '#9b7d00' : ac.avg_occupancy >= 40 ? '#c9a800' : GOLD;
                  return <Cell key={i} fill={c} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-1.5">
            {data.slice(0, 5).map(ac => (
              <div key={ac.aircraft_id} className="flex items-center gap-3 text-xs px-2 py-1.5 rounded-lg bg-admin-accent-dark/5">
                <span className="font-semibold w-20 flex-shrink-0 text-admin-ink">{ac.registration}</span>
                <div className="flex-1 flex gap-2">
                  {[['E', ac.economy_fill_rate, GREEN], ['B', ac.business_fill_rate, BLUE], ['F', ac.first_fill_rate, GOLD_DARK]].map(([cls, rate, color]) => (
                    <div key={cls} className="flex items-center gap-1">
                      <span className="text-admin-muted">{cls}:</span>
                      <span className="font-semibold" style={{ color }}>{rate}%</span>
                    </div>
                  ))}
                </div>
                <span className="text-admin-muted">{ac.total_flights} flt</span>
              </div>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  );
}
