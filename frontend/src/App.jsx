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
    setSuccessMsg('Account created successfully! Please sign in.');
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col font-body-md antialiased relative z-0">
      {/* Ambient Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] rounded-full bg-white blur-[100px] opacity-60 mix-blend-overlay"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[30vw] h-[30vw] rounded-full bg-primary-container blur-[120px] opacity-10"></div>
      </div>

      <Navbar setIsLogin={(val) => { setIsLogin(val); setSuccessMsg(''); }} />

      <main className="flex-grow flex items-center justify-center py-8 px-4 md:px-8 relative z-10">
        <div className="w-full max-w-[480px]">
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
              <button onClick={() => { setIsLogin(!isLogin); setSuccessMsg(''); }} className="text-primary font-bold hover:underline">
                {isLogin ? 'Join Club' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
