import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import EmptyState from './EmptyState';
import CustomTooltip from './CustomTooltip';
import { GOLD, GOLD_DARK, MUTED } from '../constants';

export default function PeakHoursChart({ data, loading, title }) {
  return (
    <ChartCard title={title} loading={loading}>
      {data.length === 0 ? <EmptyState /> : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false}
              tickFormatter={h => `${String(h).padStart(2, '0')}:00`} interval={1} />
            <YAxis width={80} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="bookings" radius={[4, 4, 0, 0]} maxBarSize={20}>
              {data.map((entry, i) => {
                const max = Math.max(...data.map(p => p.bookings));
                return <Cell key={i} fill={entry.bookings === max ? GOLD_DARK : `${GOLD}80`} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
