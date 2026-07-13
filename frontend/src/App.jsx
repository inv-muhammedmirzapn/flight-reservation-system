import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { fetchProfile } from './store/authSlice';

// Layout
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Authentication Pages (Guest)
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';

// Customer Pages
import UserFlightsList from './pages/user/UserFlightsList';
import UserFlightDetail from './pages/user/UserFlightDetail';

// Admin Pages
import AdminFlightsList from './pages/admin/AdminFlightsList';
import AdminFlightDetail from './pages/admin/AdminFlightDetail';

import './index.css';

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, token } = useSelector((state) => state.auth);
  
  // Auth view toggling state (Sign In vs Register)
  const [isLogin, setIsLogin] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (token) {
      dispatch(fetchProfile());
    }
  }, [dispatch, token]);

  const handleRegisterSuccess = () => {
    setIsLogin(true);
    setSuccessMsg('Account created successfully! Please sign in.');
  };

  return (
    <BrowserRouter>
      <div className="bg-surface text-on-surface min-h-screen flex flex-col font-body-md antialiased relative z-0">
        
        {/* Ambient Background Glows */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] rounded-full bg-white blur-[100px] opacity-60 mix-blend-overlay"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[30vw] h-[30vw] rounded-full bg-primary-container blur-[120px] opacity-10"></div>
        </div>

        {/* Dynamic Responsive Navbar */}
        <Navbar onAuthTabChange={(val) => { setIsLogin(val); setSuccessMsg(''); }} />

        {/* Main Routed Area */}
        <main className="flex-grow flex items-center justify-center py-8 px-4 md:px-8 relative z-10 w-full">
          <Routes>
            {/* Guest/Auth Landing page */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute guestOnly>
                  <div className="w-full max-w-[480px] mx-auto">
                    <div className="glass-card rounded-[2rem] p-8 w-full flex flex-col gap-6">
                      {successMsg && isLogin && (
                        <div className="p-4 rounded-xl text-sm font-body-md border bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0] text-center mb-[-10px]">
                          {successMsg}
                        </div>
                      )}

                      {isLogin ? (
                        <LoginForm />
                      ) : (
                        <RegisterForm onSuccess={handleRegisterSuccess} />
                      )}

                      <div className="text-center font-body-sm text-body-sm text-on-surface-variant">
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button 
                          onClick={() => { setIsLogin(!isLogin); setSuccessMsg(''); }} 
                          className="text-primary font-bold hover:underline cursor-pointer"
                        >
                          {isLogin ? 'Join Club' : 'Sign In'}
                        </button>
                      </div>
                    </div>
                  </div>
                </ProtectedRoute>
              } 
            />

            {/* Customer Routes */}
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

            {/* Admin Routes */}
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

            {/* Fallback Catch-all Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
