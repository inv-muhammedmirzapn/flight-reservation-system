import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginUser, googleLoginUser } from "@/store/authSlice";
import { useGoogleLogin } from "@react-oauth/google";
import toast from "react-hot-toast";

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({ username: "", password: "" });
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e) => {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  };

  const getFieldError = (name) => {
    if (!touched[name] && !formData[name]) return "";
    if (name === "username" && !formData.username.trim()) return "Username or email is required";
    if (name === "password" && !formData.password) return "Password is required";
    return "";
  };

  const usernameError = getFieldError("username");
  const passwordError = getFieldError("password");
  const isValid = formData.username.trim() && formData.password && !usernameError && !passwordError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ username: true, password: true });
    if (!isValid) {
      (!formData.username.trim() ? usernameRef : passwordRef).current?.focus();
      return;
    }
    const res = await dispatch(loginUser({ credentials: formData, requireCustomer: true }));
    if (loginUser.fulfilled.match(res)) {
      toast.success("Welcome back!");
      navigate("/");
    } else {
      toast.error(res.payload || "Invalid username or password");
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const res = await dispatch(googleLoginUser({ token: tokenResponse.access_token, requireCustomer: true }));
      if (googleLoginUser.fulfilled.match(res)) {
        const p = res.payload?.profile;
        toast.success(`Welcome back, ${p?.first_name || p?.username || "there"}!`);
        navigate("/");
      } else {
        toast.error(res.payload || "Google login failed");
      }
    },
    onError: () => toast.error("Google login failed"),
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-[88px] pb-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50 animate-fade-in">

        {/* Heading */}
        <div className="text-center mb-7">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-[11px] font-bold tracking-wider text-slate-600 uppercase ml-1">
              Username or Email
            </label>
            <input
              ref={usernameRef}
              id="username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Enter your username or email"
              autoComplete="username"
              className={`w-full bg-slate-50 border focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 placeholder-slate-400 transition-all outline-none ${
                usernameError ? "border-rose-300 bg-rose-50/30" : "border-slate-200/80"
              }`}
            />
            {usernameError && (
              <p className="text-[11px] text-rose-500 font-medium ml-1 animate-fade-in">{usernameError}</p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[11px] font-bold tracking-wider text-slate-600 uppercase ml-1">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                ref={passwordRef}
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter your password"
                autoComplete="current-password"
                className={`w-full bg-slate-50 border focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20 rounded-2xl px-4 py-3 pr-11 text-sm font-medium text-slate-800 placeholder-slate-400 transition-all outline-none ${
                  passwordError ? "border-rose-300 bg-rose-50/30" : "border-slate-200/80"
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer select-none flex items-center justify-center p-1"
              >
                <span className="material-symbols-outlined text-lg">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            {passwordError && (
              <p className="text-[11px] text-rose-500 font-medium ml-1 animate-fade-in">{passwordError}</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end -mt-1 mb-1">
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-amber-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-2xl bg-amber-400 hover:bg-amber-500 disabled:opacity-70 disabled:cursor-not-allowed text-slate-900 font-bold text-sm transition-all duration-200 shadow-md shadow-amber-400/20 active:scale-[0.98] mt-1 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full animate-spin border-2 border-black/10 border-t-black" />
                <span>Signing in…</span>
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 mt-5 mb-4">
          <span className="flex-1 h-px bg-slate-100" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">or</span>
          <span className="flex-1 h-px bg-slate-100" />
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={() => googleLogin()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-amber-700 font-semibold hover:underline">
            Sign up free
          </Link>
        </p>

      </div>
    </div>
  );
}
