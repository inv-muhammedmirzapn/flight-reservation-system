const STATUS_VARIANTS = {
  SCHEDULED: 'status-blue',
  DELAYED: 'status-amber',
  CANCELLED: 'status-red',
  BOARDING: 'status-indigo',
  DEPARTED: 'status-purple',
  ARRIVED: 'status-green',
};

export default function StatusBadge({ status, className = '' }) {
  const variant = STATUS_VARIANTS[status] || 'status-neutral';
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${variant} ${className}`}>
      {status}
    </span>
  );
}
