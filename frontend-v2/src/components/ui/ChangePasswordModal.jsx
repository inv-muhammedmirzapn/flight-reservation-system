import { useState, useMemo } from "react";
import { profileAPI } from "@/services/profile-service/profileService";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { handleApiError } from "@/utils/errorUtils";
import { PASSWORD_RULES } from "@/utils/validators";

export default function ChangePasswordModal({ isOpen, onClose, hasUsablePassword = true }) {
  const { t } = useTranslation();

  const [pwdData, setPwdData] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [touched, setTouched] = useState({ oldPassword: false, newPassword: false, confirmPassword: false });
  const [pwdSaving, setPwdSaving] = useState(false);

  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  /* ── derived validation ── */
  const passwordRules = PASSWORD_RULES.map((rule) => ({
    ...rule,
    met: rule.test(pwdData.newPassword),
  }));

  if (hasUsablePassword) {
    passwordRules.push({
      id: "different",
      label: "Different from current password",
      met: !!pwdData.oldPassword && pwdData.newPassword !== pwdData.oldPassword,
    });
  }

  const isPasswordStrong = passwordRules.every((rule) => rule.met);

  const showPasswordRequirements =
    isPasswordFocused || (pwdData.newPassword.length > 0 && !isPasswordStrong);

  const errors = useMemo(() => {
    const e = {};
    if (hasUsablePassword && !pwdData.oldPassword && touched.oldPassword)
      e.oldPassword = "Current password is required.";

    if (touched.newPassword) {
      if (!pwdData.newPassword)
        e.newPassword = "New password is required.";
      else if (!isPasswordStrong)
        e.newPassword = "Please fulfill all password requirements";
    }

    if (touched.confirmPassword) {
      if (!pwdData.confirmPassword)
        e.confirmPassword = "Please confirm your new password.";
      else if (pwdData.confirmPassword !== pwdData.newPassword)
        e.confirmPassword = "Passwords do not match.";
    }

    return e;
  }, [pwdData, touched, isPasswordStrong, hasUsablePassword]);

  const isFormValid =
    (hasUsablePassword ? !!pwdData.oldPassword : true) &&
    pwdData.newPassword &&
    pwdData.confirmPassword &&
    Object.keys(errors).length === 0 &&
    isPasswordStrong &&
    pwdData.newPassword === pwdData.confirmPassword;

  if (!isOpen) return null;

  /* ── handlers ── */
  const resetForm = () => {
    setPwdData({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setTouched({ oldPassword: false, newPassword: false, confirmPassword: false });
    setIsPasswordFocused(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPwdData((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    if (name === "newPassword") {
      setIsPasswordFocused(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ oldPassword: true, newPassword: true, confirmPassword: true });
    if (!isFormValid) return;

    setPwdSaving(true);
    try {
      const payload = {
        new_password: pwdData.newPassword,
      };
      if (hasUsablePassword) {
        payload.old_password = pwdData.oldPassword;
      }

      await profileAPI.changePassword(payload);
      toast.success(hasUsablePassword ? "Password changed successfully! " : "Password set successfully! ");
      resetForm();
      setTimeout(onClose, 800);
    } catch (err) {
      handleApiError(err, { fallback: 'Failed to change password.' });
    }
    setPwdSaving(false);
  };

  const isPasswordMatched =
    pwdData.confirmPassword !== "" && pwdData.confirmPassword === pwdData.newPassword;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={handleClose}>
      <div className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800">
            {hasUsablePassword ? t("profile.updatePassword") : "Create a Password"}
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {hasUsablePassword ? t("profile.updatePassDesc") : "Set a password so you can log in with your email."}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* ── Current Password ── */}
          {hasUsablePassword && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2" htmlFor="oldPassword">
                {t("profile.currentPassword")}
              </label>
              <div className="relative flex items-center">
                <input
                  id="oldPassword" name="oldPassword"
                  type={showOldPwd ? "text" : "password"}
                  value={pwdData.oldPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter current password"
                  className="input-field pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPwd(!showOldPwd)}
                  className="absolute right-3.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showOldPwd ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {errors.oldPassword && (
                <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                  <p className="field-error ml-2">{errors.oldPassword}</p>
                </div>
              )}
            </div>
          )}

          {/* ── New Password ── */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2" htmlFor="newPassword">
              {t("profile.newPassword")}
            </label>
            <div className="relative flex items-center">
              <input
                id="newPassword" name="newPassword"
                type={showNewPwd ? "text" : "password"}
                value={pwdData.newPassword}
                onChange={handleChange}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={handleBlur}
                placeholder="Create a strong password"
                className="input-field pr-12"
              />
              <button
                type="button"
                onClick={() => setShowNewPwd(!showNewPwd)}
                className="absolute right-3.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none"
              >
                <span className="material-symbols-outlined text-sm">
                  {showNewPwd ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>

            {/* Collapsible Password Requirements List in Vertical Order */}
            {showPasswordRequirements && (
              <div className="mt-2.5 p-3 bg-[#f8f9fa] rounded-2xl border border-slate-100 animate-fade-in">
                <div className="flex flex-col gap-1.5">
                  {passwordRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`flex items-center gap-2 transition-colors duration-200 ${rule.met ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"
                        }`}
                    >
                      <span
                        className={`material-symbols-outlined text-sm font-bold transition-all ${rule.met ? "text-emerald-500 scale-110" : "text-slate-300"
                          }`}
                      >
                        {rule.met ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      <span className="text-[11px] select-none">{rule.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errors.newPassword && touched.newPassword && !isPasswordStrong && !showPasswordRequirements && (
              <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                <p className="field-error ml-2">{errors.newPassword}</p>
              </div>
            )}
          </div>

          {/* ── Confirm Password ── */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2" htmlFor="confirmPassword">
              {t("profile.confirmNewPassword")}
            </label>
            <div className="relative flex items-center">
              <input
                id="confirmPassword" name="confirmPassword"
                type={showConfirmPwd ? "text" : "password"}
                value={pwdData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Repeat your password"
                className="input-field pr-16"
              />
              <div className="absolute right-3.5 flex items-center gap-1.5">
                {isPasswordMatched && (
                  <span className="material-symbols-outlined text-xs font-bold text-slate-800 animate-fade-in">
                    check
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                  className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showConfirmPwd ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>
            {errors.confirmPassword && (
              <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                <p className="field-error ml-2">{errors.confirmPassword}</p>
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              {t("profile.cancel")}
            </button>
            <button
              type="submit"
              disabled={pwdSaving}
              className="btn-primary px-5 py-2 rounded-xl text-sm"
            >
              {pwdSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin inline-block align-text-bottom mr-2" />
                  {t("profile.updating")}
                </>
              ) : (
                t("profile.saveChanges")
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
