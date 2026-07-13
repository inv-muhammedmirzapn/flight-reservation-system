export function Navbar({ setIsLogin }) {
  return (
    <nav className="bg-white/70 backdrop-blur-[30px] w-full sticky top-0 z-50 shadow-[0px_20px_40px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center h-20 px-4 md:px-8 max-w-[1200px] mx-auto">
        <div className="font-headline-lg text-2xl md:text-3xl text-on-surface tracking-tighter font-bold">
          AeroGlass
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => setIsLogin(true)} className="text-on-surface-variant font-display-bold text-display-bold hover:text-primary transition-all duration-300 hidden md:block font-semibold">
            Sign In
          </button>
          <button onClick={() => setIsLogin(false)} className="bg-on-surface text-primary-container px-6 py-2 rounded-xl font-display-bold text-display-bold hover:bg-surface-variant hover:text-on-surface transition-colors duration-300 active:scale-95 font-semibold">
            Join Club
          </button>
        </div>
      </div>
    </nav>
  );
}
