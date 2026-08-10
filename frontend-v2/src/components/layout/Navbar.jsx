import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "@/store/authSlice";
import { fetchNotifications } from "@/store/notificationsSlice";
import toast from "react-hot-toast";
import LogoutConfirmModal from "@/components/common/LogoutConfirmModal";

// ── Admin navigation data ────────────────────────────────────────────────────
const ADMIN_NAVIGATION = {
  directLinks: [
    { label: "Overview", href: "/admin/overview" },
    { label: "Analytics", href: "/admin/analytics" },
  ],
  groups: [
    {
      label: "Master Data",
      links: [
        { label: "Airports", href: "/admin/master/airports" },
        { label: "Airlines", href: "/admin/master/airlines" },
        { label: "Aircraft Models", href: "/admin/master/aircraft-models" },
        { label: "Aircraft", href: "/admin/master/aircraft" },
        { label: "Food Items", href: "/admin/master/food-items" },
      ],
    },
    {
      label: "Operations",
      links: [
        { label: "Flight Routes", href: "/admin/operations/flight-routes" },
        { label: "Instances", href: "/admin/operations/flight-instances" },
        { label: "Seat Map", href: "/admin/operations/seat-map" },
        { label: "Fares", href: "/admin/operations/fares" },
        { label: "Meals", href: "/admin/operations/meals" },
      ],
    },
    {
      label: "Records",
      links: [
        { label: "Bookings", href: "/admin/records/bookings" },
      ],
    },
    {
      label: "System",
      links: [
        { label: "Bulk Import", href: "/admin/system/data-management" },
      ],
    },
  ],
};

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const profileMenuRef = useRef(null);
  const groupRefs = useRef({});

  const auth = useSelector((state) => state?.auth) || {};
  const { isAuthenticated, profile, decodedToken, isAdmin } = auth;
  const unreadCount = useSelector((state) => state?.notifications?.unreadCount || 0);

  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      dispatch(fetchNotifications());
    }
  }, [isAuthenticated, isAdmin, dispatch]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
      // Close open admin group if click is outside all group refs
      let insideGroup = false;
      Object.values(groupRefs.current).forEach((ref) => {
        if (ref && ref.contains(event.target)) insideGroup = true;
      });
      if (!insideGroup) setOpenGroup(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleLanguage = () => {
    const newLang = i18n.language?.startsWith("ja") ? "en" : "ja";
    i18n.changeLanguage(newLang);
  };

  const closeProfileMenu = () => {
    setIsProfileMenuOpen(false);
  };

  const handleLogout = () => {
    const targetPath = isAdmin ? "/admin/login" : "/login";
    setShowLogoutModal(false);
    closeProfileMenu();
    navigate(targetPath);
    dispatch(logout());
    if (isAdmin) {
      toast.success("Signed out successfully.", { position: "top-right" });
    } else {
      toast.success("You've been signed out.");
    }
  };

  const openLogoutModal = () => {
    closeProfileMenu();
    setShowLogoutModal(true);
  };

  const getInitials = () => {
    if (isAdmin) return "A";
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.username) return profile.username.substring(0, 2).toUpperCase();
    if (decodedToken?.username) return decodedToken.username.substring(0, 2).toUpperCase();
    return "AM";
  };

  // Active state helpers
  const isFlightsActive = location.pathname === "/" || location.pathname.startsWith("/flights");
  const isBookingsActive = location.pathname.startsWith("/my-bookings");

  const isAdminLinkActive = (href) => location.pathname === href;
  const isAdminGroupActive = (group) => group.links.some((l) => location.pathname.startsWith(l.href));

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/20 backdrop-blur-md border-b border-white/10 shadow-sm transition-all duration-300 w-[90%] max-w-7xl rounded-b-3xl mx-auto">
      <div className="max-w-7xl w-full mx-auto px-8 h-[68px] flex items-center justify-between">

        {/* Left: Logo */}
        <div
          className="flex items-center cursor-pointer transform hover:scale-105 transition-transform duration-200"
          onClick={() => navigate(isAdmin ? "/admin/overview" : "/")}
        >
          <img
            src="/updated%20logo.png"
            alt="Passenger Logo"
            className="h-[34px] object-contain"
          />
        </div>

        {/* Center: Navigation Links */}
        {isAuthenticated ? (
          isAdmin ? (
            // ── Admin mega-nav ──────────────────────────────────────────────
            <div className="flex items-center gap-2 text-[14px] flex-1 px-8">

              {/* Direct links: Overview, Analytics */}
              {ADMIN_NAVIGATION.directLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setOpenGroup(null)}
                  className={`transition-all duration-200 px-4 py-2 rounded-full cursor-pointer ${
                    isAdminLinkActive(link.href)
                      ? "font-extrabold text-slate-900"
                      : "font-semibold text-slate-700 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Dropdown groups */}
              {ADMIN_NAVIGATION.groups.map((group) => {
                const isActive = isAdminGroupActive(group);
                const isOpen = openGroup === group.label;
                return (
                  <div
                    key={group.label}
                    className="relative"
                    ref={(el) => (groupRefs.current[group.label] = el)}
                  >
                    <button
                      onClick={() => setOpenGroup(isOpen ? null : group.label)}
                      className={`flex items-center gap-1.5 transition-all duration-200 px-4 py-2 rounded-full cursor-pointer ${
                        isActive
                          ? "font-extrabold text-slate-900"
                          : "font-semibold text-slate-700 hover:text-slate-900"
                      }`}
                    >
                      {group.label}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 10 10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        className={`transition-transform duration-200 opacity-60 ${isOpen ? "rotate-180" : ""}`}
                      >
                        <path d="M1 3l4 4 4-4" />
                      </svg>
                    </button>

                    {/* Dropdown panel */}
                    {isOpen && (
                      <div className="absolute top-[calc(100%+10px)] left-0 min-w-[200px] bg-white backdrop-blur-xl border border-slate-200/60 shadow-2xl rounded-2xl py-2 z-[9999] animate-fade-in">
                        {group.links.map((link) => {
                          const active = location.pathname === link.href;
                          return (
                            <button
                              key={link.href}
                              onClick={() => { navigate(link.href); setOpenGroup(null); }}
                              className={`w-full text-left px-5 py-2.5 text-[13px] transition-colors duration-150 cursor-pointer ${
                                active
                                  ? "font-bold text-amber-700 bg-amber-50/80"
                                  : "font-medium text-slate-700 hover:bg-slate-100/80"
                              }`}
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
            </div>
          ) : (
            // ── Passenger nav ───────────────────────────────────────────────
            <div className="flex items-center gap-10 text-[15px] px-12 flex-1">
              <Link
                to="/"
                className={`transition-all duration-200 px-4.5 py-2 rounded-full cursor-pointer ${
                  isFlightsActive
                    ? "font-extrabold text-slate-900"
                    : "font-semibold text-slate-700 hover:text-slate-900"
                }`}
              >
                Flights
              </Link>
              <Link
                to="/my-bookings"
                className={`transition-all duration-200 px-4.5 py-2 rounded-full cursor-pointer ${
                  isBookingsActive
                    ? "font-extrabold text-slate-900"
                    : "font-semibold text-slate-700 hover:text-slate-900"
                }`}
              >
                Bookings
              </Link>
            </div>
          )
        ) : (
          // ── Guest nav ─────────────────────────────────────────────────────
          <div className="hidden sm:flex items-center gap-10 text-[15px] flex-1 px-12">
            <Link
              to="/"
              className={`transition-all duration-200 px-4.5 py-2 rounded-full cursor-pointer ${
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
        <div className="flex items-center gap-5">

          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3.5 rounded-xl cursor-pointer"
          >
            <span className={i18n.language?.startsWith("ja") ? "opacity-40" : "opacity-100 font-bold"}>EN</span>
            <span className="opacity-20">|</span>
            <span className={i18n.language?.startsWith("ja") ? "opacity-100 font-bold" : "opacity-40"}>JA</span>
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-4 relative" ref={profileMenuRef}>

              {/* Notification Bell — only for passengers */}
              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => navigate("/notifications")}
                  className={`relative text-slate-900 hover:text-black transition-colors w-10 h-10 rounded-full hover:bg-black/5 cursor-pointer flex items-center justify-center ${
                    location.pathname === "/notifications" ? "bg-black/10 font-bold" : ""
                  }`}
                  title="Notifications"
                >
                  <span className="material-symbols-outlined text-2xl select-none">
                    notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" />
                  )}
                </button>
              )}

              {/* User Avatar Circle Badge */}
              <button
                type="button"
                onClick={() => { setIsProfileMenuOpen(!isProfileMenuOpen); }}
                className="w-10 h-10 rounded-full bg-[#ffd600] text-black font-bold text-sm flex items-center justify-center shadow-[0_0_16px_rgba(255,214,0,0.85)] active:scale-95 transition-all cursor-pointer select-none"
              >
                {getInitials()}
              </button>

              {/* Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-[72px] w-52 bg-white backdrop-blur-xl border border-slate-200/60 shadow-2xl rounded-2xl p-2.5 animate-fade-in z-[9999]">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {profile?.username || decodedToken?.username || (isAdmin ? "Admin" : "Passenger")}
                    </p>
                    {profile?.email && (
                      <p className="text-xs text-slate-500 truncate">{profile.email}</p>
                    )}
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                        <span className="w-1 h-1 rounded-full bg-amber-500" />
                        Admin
                      </span>
                    )}
                  </div>

                  {!isAdmin && (
                    <div className="py-1.5 border-b border-slate-100">
                      <Link
                        to="/profile"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100/80 rounded-xl transition-colors cursor-pointer text-left"
                      >
                        <span className="material-symbols-outlined text-sm">person</span>
                        My Profile
                      </Link>
                    </div>
                  )}

                    <button
                      onClick={openLogoutModal}
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
              className="btn-primary text-sm px-6 py-2.5 rounded-xl"
            >
              {t("navbar.loginOrRegister", "Login or Register")}
            </button>
          )}

        </div>

      </div>
    </nav>

    {/* ── Logout Confirmation Modal ────────────────────────────────────────── */}
    {showLogoutModal && (
      <LogoutConfirmModal
        isAdmin={isAdmin}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    )}
  </>
  );
}
