export function Input({ id, label, type = "text", ...props }) {
  return (
    <div className="relative floating-input bg-white/50 border border-white/60 rounded-xl px-4 py-2 focus-within:border-primary/50 transition-colors">
      <input 
        className="w-full bg-transparent border-none outline-none focus:ring-0 font-body-md text-on-surface pt-4 pb-1 z-10 relative peer" 
        id={id} name={id} placeholder=" " type={type} {...props}
      />
      <label className="absolute left-4 top-1/2 -translate-y-1/2 font-body-md text-on-surface-variant transition-all duration-200 pointer-events-none origin-left" htmlFor={id}>
        {label}
      </label>
    </div>
  );
}
