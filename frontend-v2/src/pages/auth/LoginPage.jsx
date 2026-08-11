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

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  // Keystroke validation
  const getFieldError = (name) => {
    if (!touched[name] && !formData[name]) return "";
    if (name === "username" && !formData.username.trim()) {
      return "Username or Email is required";
    }
    if (name === "password" && !formData.password) {
      return "Password is required";
    }
    return "";
  };

  const usernameError = getFieldError("username");
  const passwordError = getFieldError("password");

  const isValid = formData.username.trim() !== "" && formData.password !== "" && !usernameError && !passwordError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ username: true, password: true });

    if (!isValid) {
      if (!formData.username.trim()) {
        usernameRef.current?.focus();
      } else if (!formData.password) {
        passwordRef.current?.focus();
      }
      return;
    }

    try {
      const resultAction = await dispatch(
        loginUser({ credentials: { username: formData.username, password: formData.password } })
      );

      if (loginUser.fulfilled.match(resultAction)) {
        toast.success("Welcome back!");
        navigate("/");
      } else {
        const errorMsg = resultAction.payload || "Invalid username or password";
        toast.error(errorMsg);
      }
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  // Google login
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await dispatch(googleLoginUser({ token: tokenResponse.access_token }));
        if (googleLoginUser.fulfilled.match(res)) {
          const p = res.payload?.profile;
          toast.success(`Welcome back, ${p?.first_name || p?.username || "there"}!`);
          navigate("/");
        } else {
          toast.error(res.payload || "Google login failed");
        }
      } catch (err) {
        toast.error("An unexpected error occurred. Please try again.");
      }
    },
    onError: () => toast.error("Google login failed"),
  });

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-12 mt-12 bg-slate-50/60">

      {/* Sky-themed Soft Ambient Aesthetic Blobs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-sky-200/50 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 -right-20 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-72 h-72 bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 text-center mb-4">
        <h2 className="text-xl font-bold text-slate-800">Sign in to your Account</h2>
      </div>

      {/* Container Card */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl p-8 sm:px-10 animate-fade-in plain-card">

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Username/Email Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
              Username or Email
            </label>
            <input
              ref={usernameRef}
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Enter username or email"
              className="input-field"
            />
            {usernameError && (
              <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                <p className="field-error ml-2">{usernameError}</p>
              </div>
            )}
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-2 mr-1 ml-2">
              <label className="block text-xs font-semibold text-slate-600">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative flex items-center">
              <input
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter password"
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
            {passwordError && (
              <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                <p className="field-error ml-2">{passwordError}</p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-5 py-2 rounded-xl text-sm"
            >
              {loading ? (
                "Signing in..."
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 mt-5 mb-4">
          <span className="flex-1 h-px bg-slate-200" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">or</span>
          <span className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={() => googleLogin()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Footer Link */}
        <div className="mt-8 text-center pt-5 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500">
            Don't have an account?{" "}
            <Link to="/register" className="text-slate-900 font-bold hover:underline transition-all">
              Sign Up
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}