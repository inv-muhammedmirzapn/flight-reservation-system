import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

export default function ProtectedRoute({ children, adminOnly = false, guestOnly = false }) {
  const location = useLocation();
  const auth = useSelector((state) => state?.auth) || {};
  const isAuthenticated = Boolean(auth.isAuthenticated || auth.token);
  const isAdmin = Boolean(auth.isAdmin);

  // Logged-in user trying to access guest-only pages (login/register)
  if (isAuthenticated && guestOnly) {
    return isAdmin
      ? <Navigate to="/admin/overview" replace />
      : <Navigate to="/" replace />;
  }

  // Unauthenticated user trying to access protected pages
  if (!isAuthenticated && !guestOnly) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Non-admin trying to access admin-only pages
  if (isAuthenticated && adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
