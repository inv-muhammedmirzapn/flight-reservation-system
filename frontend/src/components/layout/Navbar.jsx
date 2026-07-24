import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { logout } from '@/store/authSlice';
import { fetchNotifications } from '@/store/notificationsSlice';
import { LogoutConfirmDialog } from '@/components/ui/LogoutConfirmDialog';
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

// Admin nav: grouped by domain, each group renders as a dropdown
const ADMIN_GROUPS = [
  {
    label: 'Master Data',
    links: [
      { label: 'Countries',      href: '/admin/master/countries' },
      { label: 'Airports',       href: '/admin/master/airports' },
      { label: 'Airlines',       href: '/admin/master/airlines' },
      { label: 'Aircraft Models',href: '/admin/master/aircraft-models' },
      { label: 'Aircraft',       href: '/admin/master/aircraft' },
      { label: 'Food Items',     href: '/admin/master/food-items' },
    ],
  },
  {
    label: 'Operations',
    links: [
      { label: 'Flight Routes',  href: '/admin/operations/flight-routes' },
      { label: 'Instances',      href: '/admin/operations/flight-instances' },
      { label: 'Seat Map',       href: '/admin/operations/seat-map' },
      { label: 'Fares',          href: '/admin/operations/fares' },
      { label: 'Meals',          href: '/admin/operations/meals' },
    ],
  },
  {
    label: 'Records',
    links: [
      { label: 'Bookings',       href: '/admin/records/bookings' },
      { label: 'Payments',       href: '/admin/records/payments' },
      { label: 'Passengers',     href: '/admin/records/passengers' },
    ],
  },
];

// Nav links shown when authenticated (adapted for the app dashboard)
const APP_NAV_LINKS = [
  { labelKey: "flights", href: "/flights" },
  { labelKey: "bookings", href: "/my-bookings" },
  { labelKey: "rewards", href: "/rewards" },
  { labelKey: "support", href: "/#support" },
];

export function Navbar() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, profile } = useSelector((state) => state.auth);
  const { unreadCount } = useSelector((state) => state.notifications);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null); // for admin mega-nav
  const dropdownRef = useRef(null);
  const groupRefs = useRef({});

  const [localFirstName, setLocalFirstName] = useState(localStorage.getItem("firstName") || "");

  useEffect(() => {
    const handleAuthChange = () => setLocalFirstName(localStorage.getItem("firstName") || "");
    window.addEventListener("authChange", handleAuthChange);
    return () => window.removeEventListener("authChange", handleAuthChange);
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      dispatch(fetchNotifications());
      const interval = setInterval(() => {
        dispatch(fetchNotifications());
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [dispatch, isAuthenticated, isAdmin]);

  // Build initials from Redux profile or local storage
  const firstName = profile?.first_name || localFirstName || "";
  const username = profile?.username || "";

  const initials = isAdmin
    ? "A"
    : firstName
      ? firstName.charAt(0).toUpperCase()
      : (username.charAt(0).toUpperCase() || "U");

  const navLinks = isAdmin ? [] : APP_NAV_LINKS; // admin uses grouped mega-nav

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      // Close open group if click outside all group refs
      let inside = false;
      Object.values(groupRefs.current).forEach(ref => { if (ref && ref.contains(e.target)) inside = true; });
      if (!inside) setOpenGroup(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
          style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
          onClick={() => navigate(isAuthenticated ? (isAdmin ? "/admin/overview" : "/flights") : "/")}
        >
          <img src="/updated%20logo.png" alt="Passenger Logo" style={{ height: "36px", objectFit: "contain" }} />
        </div>

        {/* Centre nav links */}
        <div className="landing-nav-links">
          {isAdmin ? (
            // ── Admin grouped mega-nav ────────────────────────────────────
            <>
              {/* Overview direct link */}
              <a
                className={`landing-nav-link${location.pathname === '/admin/overview' ? ' landing-nav-link-active' : ''}`}
                href="/admin/overview"
                onClick={(e) => { e.preventDefault(); navigate('/admin/overview'); setOpenGroup(null); }}
              >
                Overview
              </a>

              {/* Analytics direct link */}
              <a
                className={`landing-nav-link${location.pathname === '/admin/analytics' ? ' landing-nav-link-active' : ''}`}
                href="/admin/analytics"
                onClick={(e) => { e.preventDefault(); navigate('/admin/analytics'); setOpenGroup(null); }}
              >
                Analytics
              </a>

              {/* Grouped dropdown buttons */}
              {ADMIN_GROUPS.map((group) => {
                const isActive = group.links.some(l => location.pathname.startsWith(l.href));
                const isOpen = openGroup === group.label;
                return (
                  <div
                    key={group.label}
                    style={{ position: 'relative' }}
                    ref={el => groupRefs.current[group.label] = el}
                  >
                    <button
                      className={`landing-nav-link${isActive ? ' landing-nav-link-active' : ''}`}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontFamily: 'inherit', padding: '0.25rem 0.5rem',
                      }}
                      onClick={() => setOpenGroup(isOpen ? null : group.label)}
                    >
                      {group.label}
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', opacity: 0.6 }}>
                        <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>

                    {isOpen && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 10px)', left: 0,
                        background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14,
                        boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                        padding: '6px 0', minWidth: 180, zIndex: 200,
                        animation: 'fadeSlideDown 0.15s ease',
                      }}>
                        {group.links.map(link => {
                          const active = location.pathname === link.href;
                          return (
                            <button
                              key={link.href}
                              onClick={() => { navigate(link.href); setOpenGroup(null); }}
                              style={{
                                display: 'block', width: '100%', textAlign: 'left',
                                padding: '8px 18px', background: active ? 'rgba(112,93,0,0.08)' : 'none',
                                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500,
                                color: active ? '#705d00' : '#1a1c1d', transition: 'background 0.12s',
                                fontFamily: 'inherit',
                              }}
                              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none'; }}
                            >
                              {link.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            // ── Customer nav flat links ───────────────────────────────────
            navLinks.map((link) => (
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
                {link.label ?? t(`navbar.${link.labelKey}`)}
              </a>
            ))
          )}
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {/* Notifications Bell */}
              {!isAdmin && (
                <button
                  id="nav-notifications-bell"
                  onClick={() => navigate("/notifications")}
                  style={{
                    background: "rgba(255, 255, 255, 0.4)",
                    border: "1px solid rgba(0,0,0,0.05)",
                    borderRadius: "50%",
                    width: "2.25rem",
                    height: "2.25rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    position: "relative",
                    color: "#1a1c1d",
                    transition: "transform 0.15s",
                    backdropFilter: "blur(10px)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span style={{
                      position: "absolute",
                      top: "-2px",
                      right: "-2px",
                      background: "#ef4444",
                      color: "#ffffff",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      borderRadius: "50%",
                      width: "14px",
                      height: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              )}

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

                    <div style={{ padding: "0.5rem 0" }}>
                      {/* View Profile */}
                      <button
                        id="nav-view-profile"
                        onClick={() => { setDropdownOpen(false); navigate("/profile"); }}
                        style={{
                          width: "100%", textAlign: "left", padding: "0.625rem 1.25rem",
                          fontSize: "0.875rem", fontWeight: 600, color: "#1a1c1d",
                          background: "none", border: "none", cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f8f9fa";
                          e.currentTarget.style.color = "#705d00";
                          e.currentTarget.style.paddingLeft = "1.5rem";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "none";
                          e.currentTarget.style.color = "#1a1c1d";
                          e.currentTarget.style.paddingLeft = "1.25rem";
                        }}
                      >
                        {t("navbar.viewProfile")}
                      </button>


                      {/* Sign Out */}
                      <button
                        id="nav-logout"
                        onClick={handleLogoutRequest}
                        style={{
                          width: "100%", textAlign: "left", padding: "0.625rem 1.25rem",
                          fontSize: "0.875rem", fontWeight: 600, color: "#b91c1c",
                          background: "none", border: "none", cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#fef2f2";
                          e.currentTarget.style.paddingLeft = "1.5rem";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "none";
                          e.currentTarget.style.paddingLeft = "1.25rem";
                        }}
                      >
                        {t("navbar.signOut")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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