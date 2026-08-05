import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '@/store/authSlice';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function AdminLoginPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [localError, setLocalError] = useState('');

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
      toast.error(result.payload);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/40 via-slate-50 to-yellow-100/20 px-4 py-12 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50">
        {/* Brand logo & workspace badge above the login form */}
        <div className="flex flex-col items-center text-center mb-6">
          <img src="/updated%20logo.png" alt="Passenger Logo" className="h-11 mb-5 object-contain" />

          <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-3.5 py-1 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-[10px] font-bold tracking-wider text-yellow-700 uppercase">Admin Workspace</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 font-sans mt-3">
            {t("admin.auth.loginTitle")}
          </h1>
        </div>

        {(localError || error) && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm bg-red-50 border border-red-100 text-red-700 mb-5">
            <span>{localError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="username"
            name="username"
            label={t("admin.auth.usernameLabel")}
            placeholder={t("admin.auth.usernamePlaceholder")}
            required
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
          />
          <PasswordInput
            id="password"
            name="password"
            label={t("admin.auth.passwordLabel")}
            placeholder={t("admin.auth.passwordPlaceholder")}
            required
            value={formData.password}
            onChange={handleChange}
            autoComplete="current-password"
          />
          <button
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl bg-yellow-400 hover:bg-yellow-500 disabled:opacity-70 disabled:cursor-not-allowed text-gray-900 font-bold text-[15px] transition-all duration-200 shadow-md shadow-yellow-400/20 active:scale-[0.98] mt-2 cursor-pointer"
            type="submit"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full animate-spin border-2 border-black/10 border-t-black" />
                <span>{t("admin.auth.authenticating")}</span>
              </>
            ) : (
              t("admin.auth.accessWorkspace")
            )}
          </button>
        </form>

        <div className="text-center text-[11px] text-gray-400 mt-8 tracking-wide font-medium">
          {t("footer.copyright", { year: 2026 }).replace("All rights reserved.", "Internal Operations")}
        </div>
      </div>
    </div>
  );
}
