import { useState } from 'react';
import { authAPI } from './services/api';
import './index.css';

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await authAPI.register(formData);
      setMessage({ type: 'success', text: 'Account created! Please sign in.' });
      setIsLogin(true);
    } catch (err) {
      setMessage({ type: 'error', text: 'Registration failed: ' + err.message });
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const data = await authAPI.login({ username: formData.username, password: formData.password });
      setMessage({ type: 'success', text: 'Successfully logged in! Token acquired.' });
      console.log("Access Token:", data.access);
    } catch (err) {
      setMessage({ type: 'error', text: 'Login failed: ' + err.message });
    }
    setLoading(false);
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col font-body-md antialiased relative z-0">
      {/* Ambient Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] rounded-full bg-white blur-[100px] opacity-60 mix-blend-overlay"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[30vw] h-[30vw] rounded-full bg-primary-container blur-[120px] opacity-10"></div>
      </div>

      <nav className="bg-white/70 backdrop-blur-[30px] w-full sticky top-0 z-50 shadow-[0px_20px_40px_rgba(0,0,0,0.04)]">
        <div className="flex justify-between items-center h-20 px-lg max-w-[1200px] mx-auto">
          <div className="font-headline-lg text-headline-lg text-on-surface tracking-tighter">
            AeroGlass
          </div>
          <div className="flex gap-sm items-center">
            <button onClick={() => setIsLogin(true)} className="text-on-surface-variant font-display-bold text-display-bold hover:text-primary transition-all duration-300 hidden md:block">
              Sign In
            </button>
            <button onClick={() => setIsLogin(false)} className="bg-on-surface text-primary-container px-md py-sm rounded-xl font-display-bold text-display-bold hover:bg-surface-variant hover:text-on-surface transition-colors duration-300 active:scale-95">
              Join Club
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-grow flex items-center justify-center py-8 px-4 md:px-8 relative z-10">
        <div className="w-full max-w-[480px]">
          <div className="glass-card rounded-[2rem] p-8 w-full flex flex-col gap-6">
            <div className="text-center flex flex-col gap-2">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-on-surface">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {isLogin ? 'Sign in to continue your journey.' : 'Join AeroGlass for an elevated travel experience.'}
              </p>
            </div>

            {message.text && (
              <div className={`p-4 rounded-xl text-sm font-body-md border ${message.type === 'error' ? 'bg-error-container text-on-error-container border-[#ffb4ab]' : 'bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]'}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={isLogin ? handleLogin : handleRegister} className="flex flex-col gap-4">
              {!isLogin && (
                <>
                  <div className="flex gap-4">
                    <div className="relative floating-input bg-white/50 border border-white/60 rounded-xl px-4 py-2 focus-within:border-primary/50 transition-colors w-1/2">
                      <input 
                        className="w-full bg-transparent border-none outline-none focus:ring-0 font-body-md text-on-surface pt-4 pb-1 z-10 relative peer" 
                        id="first_name" name="first_name" placeholder=" " required value={formData.first_name} onChange={handleChange} type="text"
                      />
                      <label className="absolute left-4 top-1/2 -translate-y-1/2 font-body-md text-on-surface-variant transition-all duration-200 pointer-events-none origin-left" htmlFor="first_name">First Name</label>
                    </div>
                    <div className="relative floating-input bg-white/50 border border-white/60 rounded-xl px-4 py-2 focus-within:border-primary/50 transition-colors w-1/2">
                      <input 
                        className="w-full bg-transparent border-none outline-none focus:ring-0 font-body-md text-on-surface pt-4 pb-1 z-10 relative peer" 
                        id="last_name" name="last_name" placeholder=" " required value={formData.last_name} onChange={handleChange} type="text"
                      />
                      <label className="absolute left-4 top-1/2 -translate-y-1/2 font-body-md text-on-surface-variant transition-all duration-200 pointer-events-none origin-left" htmlFor="last_name">Last Name</label>
                    </div>
                  </div>

                  <div className="relative floating-input bg-white/50 border border-white/60 rounded-xl px-4 py-2 focus-within:border-primary/50 transition-colors">
                    <input 
                      className="w-full bg-transparent border-none outline-none focus:ring-0 font-body-md text-on-surface pt-4 pb-1 z-10 relative peer" 
                      id="email" name="email" placeholder=" " required value={formData.email} onChange={handleChange} type="email"
                    />
                    <label className="absolute left-4 top-1/2 -translate-y-1/2 font-body-md text-on-surface-variant transition-all duration-200 pointer-events-none origin-left" htmlFor="email">Email Address</label>
                  </div>
                </>
              )}

              <div className="relative floating-input bg-white/50 border border-white/60 rounded-xl px-4 py-2 focus-within:border-primary/50 transition-colors">
                <input 
                  className="w-full bg-transparent border-none outline-none focus:ring-0 font-body-md text-on-surface pt-4 pb-1 z-10 relative peer" 
                  id="username" name="username" placeholder=" " required value={formData.username} onChange={handleChange} type="text"
                />
                <label className="absolute left-4 top-1/2 -translate-y-1/2 font-body-md text-on-surface-variant transition-all duration-200 pointer-events-none origin-left" htmlFor="username">Username</label>
              </div>

              <div className="relative floating-input bg-white/50 border border-white/60 rounded-xl px-4 py-2 focus-within:border-primary/50 transition-colors">
                <input 
                  className="w-full bg-transparent border-none outline-none focus:ring-0 font-body-md text-on-surface pt-4 pb-1 z-10 relative peer" 
                  id="password" name="password" placeholder=" " required value={formData.password} onChange={handleChange} type="password"
                />
                <label className="absolute left-4 top-1/2 -translate-y-1/2 font-body-md text-on-surface-variant transition-all duration-200 pointer-events-none origin-left" htmlFor="password">Password</label>
              </div>

              <button disabled={loading} className="w-full bg-primary-container text-on-surface font-display-bold text-display-bold py-3 rounded-xl mt-4 hover:bg-[#ffe140] transition-colors duration-300 shadow-[0px_8px_16px_rgba(255,215,0,0.2)] active:scale-95 flex items-center justify-center gap-xs" type="submit">
                {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="text-center font-body-sm text-body-sm text-on-surface-variant">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-display-bold hover:underline">
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
