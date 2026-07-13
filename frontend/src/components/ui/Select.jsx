export function Select({ id, label, options = [], ...props }) {
  return (
    <div className="relative bg-white/50 border border-white/60 rounded-xl px-4 py-2 focus-within:border-primary/50 transition-colors">
      <select 
        className="w-full bg-transparent border-none outline-none focus:ring-0 font-body-md text-on-surface pt-4 pb-1 z-10 relative peer appearance-none cursor-pointer" 
        id={id} name={id} {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white text-on-surface">
            {opt.label}
          </option>
        ))}
      </select>
      <label className="absolute left-4 top-1 text-xs font-semibold text-on-surface-variant pointer-events-none z-20">
        {label}
      </label>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant z-20">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
