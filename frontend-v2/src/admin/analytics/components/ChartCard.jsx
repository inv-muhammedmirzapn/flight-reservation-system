import React from 'react';
import PageLoader from '@/admin/_core/components/PageLoader';

export default function ChartCard({ title, children, loading, action }) {
  return (
    <div className="backdrop-blur-[25px] border border-white/50 overflow-hidden bg-admin-surface shadow-[0_10px_30px_rgba(0,0,0,0.04)] rounded-admin-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="text-base font-bold text-admin-ink">{title}</div>
        {action}
      </div>
      {loading ? (
        <PageLoader label="" />
      ) : children}
    </div>
  );
}
