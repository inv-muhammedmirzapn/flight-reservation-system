import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginUser } from "@/store/authSlice";
import toast from "react-hot-toast";

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
        loginUser({
          credentials: { username: formData.username, password: formData.password },
          requireCustomer: true,
        })
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
            <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
              Password
            </label>
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
