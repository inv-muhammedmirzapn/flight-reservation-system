import { useState, useMemo } from "react";
import { Key, X, Eye, EyeOff, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { profileAPI } from "@/services/profile-service/profileService";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

/* ─── helpers ─────────────────────────────────────────────── */

const PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\,.?":{}|<>]).{8,}$/;

/** Returns a 0-4 strength score for the given password */
function calcStrength(pwd) {
  let score = 0;
  if (!pwd) return score;
  if (pwd.length >= 8)              score++;
  if (/[A-Z]/.test(pwd))           score++;
  if (/[a-z]/.test(pwd))           score++;
  if (/\d/.test(pwd))              score++;
  if (/[!@#$%^&*()\,.?":{}|<>]/.test(pwd)) score++;
  return Math.min(score, 4);
}

const STRENGTH_META = [
  { label: "Too weak",  color: "#ef4444", bg: "#fef2f2" },
  { label: "Weak",      color: "#f97316", bg: "#fff7ed" },
  { label: "Fair",      color: "#eab308", bg: "#fefce8" },
  { label: "Good",      color: "#22c55e", bg: "#f0fdf4" },
  { label: "Strong",    color: "#16a34a", bg: "#dcfce7" },
];

/* ─── inline styles ───────────────────────────────────────── */

const S = {
  overlay: {
    position: "fixed", top: 0, left: 0,
    width: "100vw", height: "100vh",
    backgroundColor: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000,
  },
  card: {
    background: "#fff", borderRadius: "1.5rem",
    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    width: "90%", maxWidth: "480px", padding: "2rem",
    position: "relative", fontFamily: "Inter, sans-serif",
  },
  closeBtn: {
    position: "absolute", top: "1.5rem", right: "1.5rem",
    background: "transparent", border: "none", cursor: "pointer",
    color: "#8a7f72", padding: "0.5rem",
    display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: "50%", transition: "background 0.2s",
  },
  header: { marginBottom: "1.5rem" },
  title: { fontSize: "1.25rem", fontWeight: "700", color: "#1a1c1d", margin: "0 0 0.5rem 0" },
  subtitle: { fontSize: "0.875rem", color: "#8a7f72", margin: 0 },
  formGroup: { marginBottom: "1.25rem" },
  label: {
    display: "block", fontSize: "0.75rem", fontWeight: "700",
    textTransform: "uppercase", letterSpacing: "0.06em",
    color: "#8a7f72", marginBottom: "0.5rem",
  },
  inputWrap: { position: "relative" },
  inputIcon: {
    position: "absolute", left: "1rem", top: "50%",
    transform: "translateY(-50%)", color: "#b0a896", pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "0.75rem 2.5rem 0.75rem 2.75rem",
    fontSize: "0.95rem", borderRadius: "0.75rem",
    border: "1.5px solid rgba(0,0,0,0.12)", outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
  },
  toggleBtn: {
    position: "absolute", right: "1rem", top: "50%",
    transform: "translateY(-50%)",
    background: "transparent", border: "none", cursor: "pointer",
    color: "#8a7f72", display: "flex", alignItems: "center", padding: 0,
  },
  /* inline error / hint below a field */
  fieldMsg: {
    display: "flex", alignItems: "center", gap: "0.35rem",
    marginTop: "0.4rem", fontSize: "0.78rem", fontWeight: "500",
  },
  actions: {
    display: "flex", justifyContent: "flex-end",
    gap: "0.75rem", marginTop: "2rem",
  },
  cancelBtn: {
    padding: "0.75rem 1.5rem",
    background: "rgba(0,0,0,0.05)", color: "#5a5446",
    fontWeight: "600", border: "none", borderRadius: "0.75rem",
    cursor: "pointer", transition: "background 0.2s",
  },
  saveBtn: {
    padding: "0.75rem 1.5rem",
    background: "#ffd700", color: "#1a1c1d",
    fontWeight: "700", border: "none", borderRadius: "0.75rem",
    cursor: "pointer", boxShadow: "0 4px 12px rgba(255,215,0,0.35)",
    transition: "all 0.2s",
    display: "flex", alignItems: "center", gap: "0.5rem",
  },
};

/* ─── component ───────────────────────────────────────────── */

export default function ChangePasswordModal({ isOpen, onClose, hasUsablePassword = true }) {
  const { t } = useTranslation();

  const [pwdData, setPwdData] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [touched, setTouched]  = useState({ oldPassword: false, newPassword: false, confirmPassword: false });
  const [pwdSaving, setPwdSaving] = useState(false);

  const [showOldPwd,     setShowOldPwd]     = useState(false);
  const [showNewPwd,     setShowNewPwd]     = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  /* ── derived validation ── */
  const strength = useMemo(() => calcStrength(pwdData.newPassword), [pwdData.newPassword]);

  const errors = useMemo(() => {
    const e = {};
    if (hasUsablePassword && !pwdData.oldPassword && touched.oldPassword)
      e.oldPassword = "Current password is required.";

    if (touched.newPassword) {
      if (!pwdData.newPassword)
        e.newPassword = "New password is required.";
      else if (pwdData.newPassword.length < 8)
        e.newPassword = "Password must be at least 8 characters.";
      else if (!PWD_REGEX.test(pwdData.newPassword))
        e.newPassword = "Must include uppercase, lowercase, number & special character.";
      else if (hasUsablePassword && pwdData.oldPassword && pwdData.newPassword === pwdData.oldPassword)
        e.newPassword = "New password cannot be the same as the current password.";
    }

    if (touched.confirmPassword) {
      if (!pwdData.confirmPassword)
        e.confirmPassword = "Please confirm your new password.";
      else if (pwdData.confirmPassword !== pwdData.newPassword)
        e.confirmPassword = "Passwords do not match.";
    }

    return e;
  }, [pwdData, touched]);

  const isFormValid =
    (hasUsablePassword ? !!pwdData.oldPassword : true) &&
    pwdData.newPassword &&
    pwdData.confirmPassword &&
    Object.keys(errors).length === 0 &&
    PWD_REGEX.test(pwdData.newPassword) &&
    pwdData.newPassword === pwdData.confirmPassword;

  if (!isOpen) return null;

  /* ── handlers ── */
  const resetForm = () => {
    setPwdData({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setTouched({ oldPassword: false, newPassword: false, confirmPassword: false });
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
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // mark all touched before final submit check
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
      toast.success(hasUsablePassword ? "Password changed successfully! 🔒" : "Password set successfully! 🔒");
      resetForm();
      setTimeout(onClose, 800);
    } catch (err) {
      let errorMessage = "Failed to change password.";
      try {
        const errorData = JSON.parse(err.message);
        if (errorData.old_password)  errorMessage = errorData.old_password[0];
        else if (errorData.new_password) errorMessage = errorData.new_password[0];
        else if (errorData.detail)   errorMessage = errorData.detail;
      } catch {
        errorMessage = err.message || errorMessage;
      }
      toast.error(errorMessage);
    }
    setPwdSaving(false);
  };

  /* ── password strength bar ── */
  const renderStrengthBar = () => {
    if (!pwdData.newPassword) return null;
    const meta = STRENGTH_META[strength] || STRENGTH_META[0];
    return (
      <div style={{ marginTop: "0.5rem" }}>
        <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                flex: 1, height: "4px", borderRadius: "2px",
                background: i <= strength ? meta.color : "rgba(0,0,0,0.1)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: "0.75rem", color: meta.color, fontWeight: "600" }}>
          {meta.label}
        </span>
      </div>
    );
  };

  /* ── password requirements checklist ── */
  const renderRequirements = () => {
    if (!touched.newPassword || !pwdData.newPassword) return null;
    const checks = [
      { label: "At least 8 characters",              ok: pwdData.newPassword.length >= 8 },
      { label: "Uppercase letter (A-Z)",              ok: /[A-Z]/.test(pwdData.newPassword) },
      { label: "Lowercase letter (a-z)",              ok: /[a-z]/.test(pwdData.newPassword) },
      { label: "Number (0-9)",                        ok: /\d/.test(pwdData.newPassword) },
      { label: "Special character (!@#$%…)",          ok: /[!@#$%^&*()\,.?":{}|<>]/.test(pwdData.newPassword) },
    ];
    if (hasUsablePassword) {
      checks.push({ label: "Different from current password", ok: !!pwdData.oldPassword && pwdData.newPassword !== pwdData.oldPassword });
    }
    return (
      <ul style={{ margin: "0.5rem 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        {checks.map(({ label, ok }) => (
          <li key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: ok ? "#16a34a" : "#6b7280" }}>
            {ok
              ? <CheckCircle2 size={13} color="#16a34a" />
              : <XCircle     size={13} color="#d1d5db" />}
            {label}
          </li>
        ))}
      </ul>
    );
  };

  /* ── helper to render a field-level message ── */
  const FieldMsg = ({ error, success }) => {
    if (error)
      return (
        <div style={{ ...S.fieldMsg, color: "#b91c1c" }}>
          <AlertTriangle size={13} /> {error}
        </div>
      );
    if (success)
      return (
        <div style={{ ...S.fieldMsg, color: "#16a34a" }}>
          <CheckCircle2 size={13} /> {success}
        </div>
      );
    return null;
  };

  /* ─────────────────────────────────────────────────────────── */
  const inputBorder = (fieldName, skipValidColor = false) => {
    if (!touched[fieldName]) return "rgba(0,0,0,0.12)";
    if (skipValidColor) return errors[fieldName] ? "#ef4444" : "rgba(0,0,0,0.12)";
    return errors[fieldName] ? "#ef4444" : "#22c55e";
  };

  return (
    <div style={S.overlay} onClick={handleClose}>
      <div style={S.card} onClick={(e) => e.stopPropagation()}>

        {/* close */}
        <button
          style={S.closeBtn} onClick={handleClose}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <X size={20} />
        </button>

        {/* header */}
        <div style={S.header}>
          <h2 style={S.title}>{hasUsablePassword ? t("profile.updatePassword") : "Create a Password"}</h2>
          <p style={S.subtitle}>{hasUsablePassword ? t("profile.updatePassDesc") : "Set a password so you can log in with your email."}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {/* ── Current Password ── */}
          {hasUsablePassword && (
            <div style={S.formGroup}>
              <label style={S.label} htmlFor="oldPassword">{t("profile.currentPassword")}</label>
              <div style={S.inputWrap}>
                <span style={S.inputIcon}><Key size={16} /></span>
                <input
                  id="oldPassword" name="oldPassword"
                  type={showOldPwd ? "text" : "password"}
                  value={pwdData.oldPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  style={{ ...S.input, borderColor: "rgba(0,0,0,0.12)" }}
                  placeholder={t("profile.enterCurrent")}
                />
                <button type="button" style={S.toggleBtn} onClick={() => setShowOldPwd(!showOldPwd)}>
                  {showOldPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <FieldMsg error={errors.oldPassword} />
            </div>
          )}

          {/* ── New Password ── */}
          <div style={S.formGroup}>
            <label style={S.label} htmlFor="newPassword">{t("profile.newPassword")}</label>
            <div style={S.inputWrap}>
              <span style={S.inputIcon}><Key size={16} /></span>
              <input
                id="newPassword" name="newPassword"
                type={showNewPwd ? "text" : "password"}
                value={pwdData.newPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{ ...S.input, borderColor: inputBorder("newPassword") }}
                placeholder={t("profile.enterNew")}
              />
              <button type="button" style={S.toggleBtn} onClick={() => setShowNewPwd(!showNewPwd)}>
                {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {renderStrengthBar()}
            <FieldMsg error={errors.newPassword} />
          </div>

          {/* ── Confirm Password ── */}
          <div style={S.formGroup}>
            <label style={S.label} htmlFor="confirmPassword">{t("profile.confirmNewPassword")}</label>
            <div style={S.inputWrap}>
              <span style={S.inputIcon}><Key size={16} /></span>
              <input
                id="confirmPassword" name="confirmPassword"
                type={showConfirmPwd ? "text" : "password"}
                value={pwdData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{ ...S.input, borderColor: inputBorder("confirmPassword") }}
                placeholder={t("profile.confirmNew")}
              />
              <button type="button" style={S.toggleBtn} onClick={() => setShowConfirmPwd(!showConfirmPwd)}>
                {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <FieldMsg
              error={errors.confirmPassword}
              success={
                touched.confirmPassword &&
                pwdData.confirmPassword &&
                !errors.confirmPassword
                  ? "Passwords match ✓"
                  : undefined
              }
            />
          </div>

          {/* ── Actions ── */}
          <div style={S.actions}>
            <button
              type="button" onClick={handleClose} style={S.cancelBtn}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
            >
              {t("profile.cancel")}
            </button>
            <button
              type="submit"
              disabled={pwdSaving}
              style={{ ...S.saveBtn, opacity: pwdSaving ? 0.7 : 1 }}
              onMouseEnter={(e) => { if (!pwdSaving) e.currentTarget.style.background = "#ffe333"; }}
              onMouseLeave={(e) => { if (!pwdSaving) e.currentTarget.style.background = "#ffd700"; }}
            >
              {pwdSaving ? (
                <>
                  <span style={{
                    width: "16px", height: "16px",
                    border: "2px solid rgba(0,0,0,0.2)",
                    borderTopColor: "#1a1c1d",
                    borderRadius: "50%", display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  {t("profile.updating")}
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
