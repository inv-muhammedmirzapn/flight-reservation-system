import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { logout } from "../../store/authSlice";
import { LogoutConfirmDialog } from "../ui/LogoutConfirmDialog";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

// Nav links shown when authenticated (adapted for the app dashboard)
const APP_NAV_LINKS = [
  { labelKey: "flights", href: "/flights" },
  { labelKey: "bookings", href: "/bookings" },
  { labelKey: "rewards", href: "/rewards" },
  { labelKey: "support", href: "/#support" },
];

const ADMIN_NAV_LINKS = [
  { labelKey: "flights", href: "/admin/flights" },
  { labelKey: "reports", href: "/admin/reports" },
  { labelKey: "users", href: "/admin/users" },
  { labelKey: "support", href: "/#support" },
];

export function Navbar() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, profile } = useSelector((state) => state.auth);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [localFirstName, setLocalFirstName] = useState(localStorage.getItem("firstName") || "");

  useEffect(() => {
    const handleAuthChange = () => setLocalFirstName(localStorage.getItem("firstName") || "");
    window.addEventListener("authChange", handleAuthChange);
    return () => window.removeEventListener("authChange", handleAuthChange);
  }, []);

  // Build initials from Redux profile or local storage
  const firstName = profile?.first_name || localFirstName || "";
  const username = profile?.username || "";
  
  const initials = firstName
    ? firstName.charAt(0).toUpperCase()
    : (username.charAt(0).toUpperCase() || "U");

  const navLinks = isAdmin ? ADMIN_NAV_LINKS : APP_NAV_LINKS;

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

  const toggleLanguage = () => {
    const newLang = i18n.language?.startsWith('en') ? 'ja' : 'en';
    i18n.changeLanguage(newLang);
  };

  const handleLogoutRequest = () => {
    setDropdownOpen(false);
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = () => {
    setLogoutDialogOpen(false);
    toast.success('Signed out successfully.');
    dispatch(logout());
    navigate('/');
  };

  const handleLogoutCancel = () => {
    setLogoutDialogOpen(false);
  };

  return (
    <nav className="landing-nav">
      <div className="landing-nav-inner">

        {/* Logo — same as AuthNavbar / LandingPage */}
        <div
          className="landing-logo"
          style={{ cursor: "pointer" }}
          onClick={() => navigate(isAuthenticated ? (isAdmin ? "/admin/flights" : "/flights") : "/")}
        >
          <div className="nav-logo-icon">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          {t("brand.name", { defaultValue: "AeroGlass" })}
        </div>

        {/* Centre nav links */}
        <div className="landing-nav-links">
          {navLinks.map((link) => (
            <a
              key={link.href}
              className={`landing-nav-link${location.pathname === link.href ? " landing-nav-link-active" : ""}`}
              href={link.href}
              onClick={(e) => {
                if (!link.href.includes("#")) {
                  e.preventDefault();
                  navigate(link.href);
                }
              }}
            >
              {t(`navbar.${link.labelKey}`)}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div className="landing-nav-actions">
          {/* Language Switcher */}
          <button 
            onClick={toggleLanguage}
            style={{
              background: "rgba(255, 255, 255, 0.4)",
              border: "1px solid rgba(0,0,0,0.05)",
              borderRadius: "2rem",
              padding: "0.25rem 0.6rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              marginRight: "0.5rem",
              color: "#1a1c1d",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              backdropFilter: "blur(10px)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span style={{ opacity: i18n.language?.startsWith('ja') ? 0.4 : 1 }}>EN</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span style={{ opacity: i18n.language?.startsWith('ja') ? 1 : 0.4 }}>JA</span>
          </button>

          {!isAuthenticated ? (
            <>
              <button className="landing-nav-signin" onClick={() => navigate("/login")}>{t("navbar.signIn")}</button>
              <button className="landing-nav-join" onClick={() => navigate("/register")}>{t("navbar.register")}</button>
            </>
          ) : (
            <div className="relative" ref={dropdownRef} style={{ position: "relative" }}>
              {/* Avatar button — same gold colour as Join Club */}
              <button
                id="profile-avatar-btn"
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-label="Profile menu"
                style={{
                  width: "2.25rem",
                  height: "2.25rem",
                  borderRadius: "50%",
                  background: "#ffd700",
                  color: "#1a1c1d",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid rgba(255,255,255,0.7)",
                  boxShadow: "0 4px 12px rgba(255,215,0,0.35)",
                  cursor: "pointer",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.08)";
                  e.currentTarget.style.boxShadow = "0 6px 18px rgba(255,215,0,0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,215,0,0.35)";
                }}
              >
                {initials}
              </button>

              {/* Dropdown — glassmorphism card matching screenshot */}
              {dropdownOpen && (
                <div style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 0.75rem)",
                  width: "13.5rem",
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.6)",
                  borderRadius: "1rem",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                  overflow: "hidden",
                  zIndex: 100,
                  animation: "fadeSlideDown 0.15s ease",
                }}>
                  {/* MY ACCOUNT header */}
                  <div style={{ padding: "0.625rem 1rem 0.5rem", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                    <p style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      margin: 0,
                    }}>{t("navbar.myAccount")}</p>
                  </div>

                  <div style={{ padding: "0.375rem 0" }}>
                    {/* View Profile */}
                    <button
                      id="nav-view-profile"
                      onClick={() => { setDropdownOpen(false); navigate("/profile"); }}
                      style={{
                        width: "100%", textAlign: "left", padding: "0.625rem 1rem",
                        fontSize: "0.9rem", fontWeight: 500, color: "#1a1c1d",
                        background: "none", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "0.75rem",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f5f5f5"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                    >
                      {/* Blue person icon */}
                      <span style={{
                        width: "1.75rem", height: "1.75rem", borderRadius: "50%",
                        background: "#eff6ff", display: "flex", alignItems: "center",
                        justifyContent: "center", flexShrink: 0,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#3b82f6">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                        </svg>
                      </span>
                      {t("navbar.viewProfile")}
                    </button>

                    {/* Sign Out */}
                    <button
                      id="nav-logout"
                      onClick={handleLogoutRequest}
                      style={{
                        width: "100%", textAlign: "left", padding: "0.625rem 1rem",
                        fontSize: "0.9rem", fontWeight: 500, color: "#b91c1c",
                        background: "none", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "0.75rem",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#fef2f2"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                    >
                      {/* Brown/red door icon */}
                      <span style={{
                        width: "1.75rem", height: "1.75rem", borderRadius: "50%",
                        background: "#fff7ed", display: "flex", alignItems: "center",
                        justifyContent: "center", flexShrink: 0,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#b45309">
                          <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 00-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z" />
                        </svg>
                      </span>
                      {t("navbar.signOut")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Logout confirmation dialog (portal, rendered outside nav) */}
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />
    </nav>
  );
}