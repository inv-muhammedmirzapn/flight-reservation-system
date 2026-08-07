import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { authAPI } from "@/services/auth-service/authService";
import { extractErrorMessage } from "@/services/apiClient";
import toast from "react-hot-toast";

const PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\,.?":{}|<>]).{8,}$/;

const PASSWORD_RULES = [
  { id: "length",    label: "At least 8 characters",              test: (p) => p.length >= 8 },
  { id: "uppercase", label: "At least 1 uppercase letter (A-Z)",  test: (p) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "At least 1 lowercase letter (a-z)",  test: (p) => /[a-z]/.test(p) },
  { id: "digit",     label: "At least 1 digit (0-9)",             test: (p) => /[0-9]/.test(p) },
  { id: "special",   label: "At least 1 special character (!@#$%...)", test: (p) => /[!@#$%^&*()\.,'":{}|<>]/.test(p) },
];

function calcStrength(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[!@#$%^&*()\,.?":{}|<>]/.test(pwd)) score++;
  return Math.min(score, 4);
}

const STRENGTH_META = [
  { label: "Too weak", color: "#ef4444" },
  { label: "Weak",     color: "#f97316" },
  { label: "Fair",     color: "#eab308" },
  { label: "Good",     color: "#22c55e" },
  { label: "Strong",   color: "#16a34a" },
];

const RESEND_COOLDOWN = 60; // seconds

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialEmail = location.state?.email || "";
  const [email, setEmail]                     = useState(initialEmail);
  const [otp, setOtp]                         = useState("");
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [resending, setResending]             = useState(false);
  const [cooldown, setCooldown]               = useState(0);
  const [localError, setLocalError]           = useState("");
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [touched, setTouched]                 = useState({ password: false, confirmPassword: false });

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const passwordRules = PASSWORD_RULES.map((r) => ({ ...r, met: r.test(password) }));
  const isPasswordStrong = passwordRules.every((r) => r.met);
  const showPasswordRequirements = isPasswordFocused || (password.length > 0 && !isPasswordStrong);

  const strength = useMemo(() => calcStrength(password), [password]);

  const errors = useMemo(() => {
    const e = {};
    if (touched.password) {
      if (!password) e.password = "New password is required.";
      else if (password.length < 8) e.password = "At least 8 characters required.";
      else if (!PWD_REGEX.test(password)) e.password = "Must include uppercase, lowercase, number & special character.";
    }
    if (touched.confirmPassword) {
      if (!confirmPassword) e.confirmPassword = "Please confirm your password.";
      else if (confirmPassword !== password) e.confirmPassword = "Passwords do not match.";
    }
    return e;
  }, [password, confirmPassword, touched]);

  const isFormValid =
    email && otp.length === 6 && password && confirmPassword &&
    Object.keys(errors).length === 0 &&
    PWD_REGEX.test(password) && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ password: true, confirmPassword: true });
    if (!email) { toast.error("Email is required."); return; }
    if (otp.length !== 6) { toast.error("Please enter the 6-digit OTP."); return; }
    if (!isFormValid) { toast.error("Please fix the errors before submitting."); return; }

    setLocalError("");
    setLoading(true);
    try {
      const res = await authAPI.resetPassword(email, otp, password);
      toast.success(res?.detail || "Password reset successfully!");
      navigate("/login");
    } catch (err) {
      let errMsg = "An error occurred. Please try again.";
      try {
        const parsed = JSON.parse(err.message);
        errMsg = extractErrorMessage(parsed);
      } catch {
        errMsg = err.message || errMsg;
      }
      setLocalError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = useCallback(async () => {
    if (!email) { toast.error("Email address is required to resend OTP."); return; }
    if (cooldown > 0) return;

    setResending(true);
    try {
      const res = await authAPI.forgotPassword(email.trim());
      toast.success(res?.detail || "A new OTP has been sent to your email.");
      setOtp("");
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      let errMsg = "Failed to resend OTP. Please try again.";
      try {
        const parsed = JSON.parse(err.message);
        errMsg = extractErrorMessage(parsed);
      } catch {
        errMsg = err.message || errMsg;
      }
      toast.error(errMsg);
    } finally {
      setResending(false);
    }
  }, [email, cooldown]);

  const inputClass = (hasError) =>
    `w-full bg-slate-50 border ${hasError ? "border-rose-300 bg-rose-50/30" : "border-slate-200/80"} focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 placeholder-slate-400 transition-all outline-none disabled:opacity-60`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/40 via-slate-50 to-yellow-100/20 px-4 pt-[88px] pb-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50 animate-fade-in">

        {/* Heading */}
        <div className="text-center mb-7">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset password</h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter the OTP sent to your email and choose a new password.
          </p>
        </div>

        {/* Inline error */}
        {localError && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-semibold bg-rose-50 border border-rose-100 text-rose-700 mb-5 animate-fade-in">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{localError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase ml-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading || !!initialEmail}
              autoComplete="email"
              className={inputClass(false) + (initialEmail ? " opacity-60 cursor-not-allowed" : "")}
            />
          </div>

          {/* OTP + Resend */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between ml-1 mr-1">
              <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                6-Digit OTP
              </label>
              {/* Resend button */}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending || cooldown > 0 || loading}
                className="text-[11px] font-semibold disabled:cursor-not-allowed transition-colors"
                style={{ color: cooldown > 0 ? "#94a3b8" : "#b45309" }}
              >
                {resending ? (
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full border border-amber-600 border-t-transparent animate-spin inline-block" />
                    Sending…
                  </span>
                ) : cooldown > 0 ? (
                  `Resend in ${cooldown}s`
                ) : (
                  "Resend OTP"
                )}
              </button>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              disabled={loading}
              className={inputClass(false)}
            />
          </div>

          {/* New Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase ml-1">
              New Password
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => { setTouched((p) => ({ ...p, password: true })); setIsPasswordFocused(false); }}
              onFocus={() => setIsPasswordFocused(true)}
                placeholder="Enter new password"
                disabled={loading}
                className={inputClass(!!errors.password) + " pr-11"}
              />
              <button
                type="button" tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer flex items-center p-1"
              >
                <span className="material-symbols-outlined text-lg">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>

            {/* Password requirements checklist */}
            {showPasswordRequirements && (
              <div className="mt-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-fade-in">
                <div className="flex flex-col gap-1.5">
                  {passwordRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`flex items-center gap-2 transition-colors duration-200 ${
                        rule.met ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"
                      }`}
                    >
                      <span className={`material-symbols-outlined text-sm transition-all ${
                        rule.met ? "text-emerald-500" : "text-slate-300"
                      }`}>
                        {rule.met ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      <span className="text-[11px] select-none">{rule.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {errors.password && touched.password && !showPasswordRequirements && (
              <p className="text-[11px] text-rose-500 font-medium ml-1">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase ml-1">
              Confirm Password
            </label>
            <div className="relative flex items-center">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, confirmPassword: true }))}
                placeholder="Re-enter new password"
                disabled={loading}
                className={inputClass(!!errors.confirmPassword) + " pr-11"}
              />
              <button
                type="button" tabIndex={-1}
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer flex items-center p-1"
              >
                <span className="material-symbols-outlined text-lg">
                  {showConfirm ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-[11px] text-rose-500 font-medium ml-1">{errors.confirmPassword}</p>
            )}
            {touched.confirmPassword && confirmPassword && !errors.confirmPassword && (
              <p className="text-[11px] text-emerald-600 font-semibold ml-1 flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>
                Passwords match
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-2xl bg-amber-400 hover:bg-amber-500 disabled:opacity-70 disabled:cursor-not-allowed text-slate-900 font-bold text-sm transition-all duration-200 shadow-md shadow-amber-400/20 active:scale-[0.98] mt-1 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full animate-spin border-2 border-black/10 border-t-black" />
                <span>Resetting…</span>
              </>
            ) : (
              "Reset Password"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-7">
          Back to{" "}
          <Link to="/login" className="text-amber-700 font-semibold hover:underline">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  );
}
