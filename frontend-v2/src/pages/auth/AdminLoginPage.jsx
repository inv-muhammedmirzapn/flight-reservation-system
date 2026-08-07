import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '@/store/authSlice';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function AdminLoginPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setLocalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim()) {
      const msg = 'Please enter both username and password.';
      setLocalError(msg);
      toast.error(msg);
      return;
    }

    const result = await dispatch(loginUser({ credentials: formData, requireAdmin: true }));

    if (result.meta.requestStatus === 'fulfilled') {
      toast.success('Welcome back, Admin. Access granted.');
      navigate('/admin/overview');
    } else {
      toast.error(result.payload || 'Invalid admin credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/40 via-slate-50 to-yellow-100/20 px-4 py-12 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50">
        
        {/* Brand logo & workspace title above the login form */}
        <div className="flex flex-col items-center text-center mb-6">
          <img src="/updated%20logo.png" alt="Passenger Logo" className="h-11 mb-3 object-contain" />

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("admin.auth.loginTitle", "Admin Login")}
          </h1>
        </div>

        {(localError || error) && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-semibold bg-rose-50 border border-rose-100 text-rose-700 mb-5 animate-fade-in">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{localError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Username Field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-[11px] font-bold tracking-wider text-slate-600 uppercase ml-1">
              {t("admin.auth.usernameLabel", "Admin Username")}
            </label>
            <div className="relative flex items-center">
              <input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                placeholder={t("admin.auth.usernamePlaceholder", "Enter admin username")}
                autoComplete="username"
                className="w-full bg-slate-50 border border-slate-200/80 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 placeholder-slate-400 transition-all outline-none"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[11px] font-bold tracking-wider text-slate-600 uppercase ml-1">
              {t("admin.auth.passwordLabel", "Password")}
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={handleChange}
                placeholder={t("admin.auth.passwordPlaceholder", "Enter password")}
                autoComplete="current-password"
                className="w-full bg-slate-50 border border-slate-200/80 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 placeholder-slate-400 transition-all outline-none pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer select-none flex items-center justify-center p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <span className="material-symbols-outlined text-lg">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-2xl bg-amber-400 hover:bg-amber-500 disabled:opacity-70 disabled:cursor-not-allowed text-slate-900 font-bold text-sm transition-all duration-200 shadow-md shadow-amber-400/20 active:scale-[0.98] mt-3 cursor-pointer"
            type="submit"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full animate-spin border-2 border-black/10 border-t-black" />
                <span>{t("admin.auth.authenticating", "Authenticating...")}</span>
              </>
            ) : (
              t("admin.auth.accessWorkspace", "Access Workspace")
            )}
          </button>
        </form>

        <div className="text-center text-[11px] text-slate-400 mt-8 tracking-wide font-medium">
          {t("footer.copyright", { year: 2026 }).replace("All rights reserved.", "Internal Operations")}
        </div>
      </div>
    </div>
  );
}

