import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../../store/authSlice';
import { Plane, LogOut, ShieldAlert } from 'lucide-react';

export function Navbar({ onAuthTabChange }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, profile } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  return (
    <nav className="bg-white/70 backdrop-blur-[30px] w-full sticky top-0 z-50 shadow-[0px_20px_40px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center h-20 px-4 md:px-8 max-w-[1200px] mx-auto">
        
        {/* Brand/Logo */}
        <Link to="/" className="flex items-center gap-2 font-headline-lg text-2xl md:text-3xl text-on-surface tracking-tighter font-bold select-none cursor-pointer">
          <Plane className="w-6 h-6 text-primary rotate-45" />
          <span>AeroGlass</span>
        </Link>
        
        <div className="flex gap-4 items-center">
          {isAuthenticated ? (
            <>
              {/* User Info / Panel Indicator */}
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <span className="flex items-center gap-1 text-xs font-black bg-rose-50 text-rose-700 border border-rose-100 px-3 py-1 rounded-full uppercase">
                    <ShieldAlert className="w-3.5 h-3.5" /> Admin
                  </span>
                ) : (
                  <span className="text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full uppercase">
                    Customer
                  </span>
                )}
                
                <span className="text-sm font-semibold text-on-surface hidden sm:inline">
                  Hello, {profile?.username || 'User'}
                </span>
              </div>

              {/* Logout Button */}
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-all duration-300 font-semibold text-sm active:scale-95 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => {
                  onAuthTabChange?.(true);
                  navigate('/');
                }} 
                className="text-on-surface-variant font-display-bold text-display-bold hover:text-primary transition-all duration-300 hidden md:block font-semibold cursor-pointer"
              >
                Sign In
              </button>
              <button 
                onClick={() => {
                  onAuthTabChange?.(false);
                  navigate('/');
                }} 
                className="bg-on-surface text-primary-container px-6 py-2 rounded-xl font-display-bold text-display-bold hover:bg-[#333] transition-colors duration-300 active:scale-95 font-semibold cursor-pointer"
              >
                Join Club
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
