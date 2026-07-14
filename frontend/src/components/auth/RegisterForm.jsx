import { useState } from 'react';
import { authAPI } from '../../services/api';
import { Input } from '../ui/Input';
import { PasswordInput } from '../ui/PasswordInput';
import { PasswordStrength, getPasswordRules } from '../ui/PasswordStrength';

export function RegisterForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    first_name: '',
    last_name: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    // Required-fields check
    if (!formData.username.trim() || !formData.password.trim() || !formData.email.trim() || !formData.first_name.trim() || !formData.last_name.trim()) {
      setMessage({ type: 'error', text: 'All fields are required.' });
      return;
    }

    // Password complexity rules
    const rules = getPasswordRules(formData.password);
    const failed = rules.filter(r => !r.pass);
    if (failed.length > 0) {
      setMessage({ type: 'error', text: `Password: ${failed[0].label.toLowerCase()}` });
      return;
    }

    // Confirm password match
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...registerPayload } = formData;
      await authAPI.register(registerPayload);
      onSuccess();
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
      setLoading(false);
    }
  };

  return (
    <>
      <div className="form-header">
        <h1 className="form-title">Create account</h1>
        <p className="form-subtitle">Fill in your details to get started</p>
      </div>

      {message.text && (
        <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '1.25rem' }}>
          <span>{message.type === 'error' ? '⚠️' : '✅'}</span>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="register-form-grid" autoComplete="off">
        <div className="register-form-col">
          <div className="field-row">
            <Input id="first_name" label="First Name" placeholder="John" required value={formData.first_name} onChange={handleChange} autoComplete="off" />
            <Input id="last_name" label="Last Name" placeholder="Doe" required value={formData.last_name} onChange={handleChange} autoComplete="off" />
          </div>
          <Input id="email" label="Email Address" type="email" placeholder="you@example.com" required value={formData.email} onChange={handleChange} autoComplete="off" />
          <Input id="username" label="Username" placeholder="Choose a username" required value={formData.username} onChange={handleChange} autoComplete="off" />
        </div>

        <div className="register-form-col">
          <PasswordInput id="password" label="Password" placeholder="Create a strong password" required value={formData.password} onChange={handleChange} autoComplete="new-password" />
          <PasswordInput id="confirmPassword" label="Confirm Password" placeholder="Repeat your password" required value={formData.confirmPassword} onChange={handleChange} autoComplete="new-password" />
          <PasswordStrength password={formData.password} />
        </div>

        <button disabled={loading} className="auth-btn submit-btn-grid" type="submit">
          {loading ? <><div className="spinner" /> Creating account...</> : 'Create Account'}
        </button>
      </form>
    </>
  );
}