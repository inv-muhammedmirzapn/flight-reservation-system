import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loginUser, logout, googleLoginUser } from '@/store/authSlice';
import { useGoogleLogin } from '@react-oauth/google';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import toast from 'react-hot-toast';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function LoginForm() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated, profile } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [localError, setLocalError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setLocalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await dispatch(loginUser({ credentials: formData, requireCustomer: true }));
    if (res.meta.requestStatus === 'fulfilled') {
      const p = res.payload.profile;
      const name = p?.first_name || p?.username || 'back';
      toast.success(t('auth.welcomeBackName', { name }));
      navigate('/flights');
    } else {
      toast.error(res.payload);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await dispatch(googleLoginUser({ token: tokenResponse.access_token, requireCustomer: true }));
        if (res.meta.requestStatus === 'fulfilled') {
          const p = res.payload.profile;
          const name = p?.first_name || p?.username || 'back';
          toast.success(t('auth.welcomeBackName', { name }));
          navigate('/flights');
        } else {
          toast.error(res.payload);
        }
      } catch (err) {
        toast.error(t('auth.googleLoginFailed'));
      }
    },
    onError: () => toast.error(t('auth.googleLoginFailed'))
  });

  const handleGoogleLogin = () => {
    googleLogin();
  };

  return (
    <>
      <div className="form-header">
        <div className="form-icon">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="form-title">{t("auth.welcomeBack")}</h1>
        <p className="form-subtitle">{t("auth.signInSubtitle")}</p>
      </div>


      <form onSubmit={handleSubmit} className="form-fields">
        <Input
          id="username"
          label={t("auth.usernameOrEmail")}
          placeholder={t("auth.placeholders.userEmail")}
          required
          value={formData.username}
          onChange={handleChange}
          autoComplete="username"
          disabled={loading}
        />
        <PasswordInput
          id="password"
          label={t("auth.password")}
          placeholder={t("auth.placeholders.passEnter")}
          required
          value={formData.password}
          onChange={handleChange}
          autoComplete="current-password"
          disabled={loading}
        />
        <div style={{ textAlign: 'right', marginTop: '-0.25rem', marginBottom: '0.75rem' }}>
          <Link to="/forgot-password" style={{ fontSize: '0.85rem', color: '#705d00', fontWeight: '600', textDecoration: 'none' }}>
            {t("auth.forgotPassword")}
          </Link>
        </div>
        <button disabled={loading} className="auth-btn" type="submit">
          {loading ? <><div className="spinner" /> {t("auth.signingIn")}</> : t("auth.signIn")}
        </button>
      </form>

      <div className="or-divider">
        <span className="or-divider-line" />
        <span className="or-divider-text">{t("auth.orContinueWith")}</span>
        <span className="or-divider-line" />
      </div>

      <button type="button" className="google-btn" onClick={handleGoogleLogin}>
        <GoogleIcon />
        {t("auth.continueWithGoogle")}
      </button>


    </>
  );
}