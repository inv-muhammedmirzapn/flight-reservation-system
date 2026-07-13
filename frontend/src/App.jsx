import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { fetchProfile } from './store/authSlice';

// Layout
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Public Pages
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';

// Customer Pages
import UserFlightsList from './pages/user/UserFlightsList';
import UserFlightDetail from './pages/user/UserFlightDetail';

// Admin Pages
import AdminFlightsList from './pages/admin/AdminFlightsList';
import AdminFlightDetail from './pages/admin/AdminFlightDetail';

import './index.css';

function App() {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token) {
      dispatch(fetchProfile());
    }
  }, [dispatch, token]);

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
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

        {/* Customer */}
        <Route
          path="/flights"
          element={
            <ProtectedRoute>
              <UserFlightsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/flights/:id"
          element={
            <ProtectedRoute>
              <UserFlightDetail />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin/flights"
          element={
            <ProtectedRoute adminOnly>
              <AdminFlightsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/flights/:id"
          element={
            <ProtectedRoute adminOnly>
              <AdminFlightDetail />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;