import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function RootLayout() {
  return (
    <>
      {/* Global toast notifications — Passenger themed */}
      <Toaster
        position="top-right"
        containerStyle={{ top: '110px' }}
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

      <main>
        <Outlet />
      </main>

      <Footer />
    </>
  );
}
