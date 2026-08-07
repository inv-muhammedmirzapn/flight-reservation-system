import { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '@/store/authSlice';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function AdminLoginPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBlur = (e) => {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  };

  // Keystroke validation
  const getFieldError = (name) => {
    if (!touched[name] && !formData[name]) return "";
    if (name === "username" && !formData.username.trim()) {
      return "Username is required";
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

    const result = await dispatch(loginUser({ credentials: formData, requireAdmin: true }));

    if (loginUser.fulfilled.match(result)) {
      toast.success('Welcome back, Admin. Access granted.');
      navigate('/admin/overview');
    } else {
      toast.error(result.payload || 'Invalid admin credentials');
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
        <h2 className="text-xl font-bold text-slate-800">{t("admin.auth.loginTitle", "Admin Login")}</h2>
      </div>

      {/* Container Card */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl p-8 sm:px-10 animate-fade-in plain-card">

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
              {t("admin.auth.usernameLabel", "Admin Username")}
            </label>
            <input
              ref={usernameRef}
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder={t("admin.auth.usernamePlaceholder", "Enter admin username")}
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
              {t("admin.auth.passwordLabel", "Password")}
            </label>
            <div className="relative flex items-center">
              <input
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={t("admin.auth.passwordPlaceholder", "Enter password")}
                className="input-field pr-12"
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
                <>
                  <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin inline-block align-text-bottom mr-2" />
                  {t("admin.auth.authenticating", "Authenticating...")}
                </>
              ) : (
                t("admin.auth.accessWorkspace", "Access Workspace")
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center pt-5 border-t border-slate-100">
          <div className="text-center text-[11px] text-slate-400 tracking-wide font-medium">
            {t("footer.copyright", { year: 2026 }).replace("All rights reserved.", "Internal Operations")}
          </div>
        </div>

      </div>
    </div>
  );
}
