import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Building2 } from 'lucide-react';
import ChartCard from './ChartCard';
import EmptyState from './EmptyState';
import { INR } from '@/utils/formatters';
import { GOLD, GOLD_DARK, MUTED } from '../constants';

export default function AirlinePerformanceChart({ data, loading, title }) {
  return (
    <ChartCard title={title} loading={loading} action={
      <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: GOLD_DARK }}>
        <Building2 size={13} /> Top 10
      </span>
    }>
      {data.length === 0 ? <EmptyState /> : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="iata_code" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
              <YAxis width={80} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 100_000 ? `₹${(v / 100_000).toFixed(0)}L` : v.toLocaleString()} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="bg-white/95 backdrop-blur-xl border border-admin-border rounded-xl px-3.5 py-2.5 shadow-admin-lg min-w-[180px]">
                    <div className="text-[13px] font-bold text-admin-ink mb-1">{d?.airline_name}</div>
                    <div className="text-xs text-admin-muted">Revenue: <b className="text-admin-ink">{INR(d?.total_revenue)}</b></div>
                    <div className="text-xs text-admin-muted">Bookings: <b className="text-admin-ink">{d?.total_bookings?.toLocaleString()}</b></div>
                    <div className="text-xs text-admin-muted">Cancel rate: <b className="text-status-red">{d?.cancellation_rate}%</b></div>
                    <div className="text-xs text-admin-muted">Avg occupancy: <b className="text-admin-accent">{d?.avg_occupancy}%</b></div>
                  </div>
                );
              }} />
              <Bar dataKey="total_revenue" radius={[4, 4, 0, 0]} maxBarSize={32} fill={GOLD} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-1.5">
            {data.slice(0, 5).map(a => (
              <div key={a.airline_id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-admin-accent-dark/5">
                <span className="font-semibold text-admin-ink">{a.iata_code} <span className="text-admin-muted font-normal">{a.airline_name}</span></span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-admin-accent-dark">{INR(a.total_revenue)}</span>
                  <span className="text-admin-muted">{a.avg_occupancy}% occ.</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  );
}
