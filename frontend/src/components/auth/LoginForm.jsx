import { useState } from 'react';
import { authAPI } from '../../services/api';
import { Input } from '../ui/Input';
import { PasswordInput } from '../ui/PasswordInput';

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
    </>
  );
}
