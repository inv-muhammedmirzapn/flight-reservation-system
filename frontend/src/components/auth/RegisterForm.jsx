import { useState } from 'react';
import { authAPI } from '@/services/auth-service/authService';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PasswordStrength, getPasswordRules } from '@/components/ui/PasswordStrength';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export function RegisterForm({ onSuccess }) {
  const { t } = useTranslation();
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
      const msg = 'All fields are required.';
      setMessage({ type: 'error', text: msg });
      toast.error(msg);
      return;
    }

    // Password complexity rules
    const rules = getPasswordRules(formData.password);
    const failed = rules.filter(r => !r.pass);
    if (failed.length > 0) {
      const msg = `Password: ${failed[0].label.toLowerCase()}`;
      setMessage({ type: 'error', text: msg });
      toast.error(msg);
      return;
    }

    // Confirm password match
    if (formData.password !== formData.confirmPassword) {
      const msg = 'Passwords do not match.';
      setMessage({ type: 'error', text: msg });
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...registerPayload } = formData;
      await authAPI.register(registerPayload);
      toast.success('Account created. You can now sign in.');
      onSuccess();
    } catch (err) {
      const errText = err.message;
      setMessage({ type: 'error', text: errText });
      toast.error(errText);
      setLoading(false);
    }
  };

  return (
    <>
      <div className="form-header">
        <h1 className="form-title">{t("auth.createAccount")}</h1>
        <p className="form-subtitle">{t("auth.fillDetails")}</p>
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
            <Input id="first_name" label={t("auth.firstName")} placeholder={t("auth.placeholders.first")} required value={formData.first_name} onChange={handleChange} autoComplete="off" disabled={loading} />
            <Input id="last_name" label={t("auth.lastName")} placeholder={t("auth.placeholders.last")} required value={formData.last_name} onChange={handleChange} autoComplete="off" disabled={loading} />
          </div>
          <Input id="email" label={t("auth.email")} type="email" placeholder={t("auth.placeholders.email")} required value={formData.email} onChange={handleChange} autoComplete="off" disabled={loading} />
          <Input id="username" label={t("auth.username")} placeholder={t("auth.placeholders.username")} required value={formData.username} onChange={handleChange} autoComplete="off" disabled={loading} />
        </div>

        <div className="register-form-col">
          <PasswordInput id="password" label={t("auth.password")} placeholder={t("auth.placeholders.password")} required value={formData.password} onChange={handleChange} autoComplete="new-password" disabled={loading} />
          <PasswordInput id="confirmPassword" label={t("auth.confirmPassword")} placeholder={t("auth.placeholders.confirm")} required value={formData.confirmPassword} onChange={handleChange} autoComplete="new-password" disabled={loading} />
          <PasswordStrength password={formData.password} />
        </div>

        <button disabled={loading} className="auth-btn submit-btn-grid" type="submit">
          {loading ? <><div className="spinner" /> {t("auth.creatingAccount")}</> : t("auth.createAccountBtn")}
        </button>
      </form>
    </>
  );
}