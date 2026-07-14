import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Routes, Route, Navigate } from 'react-router-dom';
import { fetchProfile } from './store/authSlice';

// Layout
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Footer } from './components/layout/Footer';

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

// Profile (friend's work)
import ProfilePage from './pages/ProfilePage';

import './index.css';

function App() {
  const dispatch = useDispatch();
  const { token, isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token) {
      dispatch(fetchProfile());
    }
  }, [dispatch, token]);

  return (
    <>
      {/* Background blobs */}
      <div className="page-bg-blob-1" />
      <div className="page-bg-blob-2" />

      {/* Single Navbar handles both guest and authenticated states */}
      <Navbar />

      {/* pt-24 clears the fixed floating navbar (64px + 1rem top offset) */}
      <main>
        <Routes>
          {/* ── Public (guest only) ── */}
          <Route path="/" element={<ProtectedRoute guestOnly><LandingPage /></ProtectedRoute>} />
          <Route path="/login" element={<ProtectedRoute guestOnly><LoginPage /></ProtectedRoute>} />
          <Route path="/register" element={<ProtectedRoute guestOnly><RegisterPage /></ProtectedRoute>} />

          {/* ── Customer ── */}
          <Route path="/flights" element={<ProtectedRoute><UserFlightsList /></ProtectedRoute>} />
          <Route path="/flights/:id" element={<ProtectedRoute><UserFlightDetail /></ProtectedRoute>} />

          {/* ── Profile (friend's page) ── */}
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          {/* ── Admin ── */}
          <Route path="/admin/flights" element={<ProtectedRoute adminOnly><AdminFlightsList /></ProtectedRoute>} />
          <Route path="/admin/flights/:id" element={<ProtectedRoute adminOnly><AdminFlightDetail /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </>
  );
}

export default App;