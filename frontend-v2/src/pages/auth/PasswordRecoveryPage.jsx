import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { authAPI } from "@/services/auth-service/authService";
import { extractErrorMessage } from "@/services/apiClient";
import toast from "react-hot-toast";
import { PASSWORD_RULES } from "@/utils/validators";

const RESEND_COOLDOWN = 60; // seconds

// ---------------------------------------------------------------------------
// Shared layout wrapper — matches LoginPage / RegisterPage exactly
// ---------------------------------------------------------------------------
function PageShell({ title, children }) {
  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-12 mt-12 bg-slate-50/60">
      {/* Ambient blobs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-sky-200/50 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 -right-20 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-72 h-72 bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />

      {/* Page title */}
      <div className="relative z-10 text-center mb-4">
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl p-8 sm:px-10 animate-fade-in plain-card">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Request OTP
// ---------------------------------------------------------------------------
function RequestStep({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(email.trim());
      toast.success(res?.detail || "OTP sent! Check your inbox.");
      onSuccess(email.trim());
    } catch (err) {
      let msg = "Failed to send OTP. Please try again.";
      try { msg = extractErrorMessage(JSON.parse(err.message)); } catch { msg = err.message || msg; }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-slate-600 font-semibold text-xs hover:text-slate-900 transition-colors"
        >
          <span className="material-symbols-outlined text-xs select-none">arrow_back</span>
          Back to Sign In
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-700 animate-fade-in">
          <span className="material-symbols-outlined text-sm">error</span>
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
          Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          placeholder="Enter your email"
          autoComplete="email"
          className="input-field"
        />
      </div>

      <div className="flex justify-center pt-2">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary px-5 py-2 rounded-xl text-sm"
        >
          {loading ? "Sending OTP..." : "Send OTP"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Reset Password
// ---------------------------------------------------------------------------
function ResetStep({ email, onBack }) {
  const navigate = useNavigate();

  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({ password: false, confirm: false });

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Password rules
  const passwordRules = PASSWORD_RULES.map((r) => ({ ...r, met: r.test(password) }));
  const isPasswordStrong = passwordRules.every((r) => r.met);
  const showRequirements = isPasswordFocused || (password.length > 0 && !isPasswordStrong);

  const passwordErrors = useMemo(() => {
    const e = {};
    if (touched.password && !password) e.password = "Password is required.";
    if (touched.confirm && !confirmPassword) e.confirm = "Please confirm your password.";
    if (touched.confirm && confirmPassword && confirmPassword !== password) e.confirm = "Passwords do not match.";
    return e;
  }, [password, confirmPassword, touched]);

  const isFormValid =
    otp.length === 6 && isPasswordStrong && password === confirmPassword && confirmPassword !== "";

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      const res = await authAPI.forgotPassword(email);
      toast.success(res?.detail || "New OTP sent to your email.");
      setOtp("");
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      let msg = "Failed to resend OTP.";
      try { msg = extractErrorMessage(JSON.parse(err.message)); } catch { msg = err.message || msg; }
      toast.error(msg);
    } finally {
      setResending(false);
    }
  }, [email, cooldown, resending]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ password: true, confirm: true });
    if (!isFormValid) {
      if (otp.length !== 6) { toast.error("Please enter the 6-digit OTP."); return; }
      toast.error("Please fix the errors before submitting.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await authAPI.resetPassword(email, otp, password);
      toast.success(res?.detail || "Password reset successfully!");
      navigate("/login");
    } catch (err) {
      let msg = "An error occurred. Please try again.";
      try { msg = extractErrorMessage(JSON.parse(err.message)); } catch { msg = err.message || msg; }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-600 font-semibold text-xs hover:text-slate-900 transition-colors"
        >
          <span className="material-symbols-outlined text-xs select-none">arrow_back</span>
          Use a different email
        </button>
      </div>

      {/* Email (read-only) */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">Email Address</label>
        <input
          type="email"
          value={email}
          readOnly
          className="input-field opacity-60 cursor-not-allowed"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-700 animate-fade-in">
          <span className="material-symbols-outlined text-sm">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* OTP + Resend */}
      <div>
        <div className="flex items-center justify-between mb-2 ml-2 mr-1">
          <label className="block text-xs font-semibold text-slate-600">6-Digit OTP</label>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0 || loading}
            className="text-[11px] font-semibold disabled:cursor-not-allowed transition-colors"
            style={{ color: cooldown > 0 ? "#94a3b8" : "#475569" }}
          >
            {resending ? (
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-500 border-t-transparent animate-spin inline-block" />
                Sending…
              </span>
            ) : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
          </button>
        </div>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="Enter 6-digit OTP"
          disabled={loading}
          className="input-field"
        />
      </div>

      {/* New Password */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">New Password</label>
        <div className="relative flex items-center">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setIsPasswordFocused(true)}
            onBlur={() => { setIsPasswordFocused(false); setTouched((p) => ({ ...p, password: true })); }}
            placeholder="Create a strong password"
            disabled={loading}
            className="input-field"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none"
          >
            <span className="material-symbols-outlined text-sm">
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>

        {/* Live requirements checklist */}
        {showRequirements && (
          <div className="mt-2.5 p-3 bg-[#f8f9fa] rounded-2xl border border-slate-100 animate-fade-in">
            <div className="flex flex-col gap-1.5">
              {passwordRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-center gap-2 transition-colors duration-200 ${rule.met ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"
                    }`}
                >
                  <span className={`material-symbols-outlined text-sm transition-all ${rule.met ? "text-emerald-500" : "text-slate-300"}`}>
                    {rule.met ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span className="text-[11px] select-none">{rule.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {passwordErrors.password && !showRequirements && (
          <div className="mt-1 animate-fade-in">
            <p className="field-error ml-2">{passwordErrors.password}</p>
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">Confirm Password</label>
        <div className="relative flex items-center">
          <input
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, confirm: true }))}
            placeholder="Re-enter new password"
            disabled={loading}
            className="input-field pr-16"
          />
          <div className="absolute right-3.5 flex items-center gap-1.5">
            {touched.confirm && confirmPassword && confirmPassword === password && (
              <span className="material-symbols-outlined text-xs font-bold text-emerald-600 animate-fade-in">check</span>
            )}
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none"
            >
              <span className="material-symbols-outlined text-sm">
                {showConfirm ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>
        {passwordErrors.confirm && (
          <div className="mt-1 animate-fade-in">
            <p className="field-error ml-2">{passwordErrors.confirm}</p>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-center pt-2">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary px-5 py-2 rounded-xl text-sm"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main export — PasswordRecoveryPage (combines both steps)
// ---------------------------------------------------------------------------
export default function PasswordRecoveryPage() {
  const location = useLocation();

  // Start at reset step if email was pre-populated (e.g. from a deep link)
  const [step, setStep] = useState(
    location.state?.email ? "reset" : "request"
  );
  const [email, setEmail] = useState(location.state?.email || "");

  const handleOtpSent = (sentEmail) => {
    setEmail(sentEmail);
    setStep("reset");
  };

  const handleBack = () => {
    setEmail("");
    setStep("request");
  };

  return (
    <PageShell title={step === "request" ? "Forgot Password?" : "Reset Password"}>
      {step === "request" ? (
        <RequestStep onSuccess={handleOtpSent} />
      ) : (
        <ResetStep email={email} onBack={handleBack} />
      )}

      <div className="mt-8 text-center pt-5 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-500">
          Remember your password?{" "}
          <Link to="/login" className="text-slate-900 font-bold hover:underline transition-all">
            Sign In
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
