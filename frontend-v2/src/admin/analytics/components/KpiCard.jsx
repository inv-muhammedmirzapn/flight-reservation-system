
export default function KpiCard({ icon, label, value, sub, accent, loading, tooltip }) {
  return (
    <div className="backdrop-blur-[25px] border border-white/50 bg-admin-surface shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex items-center gap-3.5 rounded-admin-lg min-w-0 relative cursor-default transition-all duration-200 py-[18px] px-[20px] hover:z-50 hover:-translate-y-0.5 hover:shadow-admin-lg lg:gap-2.5 lg:px-[14px] lg:py-[16px] xl:gap-3.5 xl:px-[20px] xl:py-[22px] group">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 lg:w-10 lg:h-10 lg:rounded-xl xl:w-12 xl:h-12 xl:rounded-2xl" style={{ background: `${accent}18` }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold tracking-[0.07em] uppercase text-admin-muted mb-1 whitespace-nowrap overflow-hidden text-ellipsis">{label}</div>
        <div className="font-ui font-extrabold text-[22px] xl:text-[26px] leading-none whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-300" style={{ color: loading ? '#d0c6ab' : accent }}>
          {loading ? '—' : value}
        </div>
        {sub && !loading && <div className="text-[11px] text-admin-muted mt-[3px] whitespace-nowrap overflow-hidden text-ellipsis">{sub}</div>}
      </div>
      {tooltip && !loading && (
        <div className="invisible opacity-0 pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1 backdrop-blur-[10px] text-admin-accent font-bold text-sm rounded-admin-sm whitespace-nowrap z-[100] transition-all duration-150 top-[calc(100%+8px)] bg-admin-ink/95 py-[7px] px-[14px] shadow-admin-lg after:absolute after:left-1/2 after:-translate-x-1/2 after:border-[6px] after:border-transparent after:content-[''] after:bottom-[100%] after:border-b-admin-ink/95 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0">{tooltip}</div>
      )}
    </div>
  );
}
