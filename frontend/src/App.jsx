import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { fetchProfile } from './store/authSlice';

// Layout
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Footer } from './components/layout/Footer';

// Public Pages
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { AdminLoginPage } from './components/auth/AdminLoginPage';
import { RegisterPage } from './components/auth/RegisterPage';

// Customer Pages
import UserFlightsList from './pages/user/UserFlightsList';
import UserFlightDetail from './pages/user/UserFlightDetail';

// Admin Pages
import AdminFlightsList from './pages/admin/AdminFlightsList';
import AdminFlightDetail from './pages/admin/AdminFlightDetail';
import AdminFlightForm from './pages/admin/AdminFlightForm';

// Profile (friend's work)
import ProfilePage from './pages/ProfilePage';

import './index.css';

function App() {
  const dispatch = useDispatch();
  const { token, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token) {
      dispatch(fetchProfile());
    }
  }, [dispatch, token]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div className="page-bg-blob-1" style={{ top: '-10%', left: '-10%' }} />
        <div className="page-bg-blob-2" style={{ bottom: '-10%', right: '-10%' }} />
        <div className="glass-card" style={{
          padding: '40px 60px',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
          zIndex: 10,
        }}>
          <div style={{
            width: 48,
            height: 48,
            border: '3px solid rgba(112,93,0,0.1)',
            borderTopColor: '#705d00',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <h2 style={{
            fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
            fontSize: 18,
            fontWeight: 700,
            color: '#1a1c1d',
            margin: 0,
          }}>
            Loading AeroGlass...
          </h2>
          <p style={{ fontSize: 13, color: '#5e5e5e', margin: 0 }}>
            Verifying secure session
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Global toast notifications — AeroGlass themed */}
      <Toaster
        position="bottom-center"
        gutter={10}
        toastOptions={{
          duration: 3500,
          style: {
            background: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.55)',
            borderRadius: '0.875rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.9) inset',
            color: '#1a1c1d',
            fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif",
            fontWeight: 500,
            fontSize: '0.875rem',
            padding: '13px 18px',
            minWidth: '260px',
            maxWidth: '380px',
          },
          success: {
            iconTheme: { primary: '#705d00', secondary: '#ffd700' },
          },
          error: {
            iconTheme: { primary: '#991b1b', secondary: '#fff' },
          },
          loading: {
            iconTheme: { primary: '#705d00', secondary: '#ffd700' },
          },
        }}
      />

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
          <Route path="/admin/login" element={<ProtectedRoute guestOnly><AdminLoginPage /></ProtectedRoute>} />
          <Route path="/register" element={<ProtectedRoute guestOnly><RegisterPage /></ProtectedRoute>} />

          {/* ── Customer ── */}
          <Route path="/flights" element={<UserFlightsList />} />
          <Route path="/flights/:id" element={<UserFlightDetail />} />

          {/* ── Profile (friend's page) ── */}
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          {/* ── Admin ── */}
          <Route path="/admin/flights" element={<ProtectedRoute adminOnly><AdminFlightsList /></ProtectedRoute>} />
          <Route path="/admin/flights/new" element={<ProtectedRoute adminOnly><AdminFlightForm /></ProtectedRoute>} />
          <Route path="/admin/flights/:id" element={<ProtectedRoute adminOnly><AdminFlightDetail /></ProtectedRoute>} />
          <Route path="/admin/flights/:id/edit" element={<ProtectedRoute adminOnly><AdminFlightForm /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </>
  );
}

export default App;