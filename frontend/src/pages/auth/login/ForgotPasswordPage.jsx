import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authAPI } from '@/services/auth-service/authService';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(email);
      toast.success(res.detail || "Password reset OTP sent!");
      navigate('/reset-password', { state: { email } });
    } catch (err) {
      const errorMsg = JSON.parse(err.message);
      toast.error(errorMsg.email?.[0] || errorMsg.detail || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page-bg" style={{ backgroundImage: 'none', background: 'linear-gradient(135deg, #f0f4ff 0%, #e8edf8 50%, #f5f0ff 100%)' }} />

      <main className="auth-page-main">
        <div className="auth-split-card">

          {/* ── Left: Brand panel ── */}
          <div className="auth-split-brand">
            <div>
              {/* Logo */}
              <img src="/updated%20logo.png" alt="Passenger Logo" style={{ height: "44px", objectFit: "contain", marginBottom: '1.25rem' }} />
              <p className="auth-brand-tagline" style={{ fontSize: '1.05rem', lineHeight: 1.6, fontWeight: 500 }}>
                Reset your password<br />
                <span style={{ opacity: 0.65, fontSize: '0.9rem', fontWeight: 400 }}>Securely &amp; quickly.</span>
              </p>
            </div>
            <div className="auth-brand-footer">{t("footer.copyright", { year: 2025 })}</div>
          </div>

          {/* ── Right: Form panel ── */}
          <div className="auth-split-form">
            <div className="form-header">
              <div className="form-icon">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h1 className="form-title">Forgot Password</h1>
              <p className="form-subtitle">Enter your email to receive a 6-digit OTP.</p>
            </div>

            <form onSubmit={handleSubmit} className="form-fields">
              <Input
                id="email"
                type="email"
                label="Email Address"
                placeholder="name@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <button disabled={loading} className="auth-btn" type="submit">
                {loading ? <><div className="spinner" /> Sending...</> : 'Send OTP'}
              </button>
            </form>

            <div className="auth-toggle">
              Remember your password?
              <Link className="auth-toggle-btn" to="/login">{t("auth.signIn")}</Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
