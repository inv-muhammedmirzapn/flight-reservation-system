import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { fetchProfile } from '@/store/authSlice';
import router from '@/routes';
import './index.css';

function App() {
  const dispatch = useDispatch();
  const { token, profile, isInitializing } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token && !profile) {
      dispatch(fetchProfile());
    }
  }, [dispatch, token, profile]);

  if (isInitializing) {
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

  return <RouterProvider router={router} />;
}

export default App;