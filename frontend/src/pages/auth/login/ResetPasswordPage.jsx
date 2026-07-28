import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authAPI } from '@/services/auth-service/authService';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Input } from '@/components/ui/Input';
import { CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\,.?":{}|<>]).{8,}$/;

function calcStrength(pwd) {
  let score = 0;
  if (!pwd) return score;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[!@#$%^&*()\,.?":{}|<>]/.test(pwd)) score++;
  return Math.min(score, 4);
}

const STRENGTH_META = [
  { label: "Too weak", color: "#ef4444" },
  { label: "Weak", color: "#f97316" },
  { label: "Fair", color: "#eab308" },
  { label: "Good", color: "#22c55e" },
  { label: "Strong", color: "#16a34a" },
];

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
  const [touched, setTouched] = useState({ password: false, confirmPassword: false });

  const strength = useMemo(() => calcStrength(password), [password]);

  const errors = useMemo(() => {
    const e = {};
    if (touched.password) {
      if (!password) e.password = "New password is required.";
      else if (password.length < 8) e.password = "Password must be at least 8 characters.";
      else if (!PWD_REGEX.test(password)) e.password = "Must include uppercase, lowercase, number & special character.";
    }
    if (touched.confirmPassword) {
      if (!confirmPassword) e.confirmPassword = "Please confirm your new password.";
      else if (password && confirmPassword !== password) e.confirmPassword = "Passwords do not match.";
    }
    return e;
  }, [password, confirmPassword, touched]);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const isFormValid =
    password &&
    confirmPassword &&
    Object.keys(errors).length === 0 &&
    PWD_REGEX.test(password) &&
    password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please provide your email address.");
      return;
    }
    setTouched({ password: true, confirmPassword: true });
    if (!isFormValid) {
      toast.error("Please ensure all password requirements are met.");
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.resetPassword(email, otp, password);
      toast.success(res.detail || "Password has been successfully updated!");
      navigate('/login');
    } catch (err) {
      let errMsg = "An error occurred while resetting the password.";
      try {
        const errorMsg = JSON.parse(err.message);
        if (errorMsg.new_password) errMsg = errorMsg.new_password[0];
        else if (errorMsg.error) errMsg = errorMsg.error;
        else if (errorMsg.detail) errMsg = errorMsg.detail;
      } catch {
        errMsg = err.message || errMsg;
      }
      toast.error(errMsg);
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
            <div className="auth-brand-footer">{t("footer.copyright", { year: 2026 })}</div>
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
                onBlur={() => handleBlur('password')}
                error={errors.password}
                disabled={loading}
              />
              {password && (
                <div style={{ marginTop: "-0.5rem", marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: "4px", borderRadius: "2px",
                          background: i <= strength ? (STRENGTH_META[strength]?.color || STRENGTH_META[0].color) : "rgba(0,0,0,0.1)",
                          transition: "background 0.3s",
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: "0.75rem", color: STRENGTH_META[strength]?.color || STRENGTH_META[0].color, fontWeight: "600" }}>
                    {STRENGTH_META[strength]?.label || STRENGTH_META[0].label}
                  </span>
                </div>
              )}

              <PasswordInput
                id="confirmPassword"
                label="Confirm Password"
                placeholder="Re-enter new password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                error={errors.confirmPassword}
                disabled={loading}
              />
              {touched.confirmPassword && confirmPassword && !errors.confirmPassword && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#16a34a", fontSize: "0.78rem", fontWeight: "500", marginTop: "-0.5rem", marginBottom: "1.25rem" }}>
                  <CheckCircle2 size={13} /> Passwords match ✓
                </div>
              )}
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
