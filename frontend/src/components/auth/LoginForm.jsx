import { useState } from 'react';
import { authAPI } from '../../services/api';
import { Input } from '../ui/Input';
import { PasswordInput } from '../ui/PasswordInput';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export function LoginForm({ clearGlobalSuccess }) {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (clearGlobalSuccess) clearGlobalSuccess();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const data = await authAPI.login(formData);
      setMessage({ type: 'success', text: 'Signed in successfully!' });
      console.log('Access Token:', data.access);
    } catch (err) {
      let errText = err.message;
      try {
        const errObj = JSON.parse(err.message);
        if (errObj.detail) errText = errObj.detail;
        else errText = Object.keys(errObj)
          .map(k => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${Array.isArray(errObj[k]) ? errObj[k][0] : errObj[k]}`)
          .join(' · ');
      } catch (_) {}
      setMessage({ type: 'error', text: errText });
    }
    setLoading(false);
  };

  const handleGoogleLogin = () => {
    // TODO: wire up backend OAuth2 redirect
    console.log('Google OAuth — coming soon');
  };

  return (
    <>
      <div className="form-header">
        <div className="form-icon">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="form-title">Welcome back</h1>
        <p className="form-subtitle">Sign in to your AeroGlass account</p>
      </div>

      {message.text && (
        <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          <span>{message.type === 'error' ? '⚠️' : '✅'}</span>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-fields">
        <Input
          id="username"
          label="Username or Email"
          placeholder="Enter your username or email"
          required
          value={formData.username}
          onChange={handleChange}
          autoComplete="username"
        />
        <PasswordInput
          id="password"
          label="Password"
          placeholder="Enter your password"
          required
          value={formData.password}
          onChange={handleChange}
          autoComplete="current-password"
        />
        <button disabled={loading} className="auth-btn" type="submit">
          {loading ? <><div className="spinner" /> Signing in...</> : 'Sign In'}
        </button>
      </form>

      {/* OR divider */}
      <div className="or-divider">
        <span className="or-divider-line" />
        <span className="or-divider-text">or continue with</span>
        <span className="or-divider-line" />
      </div>

      {/* Google Sign-In */}
      <button type="button" className="google-btn" onClick={handleGoogleLogin}>
        <GoogleIcon />
        Continue with Google
      </button>
    </>
  );
}
