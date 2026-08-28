import { Loader2 } from 'lucide-react';

export function TableSkeletonLoader({ rows = 5 }) {
  return (
    <div className="p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton h-5 w-1/4" />
          <div className="skeleton h-5 w-[35%]" />
          <div className="skeleton h-5 w-[15%]" />
        </div>
      ))}
    </div>
  );
}

export function SpinnerLoader({ size, className = '' }) {
  if (size) {
    return <Loader2 size={size} className={`animate-spin shrink-0 ${className}`} />;
  }

  return (
    <div className="admin-spinner-wrap">
      <div className="admin-spinner" />
    </div>
  );
}
