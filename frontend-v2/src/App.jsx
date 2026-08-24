import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Provider, useSelector, useDispatch } from "react-redux";
import { store } from "@/store";
import { fetchProfile } from "@/store/authSlice";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/layout/Navbar";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ServerDownPage from "@/components/common/ServerDownPage";

// ── Passenger pages ──────────────────────────────────────────────────────────
import LandingPage from "@/pages/landing/LandingPage";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import FlightsPage from "@/pages/flights/FlightsPage";
import FlightDetailPage from "@/pages/flights/FlightDetailPage";
import BookingCheckoutPage from "@/pages/bookings/BookingCheckoutPage";
import BookingConfirmationPage from "@/pages/bookings/BookingConfirmationPage";
import MyBookingsPage from "@/pages/bookings/MyBookingsPage";
import TicketDetailPage from "@/pages/bookings/TicketDetailPage";
import TicketCancellationPage from "@/pages/bookings/TicketCancellationPage";
import UserProfilePage from "@/pages/profile/UserProfilePage";
import NotificationsPage from "@/pages/notifications/NotificationsPage";

import PasswordRecoveryPage from "@/pages/auth/PasswordRecoveryPage";

// ── Admin auth ───────────────────────────────────────────────────────────────
import AdminLoginPage from "@/pages/auth/AdminLoginPage";

// ── Admin pages (lazy-loaded) ────────────────────────────────────────────────
const AnalyticsDashboard      = lazy(() => import("@/admin/analytics/AnalyticsDashboard"));
// Master data
const AirportsPage            = lazy(() => import("@/admin/master/airports/AirportsPage"));
const AirlinesPage            = lazy(() => import("@/admin/master/airlines/AirlinesPage"));
const AircraftModelsPage      = lazy(() => import("@/admin/master/aircraft/AircraftModelsPage"));
const AircraftPage            = lazy(() => import("@/admin/master/aircraft/AircraftPage"));
const FoodItemsPage           = lazy(() => import("@/admin/master/food-items/FoodItemsPage"));
// Operations
const FlightRoutesPage        = lazy(() => import("@/admin/operations/flight-routes/FlightRoutesPage"));
const RouteFareClassesPage    = lazy(() => import("@/admin/operations/route-fare-classes/RouteFareClassesPage"));
const FarePriceLogsPage       = lazy(() => import("@/admin/operations/fare-price-logs/FarePriceLogsPage"));
const FlightInstancesPage     = lazy(() => import("@/admin/operations/flight-instances/FlightInstancesPage"));
const FlightOverviewPage      = lazy(() => import("@/admin/operations/flight-overview/FlightOverviewPage"));
const SeatMapPage             = lazy(() => import("@/admin/operations/seat-map/SeatMapPage"));
const FaresPage               = lazy(() => import("@/admin/operations/fares/FaresPage"));
const MealsPage               = lazy(() => import("@/admin/operations/meals/MealsPage"));
// Records
const AdminBookingsPage       = lazy(() => import("@/admin/records/bookings/AdminBookingsPage"));
// System
const DataManagementPage      = lazy(() => import("@/admin/system/data-management/DataManagementPage"));

// Spinner shown while lazy admin chunks load
const AdminLoadingFallback = () => (
  <div className="flex-grow flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#705d00]" />
  </div>
);

// Helper: wraps element with adminOnly guard + Suspense
const AdminRoute = ({ children }) => (
  <ProtectedRoute adminOnly>
    <Suspense fallback={<AdminLoadingFallback />}>{children}</Suspense>
  </ProtectedRoute>
);

function AppContent() {
  const dispatch = useDispatch();
  const isServerDown = useSelector((state) => state?.system?.isServerDown);
  const isAdmin = useSelector((state) => state?.auth?.isAdmin);
  const location = useLocation();

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  const isAdminPanel = isAdmin || location.pathname.startsWith("/admin");

  return (
    <>
      <Toaster
        position={isAdminPanel ? "top-right" : "top-center"}
        reverseOrder={false}
        containerStyle={{
          top: isAdminPanel ? 96 : 16,
          right: isAdminPanel ? 24 : 16,
          transition: "all 0.25s ease",
        }}
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            fontWeight: "600",
            borderRadius: "16px",
            padding: "12px 18px",
            color: "#0f172a",
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(226, 232, 240, 0.8)",
            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
          },
          success: {
            duration: 3500,
            style: {
              background: "#f0fdf4",
              color: "#064e3b",
              border: "1px solid #a7f3d0",
            },
            iconTheme: {
              primary: "#10b981",
              secondary: "#ffffff",
            },
          },
          error: {
            duration: 4000,
            style: {
              background: "#fff1f2",
              color: "#881337",
              border: "1px solid #fecdd3",
            },
            iconTheme: {
              primary: "#f43f5e",
              secondary: "#ffffff",
            },
          },
          loading: {
            style: {
              background: "#0f172a",
              color: "#f8fafc",
              border: "1px solid #334155",
            },
            iconTheme: {
              primary: "#fbbf24",
              secondary: "#0f172a",
            },
          },
        }}
      />
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
        {/* Global Header */}
        <Navbar />

        {/* Global Server Outage Overlay */}
        {isServerDown && <ServerDownPage />}

        {/* Main Routing Container */}
        <main className="flex-1 flex flex-col">
          <Routes>
            {/* ── Public Routes ──────────────────────────────────────────── */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/flights" element={<FlightsPage />} />
            <Route path="/flights/:id" element={<FlightDetailPage />} />
            <Route
              path="/login"
              element={
                <ProtectedRoute guestOnly>
                  <LoginPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/register"
              element={
                <ProtectedRoute guestOnly>
                  <RegisterPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <ProtectedRoute guestOnly>
                  <PasswordRecoveryPage />
                </ProtectedRoute>
              }
            />
            {/* /reset-password kept for backward compat — redirects to combined page */}
            <Route path="/reset-password" element={<Navigate to="/forgot-password" replace />} />

            {/* ── Admin Login ────────────────────────────────────────────── */}
            <Route
              path="/admin/login"
              element={
                <ProtectedRoute guestOnly>
                  <AdminLoginPage />
                </ProtectedRoute>
              }
            />

            {/* ── Protected Passenger Routes ─────────────────────────────── */}
            <Route path="/flights/:id/checkout" element={<ProtectedRoute><BookingCheckoutPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
            <Route path="/my-bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
            <Route path="/booking-confirmation/:id" element={<ProtectedRoute><BookingConfirmationPage /></ProtectedRoute>} />
            <Route path="/booking-confirmation/waitlist/:id" element={<ProtectedRoute><BookingConfirmationPage /></ProtectedRoute>} />
            <Route path="/my-bookings/ticket/:id" element={<ProtectedRoute><TicketDetailPage /></ProtectedRoute>} />
            <Route path="/my-bookings/ticket/waitlist/:id" element={<ProtectedRoute><TicketDetailPage /></ProtectedRoute>} />
            <Route path="/my-bookings/cancel/:id" element={<ProtectedRoute><TicketCancellationPage /></ProtectedRoute>} />
            <Route path="/my-bookings/cancel/waitlist/:id" element={<ProtectedRoute><TicketCancellationPage /></ProtectedRoute>} />

            {/* ── Admin Routes ───────────────────────────────────────────── */}
            {/* Redirect /admin/flights → /admin/overview (legacy compat) */}
            <Route path="/admin/flights" element={<Navigate to="/admin/overview" replace />} />

            {/* Direct links */}
            <Route path="/admin/overview" element={<AdminRoute><FlightOverviewPage /></AdminRoute>} />
            <Route path="/admin/analytics" element={<AdminRoute><AnalyticsDashboard /></AdminRoute>} />

            {/* Master data */}
            <Route path="/admin/master/airports" element={<AdminRoute><AirportsPage /></AdminRoute>} />
            <Route path="/admin/master/airlines" element={<AdminRoute><AirlinesPage /></AdminRoute>} />
            <Route path="/admin/master/aircraft-models" element={<AdminRoute><AircraftModelsPage /></AdminRoute>} />
            <Route path="/admin/master/aircraft" element={<AdminRoute><AircraftPage /></AdminRoute>} />
            <Route path="/admin/master/food-items" element={<AdminRoute><FoodItemsPage /></AdminRoute>} />

            {/* Operations */}
            <Route path="/admin/operations/flight-routes" element={<AdminRoute><FlightRoutesPage /></AdminRoute>} />
            <Route path="/admin/operations/route-fare-classes" element={<AdminRoute><RouteFareClassesPage /></AdminRoute>} />
            <Route path="/admin/operations/fare-price-logs" element={<AdminRoute><FarePriceLogsPage /></AdminRoute>} />
            <Route path="/admin/operations/flight-instances" element={<AdminRoute><FlightInstancesPage /></AdminRoute>} />
            <Route path="/admin/operations/seat-map" element={<AdminRoute><SeatMapPage /></AdminRoute>} />
            <Route path="/admin/operations/fares" element={<AdminRoute><FaresPage /></AdminRoute>} />
            <Route path="/admin/operations/meals" element={<AdminRoute><MealsPage /></AdminRoute>} />

            {/* Records */}
            <Route path="/admin/records/bookings" element={<AdminRoute><AdminBookingsPage /></AdminRoute>} />

            {/* System */}
            <Route path="/admin/system/data-management" element={<AdminRoute><DataManagementPage /></AdminRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </>
  );
}


export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </Provider>
  );
}
