import React from 'react';
import { INR } from '@/utils/formatters';

export default function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-[10px] border border-admin-border rounded-xl py-2.5 px-3.5 shadow-admin-lg">
      <div className="text-xs font-bold text-admin-muted mb-1.5">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-sm font-bold" style={{ color: p.color || '#1a1c1d' }}>
          {currency ? INR(p.value) : p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}
