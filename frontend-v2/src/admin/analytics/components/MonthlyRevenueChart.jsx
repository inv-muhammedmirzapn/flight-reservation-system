import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import EmptyState from './EmptyState';
import CustomTooltip from './CustomTooltip';
import { GOLD_DARK, MUTED } from '../constants';

export default function MonthlyRevenueChart({ data, loading, title }) {
  return (
    <ChartCard title={title} loading={loading}>
      {data.length === 0 ? <EmptyState /> : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
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
  );
}
