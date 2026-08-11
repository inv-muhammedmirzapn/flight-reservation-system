import { BarChart2 } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="h-72 flex flex-col items-center justify-center gap-2 text-admin-muted">
      <BarChart2 size={32} className="opacity-30" />
      <span className="text-sm">No data</span>
    </div>
  );
}
