import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import EmptyState from './EmptyState';
import CustomTooltip from './CustomTooltip';
import { GOLD, DARK, MUTED } from '../constants';

export default function PopularRoutesChart({ data, loading, title }) {
  return (
    <ChartCard title={title} loading={loading}>
      {data.length === 0 ? <EmptyState /> : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} tickFormatter={v => v.toLocaleString()} />
            <YAxis type="category" dataKey="route" tick={{ fontSize: 11, fill: DARK, fontWeight: 600 }} width={110} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="bookings" radius={[0, 6, 6, 0]} maxBarSize={22} fill={GOLD} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
