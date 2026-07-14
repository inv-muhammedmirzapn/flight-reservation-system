import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

export function ProtectedRoute({ children, adminOnly = false, guestOnly = false }) {
  const { isAuthenticated, isAdmin } = useSelector((state) => state.auth);

  if (isAuthenticated && guestOnly) {
    // If user is logged in and tries to access guest pages (like login/register), redirect to their dashboard
    return isAdmin ? <Navigate to="/admin/flights" replace /> : <Navigate to="/flights" replace />;
  }

  if (!isAuthenticated && !guestOnly) {
    // If user is not logged in and tries to access private pages, redirect to login
    return <Navigate to="/" replace />;
  }

  if (isAuthenticated && adminOnly && !isAdmin) {
    // If customer tries to access admin-only pages, redirect to customer dashboard
    return <Navigate to="/flights" replace />;
  }

  return children;
}
