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
const AdminFlightsList = lazy(() => import('@/pages/admin/AdminFlightsList'));
const AdminFlightForm = lazy(() => import('@/pages/admin/AdminFlightForm'));
const AdminFlightDetail = lazy(() => import('@/pages/admin/AdminFlightDetail'));
const AnalyticsDashboard = lazy(() => import('@/pages/admin/AnalyticsDashboard'));

const LoadingFallback = () => (
  <div className="flex-grow flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#705d00]"></div>
  </div>
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

      // Authenticated Admin Routes
      {
        path: 'admin/flights',
        element: (
          <ProtectedRoute adminOnly>
            <Suspense fallback={<LoadingFallback />}>
              <AdminFlightsList />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/flights/new',
        element: (
          <ProtectedRoute adminOnly>
            <Suspense fallback={<LoadingFallback />}>
              <AdminFlightForm />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/flights/:id',
        element: (
          <ProtectedRoute adminOnly>
            <Suspense fallback={<LoadingFallback />}>
              <AdminFlightDetail />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/flights/:id/edit',
        element: (
          <ProtectedRoute adminOnly>
            <Suspense fallback={<LoadingFallback />}>
              <AdminFlightForm />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/analytics',
        element: (
          <ProtectedRoute adminOnly>
            <Suspense fallback={<LoadingFallback />}>
              <AnalyticsDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },

      // Fallback
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

export default router;
