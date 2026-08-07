import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "@/services/auth-service/authService";
import { extractErrorMessage } from "@/services/apiClient";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    setLocalError("");
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(email.trim());
      toast.success(res?.detail || "OTP sent! Check your email.");
      navigate("/reset-password", { state: { email: email.trim() } });
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/40 via-slate-50 to-yellow-100/20 px-4 pt-[88px] pb-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50 animate-fade-in">

        {/* Heading */}
        <div className="text-center mb-7">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Forgot password?</h1>
          <p className="text-sm text-slate-500 mt-1">Enter your email to receive a 6-digit OTP.</p>
        </div>

        {/* Inline error */}
        {localError && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-semibold bg-rose-50 border border-rose-100 text-rose-700 mb-5 animate-fade-in">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{localError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[11px] font-bold tracking-wider text-slate-600 uppercase ml-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
              autoComplete="email"
              className="w-full bg-slate-50 border border-slate-200/80 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 placeholder-slate-400 transition-all outline-none disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-2xl bg-amber-400 hover:bg-amber-500 disabled:opacity-70 disabled:cursor-not-allowed text-slate-900 font-bold text-sm transition-all duration-200 shadow-md shadow-amber-400/20 active:scale-[0.98] mt-1 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full animate-spin border-2 border-black/10 border-t-black" />
                <span>Sending OTP…</span>
              </>
            ) : (
              "Send OTP"
            )}
          </button>
        </form>

        {/* Back to login */}
        <p className="text-center text-xs text-slate-500 mt-7">
          Remember your password?{" "}
          <Link to="/login" className="text-amber-700 font-semibold hover:underline">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  );
}
