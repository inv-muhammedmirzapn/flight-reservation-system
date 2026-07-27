import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { logout } from '@/store/authSlice';
import { fetchNotifications } from '@/store/notificationsSlice';
import { LogoutConfirmDialog } from '@/components/ui/LogoutConfirmDialog';
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

// Nav links shown when authenticated (adapted for the app dashboard)
const APP_NAV_LINKS = [
  { labelKey: "flights", href: "/flights" },
  { labelKey: "bookings", href: "/my-bookings" },
];

const ADMIN_NAV_LINKS = [
  { labelKey: "flights", href: "/admin/flights" },
  { labelKey: "analytics", href: "/admin/analytics" },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Build initials from Redux profile or local storage
  const firstName = profile?.first_name || localFirstName || "";
  const username = profile?.username || "";

  const initials = isAdmin
    ? "A"
    : firstName
      ? firstName.charAt(0).toUpperCase()
      : (username.charAt(0).toUpperCase() || "U");

  const navLinks = isAdmin ? ADMIN_NAV_LINKS : APP_NAV_LINKS;

  // Auto-close mobile drawer when screen is resized back to desktop width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 640) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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

  const toggleLanguage = () => {
    const newLang = i18n.language?.startsWith('en') ? 'ja' : 'en';
    i18n.changeLanguage(newLang);
  };

  const handleLogoutRequest = () => {
    setDropdownOpen(false);
    setMobileOpen(false);
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
    <>
      <nav className="landing-nav">
      <div className="landing-nav-inner">

        {/* Logo */}
        <div
          className="landing-logo"
          style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
          onClick={() => navigate(isAdmin ? "/admin/flights" : "/")}
        >
          <img src="/updated%20logo.png" alt="Passenger Logo" style={{ height: "36px", objectFit: "contain" }} />
        </div>

        {/* Centre nav links — hidden on mobile via CSS */}
        <div className="landing-nav-links">
          {navLinks.map((link) => (
            <a
              key={link.labelKey}
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
          ))}
        </div>

        {/* Right side — hidden on mobile (replaced by hamburger) */}
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
                      position: "absolute", top: "-2px", right: "-2px",
                      background: "#ef4444", color: "#ffffff",
                      fontSize: "0.65rem", fontWeight: 700, borderRadius: "50%",
                      width: "14px", height: "14px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              )}

              {/* Avatar + dropdown */}
              <div className="relative" ref={dropdownRef} style={{ position: "relative" }}>
                <button
                  id="profile-avatar-btn"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  aria-label="Profile menu"
                  style={{
                    width: "2.25rem", height: "2.25rem", borderRadius: "50%",
                    background: "#ffd700", color: "#1a1c1d", fontWeight: 700, fontSize: "0.875rem",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid rgba(255,255,255,0.7)",
                    boxShadow: "0 4px 12px rgba(255,215,0,0.35)",
                    cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s", flexShrink: 0,
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

                {dropdownOpen && (
                  <div style={{
                    position: "absolute", right: 0, top: "calc(100% + 0.75rem)",
                    width: "13.5rem",
                    background: "rgba(255,255,255,0.95)",
                    backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                    border: "1px solid rgba(255,255,255,0.6)",
                    borderRadius: "1rem", boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                    overflow: "hidden", zIndex: 100, animation: "fadeSlideDown 0.15s ease",
                  }}>
                    <div style={{ padding: "0.625rem 1rem 0.5rem", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                      <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{t("navbar.myAccount")}</p>
                    </div>
                    <div style={{ padding: "0.5rem 0" }}>
                      {[
                        { id: "nav-view-profile", label: t("navbar.viewProfile"), onClick: () => { setDropdownOpen(false); navigate("/profile"); }, color: "#1a1c1d" },
                        ...(!isAdmin ? [{ id: "nav-view-notifications", label: t("navbar.notifications", "Notifications"), onClick: () => { setDropdownOpen(false); navigate("/notifications"); }, color: "#1a1c1d", badge: unreadCount }] : []),
                      ].map(item => (
                        <button key={item.id} id={item.id} onClick={item.onClick}
                          style={{ width: "100%", textAlign: "left", padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, color: item.color, background: "none", border: "none", cursor: "pointer", transition: "all 0.15s ease", display: "flex", alignItems: "center" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#f8f9fa"; e.currentTarget.style.color = "#705d00"; e.currentTarget.style.paddingLeft = "1.5rem"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = item.color; e.currentTarget.style.paddingLeft = "1.25rem"; }}
                        >
                          <span>{item.label}</span>
                          {item.badge > 0 && <span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", fontSize: "0.7rem", fontWeight: 700, borderRadius: "9999px", padding: "2px 6px" }}>{item.badge}</span>}
                        </button>
                      ))}
                      <button id="nav-logout" onClick={handleLogoutRequest}
                        style={{ width: "100%", textAlign: "left", padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, color: "#b91c1c", background: "none", border: "none", cursor: "pointer", transition: "all 0.15s ease" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.paddingLeft = "1.5rem"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.paddingLeft = "1.25rem"; }}
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

        {/* ── Hamburger button (mobile only — shown via CSS) ── */}
        <button
          className={`nav-hamburger${mobileOpen ? ' open' : ''}`}
          onClick={() => setMobileOpen(prev => !prev)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>
    </nav>

      {/* ── Mobile Slide-in Drawer ── */}
      {mobileOpen && (
        <div className="nav-mobile-drawer open" onClick={() => setMobileOpen(false)}>
          <div className="nav-mobile-panel" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <img src="/updated%20logo.png" alt="Passenger" style={{ height: '28px', objectFit: 'contain' }} />
              <button onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5e5e5e', padding: '4px', display: 'flex' }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.07)', margin: '0.5rem 0 0.75rem' }} />

            {/* Main nav links */}
            {navLinks.map(link => (
              <button
                key={link.labelKey}
                className={`nav-mobile-link${location.pathname === link.href ? ' active' : ''}`}
                onClick={() => { navigate(link.href); setMobileOpen(false); }}
              >
                {link.label ?? t(`navbar.${link.labelKey}`)}
              </button>
            ))}

            {/* Authenticated section */}
            {isAuthenticated && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.07)', margin: '0.75rem 0' }} />
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 1rem 0.5rem' }}>
                  {t('navbar.myAccount')}
                </div>
                <button className="nav-mobile-link" onClick={() => { navigate('/profile'); setMobileOpen(false); }}>
                  {t('navbar.viewProfile')}
                </button>
                {!isAdmin && (
                  <button
                    className="nav-mobile-link"
                    onClick={() => { navigate('/notifications'); setMobileOpen(false); }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{t('navbar.notifications', 'Notifications')}</span>
                    {unreadCount > 0 && (
                      <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: 700, borderRadius: '9999px', padding: '2px 7px' }}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                )}
                <button
                  className="nav-mobile-link"
                  style={{ color: '#b91c1c' }}
                  onClick={handleLogoutRequest}
                >
                  {t('navbar.signOut')}
                </button>
              </>
            )}

            {/* Guest section */}
            {!isAuthenticated && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.07)', margin: '0.75rem 0' }} />
                <button className="nav-mobile-link" onClick={() => { navigate('/login'); setMobileOpen(false); }}>
                  {t('navbar.signIn')}
                </button>
                <button
                  onClick={() => { navigate('/register'); setMobileOpen(false); }}
                  style={{
                    marginTop: '0.5rem', padding: '0.875rem 1rem',
                    background: '#ffd700', color: '#1a1c1d', fontWeight: 700, fontSize: '1rem',
                    border: 'none', borderRadius: '12px', cursor: 'pointer', width: '100%',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {t('navbar.register')}
                </button>
              </>
            )}

            {/* Language toggle at bottom */}
            <div style={{ marginTop: 'auto', paddingTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={toggleLanguage}
                style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '2rem', padding: '0.375rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', color: '#5e5e5e' }}
              >
                {i18n.language?.startsWith('ja') ? '🇯🇵 Japanese' : '🇬🇧 English'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />
    </>
  );
}