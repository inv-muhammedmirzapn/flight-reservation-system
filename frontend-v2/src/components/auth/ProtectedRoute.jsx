import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

export default function ProtectedRoute({
  children,
  adminOnly = false,
  guestOnly = false,
  passengerOnly = false,
  allowGuest = false,
}) {
  const location = useLocation();
  const auth = useSelector((state) => state?.auth) || {};
  const { isAuthenticated, isAdmin, isInitializing } = auth;

  // While app is checking session cookie on initial load, show loading state
  if (isInitializing) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
      </div>
    );
  }

  // Logged-in user trying to access guest-only pages (login/register/admin-login)
  if (isAuthenticated && guestOnly) {
    return isAdmin
      ? <Navigate to="/admin/overview" replace />
      : <Navigate to="/" replace />;
  }

  // Admin user trying to access passenger/client pages or any non-admin route
  if (isAuthenticated && isAdmin && (!adminOnly || passengerOnly)) {
    return <Navigate to="/admin/overview" replace />;
  }

  // Unauthenticated user trying to access protected pages
  if (!isAuthenticated && !guestOnly && !allowGuest) {
    return <Navigate to={adminOnly ? "/admin/login" : "/login"} state={{ from: location }} replace />;
  }

  // Non-admin trying to access admin-only pages
  if (isAuthenticated && adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
