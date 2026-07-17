import { useState } from "react";
import { Key, AlertCircle, CheckCircle2, X, Eye, EyeOff } from "lucide-react";
import { profileAPI } from "@/services/profile-service/profileService";
import { useTranslation } from "react-i18next";

const S = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  card: {
    background: "#fff",
    borderRadius: "1.5rem",
    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    width: "90%",
    maxWidth: "480px",
    padding: "2rem",
    position: "relative",
    fontFamily: "Inter, sans-serif",
  },
  header: {
    marginBottom: "1.5rem",
  },
  title: {
    fontSize: "1.25rem",
    fontWeight: "700",
    color: "#1a1c1d",
    margin: "0 0 0.5rem 0",
  },
  subtitle: {
    fontSize: "0.875rem",
    color: "#8a7f72",
    margin: 0,
  },
  closeBtn: {
    position: "absolute",
    top: "1.5rem",
    right: "1.5rem",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#8a7f72",
    padding: "0.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    transition: "background 0.2s",
  },
  formGroup: {
    marginBottom: "1.25rem",
  },
  label: {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#8a7f72",
    marginBottom: "0.5rem",
  },
  inputWrap: {
    position: "relative",
  },
  inputIcon: {
    position: "absolute",
    left: "1rem",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#b0a896",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "0.75rem 2.5rem 0.75rem 2.75rem",
    fontSize: "0.95rem",
    borderRadius: "0.75rem",
    border: "1.5px solid rgba(0,0,0,0.12)",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  toggleBtn: {
    position: "absolute",
    right: "1rem",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#8a7f72",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  alertBase: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.875rem 1.25rem",
    borderRadius: "0.875rem",
    fontSize: "0.875rem",
    fontWeight: "500",
    border: "1px solid",
    marginBottom: "1.5rem",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    marginTop: "2rem",
  },
  cancelBtn: {
    padding: "0.75rem 1.5rem",
    background: "rgba(0,0,0,0.05)",
    color: "#5a5446",
    fontWeight: "600",
    border: "none",
    borderRadius: "0.75rem",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  saveBtn: {
    padding: "0.75rem 1.5rem",
    background: "#ffd700",
    color: "#1a1c1d",
    fontWeight: "700",
    border: "none",
    borderRadius: "0.75rem",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(255,215,0,0.35)",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
};

export default function ChangePasswordModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const [pwdData, setPwdData] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ type: "", text: "" });

  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  if (!isOpen) return null;

  const handlePwdChange = (e) => setPwdData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPwdMsg({ type: "", text: "" });

    if (pwdData.newPassword !== pwdData.confirmPassword) {
      setPwdMsg({ type: "error", text: "New passwords do not match." });
      return;
    }

    if (pwdData.oldPassword === pwdData.newPassword) {
      setPwdMsg({ type: "error", text: "New password cannot be the same as the current password." });
      return;
    }

    const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\,.\?":{}|<>]).{8,}$/;
    if (!pwdRegex.test(pwdData.newPassword)) {
      setPwdMsg({
        type: "error",
        text: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
      });
      return;
    }

    setPwdSaving(true);
    try {
      await profileAPI.changePassword({
        old_password: pwdData.oldPassword,
        new_password: pwdData.newPassword
      });
      setPwdMsg({ type: "success", text: "Password changed successfully!" });
      setPwdData({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => {
        setPwdMsg({ type: "", text: "" });
        onClose();
      }, 2000);
    } catch (err) {
      let errorMessage = "Failed to change password.";
      try {
        const errorData = JSON.parse(err.message);
        if (errorData.old_password) errorMessage = errorData.old_password[0];
        else if (errorData.new_password) errorMessage = errorData.new_password[0];
        else if (errorData.detail) errorMessage = errorData.detail;
      } catch (e) {
        errorMessage = err.message || errorMessage;
      }
      setPwdMsg({ type: "error", text: errorMessage });
    }
    setPwdSaving(false);
  };

  const isFormValid = pwdData.oldPassword && pwdData.newPassword && pwdData.confirmPassword;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.card} onClick={(e) => e.stopPropagation()}>
        <button style={S.closeBtn} onClick={onClose} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.05)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <X size={20} />
        </button>

        <div style={S.header}>
          <h2 style={S.title}>{t("profile.updatePassword")}</h2>
          <p style={S.subtitle}>{t("profile.updatePassDesc")}</p>
        </div>

        {pwdMsg.text && (
          <div style={{
            ...S.alertBase,
            background: pwdMsg.type === "error" ? "#fff2f2" : "#f0fdf4",
            color: pwdMsg.type === "error" ? "#b91c1c" : "#15803d",
            borderColor: pwdMsg.type === "error" ? "#fecaca" : "#bbf7d0",
          }}>
            {pwdMsg.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            {pwdMsg.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={S.formGroup}>
            <label style={S.label} htmlFor="oldPassword">{t("profile.currentPassword")}</label>
            <div style={S.inputWrap}>
              <span style={S.inputIcon}><Key size={16} /></span>
              <input
                id="oldPassword"
                name="oldPassword"
                type={showOldPwd ? "text" : "password"}
                value={pwdData.oldPassword}
                onChange={handlePwdChange}
                style={S.input}
                placeholder={t("profile.enterCurrent")}
                onFocus={(e) => { e.target.style.borderColor = "#ffd700"; e.target.style.boxShadow = "0 0 0 3px rgba(255,215,0,0.18)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(0,0,0,0.12)"; e.target.style.boxShadow = "none"; }}
              />
              <button 
                type="button" 
                style={S.toggleBtn} 
                onClick={() => setShowOldPwd(!showOldPwd)}
                onMouseEnter={(e) => e.currentTarget.style.color = "#1a1c1d"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#8a7f72"}
              >
                {showOldPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={S.formGroup}>
            <label style={S.label} htmlFor="newPassword">{t("profile.newPassword")}</label>
            <div style={S.inputWrap}>
              <span style={S.inputIcon}><Key size={16} /></span>
              <input
                id="newPassword"
                name="newPassword"
                type={showNewPwd ? "text" : "password"}
                value={pwdData.newPassword}
                onChange={handlePwdChange}
                style={S.input}
                placeholder={t("profile.enterNew")}
                onFocus={(e) => { e.target.style.borderColor = "#ffd700"; e.target.style.boxShadow = "0 0 0 3px rgba(255,215,0,0.18)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(0,0,0,0.12)"; e.target.style.boxShadow = "none"; }}
              />
              <button 
                type="button" 
                style={S.toggleBtn} 
                onClick={() => setShowNewPwd(!showNewPwd)}
                onMouseEnter={(e) => e.currentTarget.style.color = "#1a1c1d"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#8a7f72"}
              >
                {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={S.formGroup}>
            <label style={S.label} htmlFor="confirmPassword">{t("profile.confirmNewPassword")}</label>
            <div style={S.inputWrap}>
              <span style={S.inputIcon}><Key size={16} /></span>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPwd ? "text" : "password"}
                value={pwdData.confirmPassword}
                onChange={handlePwdChange}
                style={S.input}
                placeholder={t("profile.confirmNew")}
                onFocus={(e) => { e.target.style.borderColor = "#ffd700"; e.target.style.boxShadow = "0 0 0 3px rgba(255,215,0,0.18)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(0,0,0,0.12)"; e.target.style.boxShadow = "none"; }}
              />
              <button 
                type="button" 
                style={S.toggleBtn} 
                onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                onMouseEnter={(e) => e.currentTarget.style.color = "#1a1c1d"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#8a7f72"}
              >
                {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={S.actions}>
            <button
              type="button"
              onClick={onClose}
              style={S.cancelBtn}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.08)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.05)"}
            >
              {t("profile.cancel")}
            </button>
            <button
              type="submit"
              disabled={pwdSaving || !isFormValid}
              style={{ ...S.saveBtn, opacity: (pwdSaving || !isFormValid) ? 0.7 : 1 }}
              onMouseEnter={(e) => { if (!pwdSaving && isFormValid) e.currentTarget.style.background = "#ffe333"; }}
              onMouseLeave={(e) => { if (!pwdSaving && isFormValid) e.currentTarget.style.background = "#ffd700"; }}
            >
              {pwdSaving ? (
                <>
                  <span style={{ width: "16px", height: "16px", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#1a1c1d", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
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
