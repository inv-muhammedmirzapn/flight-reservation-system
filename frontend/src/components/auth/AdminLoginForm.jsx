import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, logout } from '../../store/authSlice';
import { Input } from '../ui/Input';
import { PasswordInput } from '../ui/PasswordInput';
import { ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export function AdminLoginForm() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [localError, setLocalError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setLocalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim()) {
      const msg = 'Please enter both username and password.';
      setLocalError(msg);
      toast.error(msg);
      return;
    }
    
    const result = await dispatch(loginUser({ credentials: formData, requireAdmin: true }));
    
    if (result.meta.requestStatus === 'fulfilled') {
      toast.success('Welcome back, Admin. Access granted.');
      navigate('/admin/flights');
    } else {
      toast.error(result.payload);
    }
  };

  return (
    <>
      <style>{`
        .admin-auth-btn {
          width: 100%; padding: 14px; border-radius: 12px; border: none;
          background: #ffd700; color: #1a1c1d; font-weight: 700; font-size: 15px;
          cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px rgba(255,215,0,0.3);
          display: flex; justify-content: center; alignItems: center; gap: 8px;
        }
        .admin-auth-btn:hover:not(:disabled) { background: #e9c400; transform: translateY(-1px); }
        .admin-auth-btn:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>
      <div className="form-header">
        <div className="form-icon" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          <ShieldAlert size={22} />
        </div>
        <h1 className="form-title" style={{ fontFamily: "'Plus Jakarta Sans',Inter,sans-serif", fontWeight: 800 }}>Admin Login</h1>
        <p className="form-subtitle">Authenticate to access the workspace</p>
      </div>

      {(localError || error) && (
        <div className="alert alert-error">
          <span>⚠️</span>
          {localError || error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-fields">
        <Input
          id="username"
          name="username"
          label="Admin Username"
          placeholder="Enter administrator username"
          required
          value={formData.username}
          onChange={handleChange}
          autoComplete="username"
        />
        <PasswordInput
          id="password"
          name="password"
          label="Password"
          placeholder="Enter password"
          required
          value={formData.password}
          onChange={handleChange}
          autoComplete="current-password"
        />
        <button disabled={loading} className="admin-auth-btn" type="submit">
          {loading ? <><div className="spinner" style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: '#1a1c1d' }} /> Authenticating...</> : 'Access Workspace'}
        </button>
      </form>

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: '#5e5e5e' }}>
        Not an administrator? <Link to="/login" style={{ color: '#705d00', fontWeight: 600, textDecoration: 'none' }}>Return to Customer Login</Link>
      </div>
    </>
  );
}
