import { useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import './index.css';

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegisterSuccess = () => {
    setIsLogin(true);
    setSuccessMsg('Account created! You can now sign in.');
  };

  const switchView = (val) => {
    setIsLogin(val);
    setSuccessMsg('');
  };

  return (
    <div className="page-wrapper">
      <div className="page-bg-blob-1" />
      <div className="page-bg-blob-2" />

      <Navbar setIsLogin={switchView} />

      <main className="page-main">
        {isLogin ? (
          /* ── Login: single narrow card ── */
          <div className="auth-container">
            <div className="glass-card">
              {successMsg && (
                <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
                  <span>✅</span>
                  {successMsg}
                </div>
              )}
              <LoginForm clearGlobalSuccess={() => setSuccessMsg('')} />
              <hr className="auth-divider" />
              <div className="auth-toggle">
                Don't have an account?
                <button className="auth-toggle-btn" onClick={() => switchView(false)}>Join Club</button>
              </div>
            </div>
          </div>
        ) : (
          /* ── Register: wide two-column card ── */
          <div className="auth-container-wide">
            {/* RegisterForm renders its own two-column card */}
            <RegisterForm onSuccess={handleRegisterSuccess} />
            <div className="auth-toggle" style={{ marginTop: '1rem' }}>
              Already have an account?
              <button className="auth-toggle-btn" onClick={() => switchView(true)}>Sign In</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
