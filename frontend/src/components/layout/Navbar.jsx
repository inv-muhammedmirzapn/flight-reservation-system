import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export function Navbar() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [initials, setInitials] = useState("?");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Check login state on mount and whenever localStorage changes
  const checkAuth = () => {
    const token = localStorage.getItem("access");
    const firstName = localStorage.getItem("firstName") || "";
    const lastName = localStorage.getItem("lastName") || "";
    const username = localStorage.getItem("username") || "";
    setIsLoggedIn(!!token);
    if (firstName || lastName) {
      setInitials(
        `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || username.charAt(0).toUpperCase()
      );
    } else if (username) {
      setInitials(username.charAt(0).toUpperCase());
    } else {
      setInitials("U");
    }
  };

  useEffect(() => {
    checkAuth();
    window.addEventListener("storage", checkAuth);
    // Also listen for custom event triggered after login
    window.addEventListener("authChange", checkAuth);
    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("authChange", checkAuth);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("firstName");
    localStorage.removeItem("lastName");
    localStorage.removeItem("username");
    setDropdownOpen(false);
    window.dispatchEvent(new Event("authChange"));
    navigate("/login");
  };

  return (
    <nav className="bg-white/70 backdrop-blur-[30px] w-full sticky top-0 z-50 shadow-[0px_20px_40px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center h-20 px-4 md:px-8 max-w-[1200px] mx-auto">
        {/* Logo */}
        <div
          className="font-headline-lg text-2xl md:text-3xl text-on-surface tracking-tighter font-bold cursor-pointer"
          onClick={() => navigate("/")}
        >
          AeroGlass
        </div>

        {/* Right side */}
        <div className="flex gap-4 items-center">
          {!isLoggedIn ? (
            <>
              <button
                onClick={() => navigate("/login")}
                className="text-on-surface-variant font-display-bold text-display-bold hover:text-primary transition-all duration-300 hidden md:block font-semibold"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/register")}
                className="bg-on-surface text-primary-container px-6 py-2 rounded-xl font-display-bold text-display-bold hover:bg-surface-variant hover:text-on-surface transition-colors duration-300 active:scale-95 font-semibold"
              >
                Join Club
              </button>
            </>
          ) : (
            <div className="relative" ref={dropdownRef}>
              {/* Avatar Button */}
              <button
                id="profile-avatar-btn"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="w-10 h-10 rounded-full bg-primary-container text-on-surface font-bold text-sm flex items-center justify-center shadow-md hover:scale-105 transition-transform duration-200 border-2 border-white/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="Profile menu"
              >
                {initials}
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-3 w-52 bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.10)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-3 border-b border-surface-container">
                    <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                      My Account
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      id="nav-view-profile"
                      onClick={() => { setDropdownOpen(false); navigate("/profile"); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors duration-150 flex items-center gap-2.5"
                    >
                      <span className="text-base">👤</span> View Profile
                    </button>
                    <button
                      id="nav-logout"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-error hover:bg-error-container/40 transition-colors duration-150 flex items-center gap-2.5"
                    >
                      <span className="text-base">🚪</span> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}