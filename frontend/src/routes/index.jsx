import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import RootLayout from '@/layouts/RootLayout';
import { ProtectedRoute } from './guards/ProtectedRoute';

// Lazy load all page components
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'));
const LoginPage = lazy(() => import('@/pages/auth/login/LoginPage'));
const AdminLoginPage = lazy(() => import('@/pages/auth/login/AdminLoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/sign-up/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/login/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/login/ResetPasswordPage'));
const UserFlightsList = lazy(() => import('@/pages/user/UserFlightsList'));
const UserFlightDetail = lazy(() => import('@/pages/user/UserFlightDetail'));
const MyBookingsPage = lazy(() => import('@/pages/user/MyBookingsPage'));
const TicketDetailPage = lazy(() => import('@/pages/user/TicketDetailPage'));
const BookingConfirmationPage = lazy(() => import('@/pages/user/BookingConfirmationPage'));
const ProfilePage = lazy(() => import('@/pages/user-profile/ProfilePage'));
const NotificationsPage = lazy(() => import('@/pages/user/NotificationsPage'));
const AnalyticsDashboard = lazy(() => import('@/admin/analytics/AnalyticsDashboard'));

// ── New admin entity pages ──────────────────────────────────────────────────────
// Master data
const AirportsPage = lazy(() => import('@/admin/master/airports/AirportsPage'));
const AirlinesPage = lazy(() => import('@/admin/master/airlines/AirlinesPage'));
const AircraftModelsPage = lazy(() => import('@/admin/master/aircraft/AircraftModelsPage'));
const AircraftPage = lazy(() => import('@/admin/master/aircraft/AircraftPage'));
const FoodItemsPage = lazy(() => import('@/admin/master/food-items/FoodItemsPage'));
// Operations
const FlightRoutesPage = lazy(() => import('@/admin/operations/flight-routes/FlightRoutesPage'));
const FlightInstancesPage = lazy(() => import('@/admin/operations/flight-instances/FlightInstancesPage'));
const FlightOverviewPage = lazy(() => import('@/admin/operations/flight-overview/FlightOverviewPage'));
const SeatMapPage = lazy(() => import('@/admin/operations/seat-map/SeatMapPage'));
const FaresPage = lazy(() => import('@/admin/operations/fares/FaresPage'));
const MealsPage = lazy(() => import('@/admin/operations/meals/MealsPage'));
// Records
const AdminBookingsPage = lazy(() => import('@/admin/records/bookings/AdminBookingsPage'));
const AdminPaymentsPage = lazy(() => import('@/admin/records/payments/AdminPaymentsPage'));
const AdminPassengersPage = lazy(() => import('@/admin/records/passengers/AdminPassengersPage'));
// System
const DataManagementPage = lazy(() => import('@/admin/system/data-management/DataManagementPage'));

const LoadingFallback = () => (
  <div className="flex-grow flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#705d00]"></div>
  </div>
);

// Helper to wrap a page in ProtectedRoute + Suspense (admin-only)
const adminRoute = (element) => (
  <ProtectedRoute adminOnly>
    <Suspense fallback={<LoadingFallback />}>{element}</Suspense>
  </ProtectedRoute>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // Public/Guest Routes
      {
        index: true,
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <LandingPage />
          </Suspense>
        ),
      },
      {
        path: 'login',
        element: (
          <ProtectedRoute guestOnly>
            <Suspense fallback={<LoadingFallback />}>
              <LoginPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/login',
        element: (
          <ProtectedRoute guestOnly>
            <Suspense fallback={<LoadingFallback />}>
              <AdminLoginPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'register',
        element: (
          <ProtectedRoute guestOnly>
            <Suspense fallback={<LoadingFallback />}>
              <RegisterPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'forgot-password',
        element: (
          <ProtectedRoute guestOnly>
            <Suspense fallback={<LoadingFallback />}>
              <ForgotPasswordPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'reset-password',
        element: (
          <ProtectedRoute guestOnly>
            <Suspense fallback={<LoadingFallback />}>
              <ResetPasswordPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },

      // Customer Routes (Public search & details)
      {
        path: 'flights',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <UserFlightsList />
          </Suspense>
        ),
      },
      {
        path: 'flights/:id',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <UserFlightDetail />
          </Suspense>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <ProfilePage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'my-bookings',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <MyBookingsPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'my-bookings/booking/:id',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <TicketDetailPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'my-bookings/waitlist/:id',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <TicketDetailPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'notifications',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <NotificationsPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'bookings/:id/confirmation',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <BookingConfirmationPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },

      // Admin home
      { path: 'admin/flights', element: <Navigate to="/admin/overview" replace /> },
      { path: 'admin/analytics', element: adminRoute(<AnalyticsDashboard />) },

      // ── Master Data ─────────────────────────────────────────────────────────
      { path: 'admin/master/airports', element: adminRoute(<AirportsPage />) },
      { path: 'admin/master/airlines', element: adminRoute(<AirlinesPage />) },
      { path: 'admin/master/aircraft-models', element: adminRoute(<AircraftModelsPage />) },
      { path: 'admin/master/aircraft', element: adminRoute(<AircraftPage />) },
      { path: 'admin/master/food-items', element: adminRoute(<FoodItemsPage />) },

      // ── Operations ──────────────────────────────────────────────────────────
      { path: 'admin/overview', element: adminRoute(<FlightOverviewPage />) },
      { path: 'admin/operations/flight-routes', element: adminRoute(<FlightRoutesPage />) },
      { path: 'admin/operations/flight-instances', element: adminRoute(<FlightInstancesPage />) },
      { path: 'admin/operations/seat-map', element: adminRoute(<SeatMapPage />) },
      { path: 'admin/operations/fares', element: adminRoute(<FaresPage />) },
      { path: 'admin/operations/meals', element: adminRoute(<MealsPage />) },

      // ── Records ─────────────────────────────────────────────────────────────
      { path: 'admin/records/bookings', element: adminRoute(<AdminBookingsPage />) },
      { path: 'admin/records/payments', element: adminRoute(<AdminPaymentsPage />) },
      { path: 'admin/records/passengers', element: adminRoute(<AdminPassengersPage />) },

      // ── System ───────────────────────────────────────────────────────────────
      { path: 'admin/system/data-management', element: adminRoute(<DataManagementPage />) },

      // Fallback
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

export default router;

