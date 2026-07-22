import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authAPI } from '@/services/auth-service/authService';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const initialEmail = location.state?.email || '';
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please provide your email address.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.resetPassword(email, otp, password);
      toast.success(res.detail || "Password has been successfully updated!");
      navigate('/login');
    } catch (err) {
      const errorMsg = JSON.parse(err.message);
      if (errorMsg.new_password) {
        toast.error(errorMsg.new_password[0]);
      } else if (errorMsg.error) {
        toast.error(errorMsg.error);
      } else {
        toast.error("An error occurred while resetting the password.");
      }
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
                Create a new password<br />
                <span style={{ opacity: 0.65, fontSize: '0.9rem', fontWeight: 400 }}>&amp; secure your account.</span>
              </p>
            </div>
            <div className="auth-brand-footer">{t("footer.copyright", { year: 2025 })}</div>
          </div>

          {/* ── Right: Form panel ── */}
          <div className="auth-split-form">
            <div className="form-header">
              <div className="form-icon">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="form-title">Reset Password</h1>
              <p className="form-subtitle">Enter your new strong password below.</p>
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
                disabled={loading || !!initialEmail}
              />
              <Input
                id="otp"
                type="text"
                label="6-Digit OTP"
                placeholder="123456"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
              />
              <PasswordInput
                id="password"
                label="New Password"
                placeholder="Enter new password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <PasswordInput
                id="confirmPassword"
                label="Confirm Password"
                placeholder="Re-enter new password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
              <button disabled={loading} className="auth-btn" type="submit">
                {loading ? <><div className="spinner" /> Resetting...</> : 'Reset Password'}
              </button>
            </form>
          </div>

        </div>
      </main>
    </div>
  );
}
