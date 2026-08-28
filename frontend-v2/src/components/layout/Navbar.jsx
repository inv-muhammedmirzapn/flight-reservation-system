import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser } from "@/store/authSlice";
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
        { label: "Route Fare Templates", href: "/admin/operations/route-fare-classes" },
        { label: "Dynamic Pricing", href: "/admin/operations/dynamic-pricing" },
        { label: "Price Audit Logs", href: "/admin/operations/fare-price-logs" },
        { label: "Instances", href: "/admin/operations/flight-instances" },
        { label: "Seat Map", href: "/admin/operations/seat-map" },
        { label: "Fares (Instance)", href: "/admin/operations/fares" },
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const [openMobileAdminGroup, setOpenMobileAdminGroup] = useState(null);
  const profileMenuRef = useRef(null);
  const groupRefs = useRef({});

  const auth = useSelector((state) => state?.auth) || {};
  const { isAuthenticated, profile, isAdmin } = auth;
  const unreadCount = useSelector((state) => state?.notifications?.unreadCount || 0);

  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      dispatch(fetchNotifications());
    }
  }, [isAuthenticated, isAdmin, dispatch]);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
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
    setIsMobileMenuOpen(false);
    navigate(targetPath);
    dispatch(logoutUser());
    if (isAdmin) {
      toast.success("Signed out successfully.", { position: "top-right" });
    } else {
      toast.success("You've been signed out.");
    }
  };

  const openLogoutModal = () => {
    closeProfileMenu();
    setIsMobileMenuOpen(false);
    setShowLogoutModal(true);
  };

  const getInitials = () => {
    if (isAdmin) return "A";
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.username) return profile.username.substring(0, 2).toUpperCase();
    return "AM";
  };

  const isFlightsActive = location.pathname === "/" || location.pathname.startsWith("/flights");
  const isBookingsActive = location.pathname.startsWith("/my-bookings");

  const isAdminLinkActive = (href) => location.pathname === href;
  const isAdminGroupActive = (group) => group.links.some((l) => location.pathname.startsWith(l.href));

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/20 backdrop-blur-md border-b border-white/10 shadow-sm transition-all duration-300 w-[90%] md:max-w-7xl rounded-b-2xl md:rounded-b-3xl mx-auto admin-navbar">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 h-[60px] md:h-[68px] flex items-center justify-between relative">

          {/* Left: Hamburger Button — visible on mobile AND tablet portrait (< 1024px for admin) */}
          <div className={`flex items-center z-10 ${isAdmin ? 'lg:hidden' : 'md:hidden'}`}>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="w-9 h-9 flex items-center justify-center text-slate-800 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
              aria-label="Open Navigation Drawer"
            >
              <span className="material-symbols-outlined text-2xl select-none">menu</span>
            </button>
          </div>

          {/* Center Logo on Mobile/Portrait-Tablet, Left Logo on Desktop */}
          <div
            className={`flex items-center cursor-pointer transform hover:scale-105 transition-transform duration-200 absolute left-1/2 -translate-x-1/2 ${isAdmin
                ? 'lg:relative lg:left-0 lg:translate-x-0'
                : 'md:relative md:left-0 md:translate-x-0'
              }`}
            onClick={() => navigate(isAdmin ? "/admin/overview" : "/")}
          >
            <img
              src="/updated%20logo.png"
              alt="Passenger Logo"
              className={`object-contain ${isAdmin
                  ? 'h-[30px] lg:h-[38px]'
                  : 'h-[28px] md:h-[34px]'
                }`}
            />
          </div>

          {/* Center: Desktop Navigation Links — lg: for admin (1024px+), md: for passengers (768px+) */}
          <div className={`items-center justify-center flex-1 ${isAdmin ? 'hidden lg:flex' : 'hidden md:flex'}`}>
            {isAuthenticated ? (
              isAdmin ? (
                // Admin navigation (desktop)
                <div className="flex items-center gap-2 text-[14px] px-4">
                  {ADMIN_NAVIGATION.directLinks.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setOpenGroup(null)}
                      className={`transition-all duration-200 px-4 py-2 rounded-full cursor-pointer ${isAdminLinkActive(link.href)
                          ? "font-extrabold text-slate-900"
                          : "font-semibold text-slate-700 hover:text-slate-900"
                        }`}
                    >
                      {link.label}
                    </Link>
                  ))}

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
                          className={`flex items-center gap-1.5 transition-all duration-200 px-4 py-2 rounded-full cursor-pointer ${isActive
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

                        {isOpen && (
                          <div className="absolute top-[calc(100%+10px)] left-0 min-w-[200px] bg-white backdrop-blur-xl border border-slate-200/60 shadow-2xl rounded-2xl py-2 z-[9999] animate-fade-in">
                            {group.links.map((link) => {
                              const active = location.pathname === link.href;
                              return (
                                <Link
                                  key={link.href}
                                  to={link.href}
                                  onClick={() => setOpenGroup(null)}
                                  className={`block w-full text-left px-5 py-2.5 text-[13px] transition-colors duration-150 cursor-pointer ${active
                                      ? "font-bold text-amber-700 bg-amber-50/80"
                                      : "font-medium text-slate-700 hover:bg-slate-100/80"
                                    }`}
                                >
                                  {link.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Passenger navigation (desktop)
                <div className="flex items-center gap-10 text-xs px-12">
                  <Link
                    to="/"
                    className={`transition-all duration-200 px-4.5 py-2 rounded-full cursor-pointer ${isFlightsActive
                        ? "font-extrabold text-slate-900"
                        : "font-semibold text-slate-700 hover:text-slate-900"
                      }`}
                  >
                    Flights
                  </Link>
                  <Link
                    to="/my-bookings"
                    className={`transition-all duration-200 px-4.5 py-2 rounded-full cursor-pointer ${isBookingsActive
                        ? "font-extrabold text-slate-900"
                        : "font-semibold text-slate-700 hover:text-slate-900"
                      }`}
                  >
                    Bookings
                  </Link>
                </div>
              )
            ) : (
              // Guest navigation (desktop)
              <div className="flex items-center gap-10 text-xs px-12">
                <Link
                  to="/"
                  className={`transition-all duration-200 px-4.5 py-2 rounded-full cursor-pointer ${isFlightsActive
                      ? "font-extrabold text-slate-900"
                      : "font-semibold text-slate-700 hover:text-slate-900"
                    }`}
                >
                  Flights
                </Link>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className={`flex items-center z-10 ${isAdmin ? 'gap-2 lg:gap-5' : 'gap-2 md:gap-5'}`}>

            {/* Language Switcher (Desktop) */}
            <button
              onClick={toggleLanguage}
              className="hidden md:flex btn-secondary h-8 md:h-10 items-center gap-1 md:gap-1.5 text-[9px] md:text-xs py-1 md:py-2 px-1.5 md:px-3.5 rounded-xl cursor-pointer"
            >
              <span className={i18n.language?.startsWith("ja") ? "opacity-40" : "opacity-100 font-bold"}>EN</span>
              <span className="opacity-20">|</span>
              <span className={i18n.language?.startsWith("ja") ? "opacity-100 font-bold" : "opacity-40"}>JA</span>
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-2 md:gap-4 relative" ref={profileMenuRef}>

                {/* Notification Bell — only for passengers */}
                {!isAdmin && (
                  <button
                    type="button"
                    onClick={() => navigate("/notifications")}
                    className={`relative text-slate-900 hover:text-black transition-colors w-8 h-8 md:w-10 md:h-10 rounded-full hover:bg-black/5 cursor-pointer flex items-center justify-center ${location.pathname === "/notifications" ? "bg-black/10 font-bold" : ""
                      }`}
                    title="Notifications"
                  >
                    <span className="material-symbols-outlined text-xl md:text-2xl select-none">
                      notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 md:top-1.5 md:right-1.5 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" />
                    )}
                  </button>
                )}

                {/* User Avatar Circle Badge */}
                <button
                  type="button"
                  onClick={() => { setIsProfileMenuOpen(!isProfileMenuOpen); }}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#ffd600] text-black font-bold text-xs md:text-sm flex items-center justify-center shadow-[0_0_16px_rgba(255,214,0,0.85)] active:scale-95 transition-all cursor-pointer select-none"
                >
                  {getInitials()}
                </button>

                {/* Profile Dropdown Menu */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 top-[52px] md:top-[72px] w-52 bg-white backdrop-blur-xl border border-slate-200/60 shadow-2xl rounded-2xl p-2.5 animate-fade-in z-[9999]">
                    <div className="px-3.5 py-2 border-b border-slate-100">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {profile?.username || (isAdmin ? "Admin" : "Passenger")}
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
                onClick={() => navigate("/login", { state: { from: location } })}
                className="btn-primary h-8 md:h-10 text-[10px] md:text-sm px-3 md:px-6 py-1.5 md:py-2.5 rounded-xl"
              >
                {t("navbar.loginOrRegister", "Login or Register")}
              </button>
            )}

          </div>

        </div>
      </nav>

      {/* ── Mobile Side Navigation Drawer ─────────────────────────────────── */}
      {isMobileMenuOpen && createPortal(
        <div className={`fixed inset-0 z-[200] ${isAdmin ? 'lg:hidden' : 'md:hidden'}`}>
          {/* Semi-transparent backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Sliding Side Panel */}
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white/95 backdrop-blur-2xl shadow-2xl flex flex-col justify-between p-5 overflow-y-auto border-r border-slate-200/50 z-[210] animate-slide-in-left">

            <div>
              {/* Header inside side panel: Logo & Close Button */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div
                  className="flex items-center cursor-pointer"
                  onClick={() => { setIsMobileMenuOpen(false); navigate(isAdmin ? "/admin/overview" : "/"); }}
                >
                  <img
                    src="/updated%20logo.png"
                    alt="Passenger Logo"
                    className="h-[28px] object-contain"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl select-none">close</span>
                </button>
              </div>

              {/* Profile Greeting / Status Card */}
              {isAuthenticated ? (
                <div className="mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#ffd600] text-black font-bold text-sm flex items-center justify-center shrink-0">
                    {getInitials()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {profile?.first_name ? `${profile.first_name} ${profile.last_name || ""}` : (profile?.username || "User")}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">{profile?.email || (isAdmin ? "Admin Account" : "Passenger Account")}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-3 rounded-2xl bg-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Welcome Guest</p>
                    <p className="text-[10px] text-slate-500">Sign in to manage bookings</p>
                  </div>
                </div>
              )}

              {/* Navigation Items List */}
              <div className="mt-6 flex flex-col gap-1">
                {isAuthenticated && !isAdmin && (
                  <>
                    <Link
                      to="/"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs transition-colors ${isFlightsActive ? "font-bold text-slate-900 bg-amber-500/15" : "font-semibold text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                      <span className="material-symbols-outlined text-lg">flight_takeoff</span>
                      Flights
                    </Link>

                    <Link
                      to="/my-bookings"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs transition-colors ${isBookingsActive ? "font-bold text-slate-900 bg-amber-500/15" : "font-semibold text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                      <span className="material-symbols-outlined text-lg">confirmation_number</span>
                      Bookings
                    </Link>

                    <Link
                      to="/notifications"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs transition-colors justify-between ${location.pathname === "/notifications" ? "font-bold text-slate-900 bg-amber-500/15" : "font-semibold text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-lg">notifications</span>
                        Notifications
                      </div>
                      {unreadCount > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </Link>

                    <Link
                      to="/profile"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs transition-colors ${location.pathname === "/profile" ? "font-bold text-slate-900 bg-amber-500/15" : "font-semibold text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                      <span className="material-symbols-outlined text-lg">person</span>
                      My Profile
                    </Link>
                  </>
                )}

                {isAuthenticated && isAdmin && (
                  <div className="flex flex-col gap-1">
                    {ADMIN_NAVIGATION.directLinks.map((link) => (
                      <Link
                        key={link.href}
                        to={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs transition-colors ${isAdminLinkActive(link.href) ? "font-bold text-slate-900 bg-amber-500/15" : "font-semibold text-slate-700 hover:bg-slate-100"
                          }`}
                      >
                        <span className="material-symbols-outlined text-lg">dashboard</span>
                        {link.label}
                      </Link>
                    ))}

                    {ADMIN_NAVIGATION.groups.map((group) => {
                      const isOpen = openMobileAdminGroup === group.label;
                      const isActive = isAdminGroupActive(group);
                      return (
                        <div key={group.label} className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => setOpenMobileAdminGroup(isOpen ? null : group.label)}
                            className={`flex items-center justify-between px-4 py-2.5 rounded-2xl text-xs font-semibold transition-colors ${isActive ? "text-slate-900 font-bold bg-slate-100" : "text-slate-700 hover:bg-slate-100"
                              }`}
                          >
                            <span>{group.label}</span>
                            <span className={`material-symbols-outlined text-sm transition-transform ${isOpen ? "rotate-180" : ""}`}>
                              expand_more
                            </span>
                          </button>

                          {isOpen && (
                            <div className="pl-6 flex flex-col gap-1 py-1">
                              {group.links.map((link) => (
                                <Link
                                  key={link.href}
                                  to={link.href}
                                  onClick={() => setIsMobileMenuOpen(false)}
                                  className={`px-4 py-2 rounded-xl text-[11px] transition-colors ${location.pathname === link.href ? "font-bold text-amber-700 bg-amber-50" : "font-medium text-slate-600 hover:bg-slate-100"
                                    }`}
                                >
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isAuthenticated && (
                  <>
                    <Link
                      to="/"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs transition-colors ${isFlightsActive ? "font-bold text-slate-900 bg-amber-500/15" : "font-semibold text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                      <span className="material-symbols-outlined text-lg">flight_takeoff</span>
                      Flights
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Bottom Controls in Drawer */}
            <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">

              {/* Language switcher */}
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-bold text-slate-500">Language</span>
                <button
                  onClick={toggleLanguage}
                  className="btn-secondary h-8 flex items-center gap-1 text-[10px] py-1 px-3 rounded-xl cursor-pointer"
                >
                  <span className={i18n.language?.startsWith("ja") ? "opacity-40" : "opacity-100 font-bold"}>EN</span>
                  <span className="opacity-20">|</span>
                  <span className={i18n.language?.startsWith("ja") ? "opacity-100 font-bold" : "opacity-40"}>JA</span>
                </button>
              </div>

              {/* Sign Out or Login Button */}
              {isAuthenticated ? (
                <button
                  onClick={openLogoutModal}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">logout</span>
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={() => { setIsMobileMenuOpen(false); navigate("/login", { state: { from: location } }); }}
                  className="btn-primary w-full py-2.5 rounded-xl text-xs font-bold"
                >
                  {t("navbar.loginOrRegister", "Login or Register")}
                </button>
              )}

            </div>

          </aside>
        </div>,
        document.body
      )}

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
