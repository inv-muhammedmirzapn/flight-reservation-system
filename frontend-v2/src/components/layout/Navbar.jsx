import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "@/store/authSlice";

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const auth = useSelector((state) => state?.auth) || {};
  const { isAuthenticated, profile, decodedToken } = auth;

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleLanguage = () => {
    const newLang = i18n.language?.startsWith("ja") ? "en" : "ja";
    i18n.changeLanguage(newLang);
  };

  const handleLogout = () => {
    dispatch(logout());
    setIsProfileMenuOpen(false);
    navigate("/login");
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.username) {
      return profile.username.substring(0, 2).toUpperCase();
    }
    if (decodedToken?.username) {
      return decodedToken.username.substring(0, 2).toUpperCase();
    }
    return "AM";
  };

  const isFlightsActive = location.pathname === "/" || location.pathname.startsWith("/flights");
  const isBookingsActive = location.pathname.startsWith("/my-bookings");

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/20 backdrop-blur-md border-b border-white/10 shadow-sm transition-all duration-300 w-[90%] max-w-7xl rounded-b-3xl mx-auto">
      <div className="max-w-7xl w-full mx-auto px-6 h-14 flex items-center justify-between">
        
        {/* Left: Logo */}
        <div
          className="flex items-center cursor-pointer transform hover:scale-105 transition-transform duration-200"
          onClick={() => navigate("/")}
        >
          <img 
            src="/updated%20logo.png" 
            alt="Passenger Logo" 
            className="h-7 object-contain"
          />
        </div>

        {/* Center: Navigation Links (When Authenticated) */}
        {isAuthenticated ? (
          <div className="flex items-center gap-8 text-xs px-20 flex-1">
            <Link
              to="/"
              className={`transition-all duration-200 px-3 py-1 rounded-full cursor-pointer ${
                isFlightsActive
                  ? "font-extrabold text-slate-900"
                  : "font-semibold text-slate-700 hover:text-slate-900"
              }`}
            >
              Flights
            </Link>
            <Link
              to="/my-bookings"
              className={`transition-all duration-200 px-3 py-1 rounded-full cursor-pointer ${
                isBookingsActive
                  ? "font-extrabold text-slate-900"
                  : "font-semibold text-slate-700 hover:text-slate-900"
              }`}
            >
              Bookings
            </Link>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-8 text-xs flex-1 px-20">
            <Link
              to="/"
              className={`transition-all duration-200 px-3 py-1 rounded-full cursor-pointer ${
                isFlightsActive
                  ? "font-extrabold text-slate-900"
                  : "font-semibold text-slate-700 hover:text-slate-900"
              }`}
            >
              Flights
            </Link>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          
          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="btn-secondary flex items-center gap-1.5 text-[10px] py-1.5 px-3 rounded-xl cursor-pointer"
          >
            <span className={i18n.language?.startsWith("ja") ? "opacity-40" : "opacity-100 font-bold"}>EN</span>
            <span className="opacity-20">|</span>
            <span className={i18n.language?.startsWith("ja") ? "opacity-100 font-bold" : "opacity-40"}>JA</span>
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-3 relative" ref={profileMenuRef}>
              
              {/* Notification Bell */}
              <button
                type="button"
                onClick={() => navigate("/notifications")}
                className="text-slate-900 hover:text-black transition-colors p-1.5 rounded-full w-9 h-9 rounded-full hover:bg-black/5 cursor-pointer flex items-center justify-center"
                title="Notifications"
              >
                <span className="material-symbols-outlined text-xl select-none">
                  notifications
                </span>
              </button>

              {/* User Avatar Circle Badge */}
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="w-9 h-9 rounded-full bg-[#ffd600] text-black font-bold text-xs flex items-center justify-center shadow-[0_0_16px_rgba(255,214,0,0.85)] active:scale-95 transition-all cursor-pointer select-none"
              >
                {getInitials()}
              </button>

              {/* Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-12 w-48 bg-white backdrop-blur-xl border border-slate-200/60 shadow-xl rounded-2xl p-2 animate-fade-in z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {profile?.username || decodedToken?.username || "Passenger"}
                    </p>
                    {profile?.email && (
                      <p className="text-[10px] text-slate-500 truncate">{profile.email}</p>
                    )}
                  </div>

                  <div className="py-1 border-b border-slate-100">
                    <Link
                      to="/profile"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100/80 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <span className="material-symbols-outlined text-sm">person</span>
                      My Profile
                    </Link>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer text-left"
                  >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    Sign Out
                  </button>
                </div>
              )}

            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="btn-primary text-xs px-5 py-2 rounded-xl"
            >
              {t("navbar.loginOrRegister", "Login or Register")}
            </button>
          )}

        </div>

      </div>
    </nav>
  );
}
