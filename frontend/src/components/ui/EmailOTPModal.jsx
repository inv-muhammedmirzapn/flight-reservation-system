import { useState, useEffect, useRef } from "react";
import { Mail, X, ArrowRight, RefreshCw, CheckCircle2, AlertTriangle, Shield } from "lucide-react";
import { profileAPI } from "@/services/profile-service/profileService";
import toast from "react-hot-toast";

/* ─── styles ──────────────────────────────────────────────── */
const S = {
  overlay: {
    position: "fixed", top: 0, left: 0,
    width: "100vw", height: "100vh",
    backgroundColor: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1100,
  },
  card: {
    background: "#fff", borderRadius: "1.5rem",
    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    width: "90%", maxWidth: "440px", padding: "2rem",
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
  stepBadge: {
    display: "inline-flex", alignItems: "center", gap: "0.4rem",
    background: "#ffd700", color: "#1a1c1d",
    fontSize: "0.7rem", fontWeight: "800",
    padding: "0.25rem 0.75rem", borderRadius: "99px",
    letterSpacing: "0.05em", textTransform: "uppercase",
    marginBottom: "0.75rem",
  },
  title: { fontSize: "1.2rem", fontWeight: "700", color: "#1a1c1d", margin: "0 0 0.4rem 0" },
  subtitle: { fontSize: "0.875rem", color: "#8a7f72", margin: 0, lineHeight: 1.5 },
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
    padding: "0.75rem 1rem 0.75rem 2.75rem",
    fontSize: "0.95rem", borderRadius: "0.75rem",
    border: "1.5px solid rgba(0,0,0,0.12)", outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box", fontFamily: "Inter, sans-serif",
  },
  /* OTP boxes */
  otpRow: {
    display: "flex", gap: "0.5rem", justifyContent: "center",
    marginBottom: "0.5rem",
  },
  otpBox: {
    width: "48px", height: "56px",
    textAlign: "center", fontSize: "1.5rem", fontWeight: "700",
    borderRadius: "0.75rem", border: "1.5px solid rgba(0,0,0,0.12)",
    outline: "none", fontFamily: "Inter, sans-serif",
    transition: "border-color 0.2s, box-shadow 0.2s",
    color: "#1a1c1d",
  },
  fieldMsg: {
    display: "flex", alignItems: "center", gap: "0.35rem",
    marginTop: "0.4rem", fontSize: "0.78rem", fontWeight: "500",
  },
  actions: { display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1.5rem" },
  primaryBtn: {
    width: "100%", padding: "0.8rem 1.5rem",
    background: "#ffd700", color: "#1a1c1d",
    fontWeight: "700", border: "none", borderRadius: "0.75rem",
    cursor: "pointer", boxShadow: "0 4px 12px rgba(255,215,0,0.35)",
    transition: "all 0.2s", display: "flex", alignItems: "center",
    justifyContent: "center", gap: "0.5rem", fontFamily: "Inter, sans-serif",
    fontSize: "0.95rem",
  },
  secondaryBtn: {
    width: "100%", padding: "0.7rem 1.5rem",
    background: "transparent", color: "#8a7f72",
    fontWeight: "600", border: "none", borderRadius: "0.75rem",
    cursor: "pointer", transition: "background 0.2s",
    display: "flex", alignItems: "center",
    justifyContent: "center", gap: "0.5rem", fontFamily: "Inter, sans-serif",
    fontSize: "0.875rem",
  },
  resendRow: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: "0.5rem", marginTop: "0.5rem",
    fontSize: "0.82rem", color: "#8a7f72",
  },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ─── OTP digit input ─────────────────────────────────────── */
function OTPInput({ value, onChange }) {
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);
  const refs = Array.from({ length: 6 }, () => useRef(null));

  const handleKey = (idx, e) => {
    if (e.key === "Backspace") {
      const arr = digits.map((d) => d);
      arr[idx] = "";
      onChange(arr.join(""));
      if (idx > 0) refs[idx - 1].current?.focus();
      return;
    }
    if (e.key === "ArrowLeft" && idx > 0) { refs[idx - 1].current?.focus(); return; }
    if (e.key === "ArrowRight" && idx < 5) { refs[idx + 1].current?.focus(); return; }
  };

  const handleChange = (idx, e) => {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    const arr = digits.map((d) => d);
    arr[idx] = char;
    onChange(arr.join(""));
    if (char && idx < 5) refs[idx + 1].current?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6));
    refs[Math.min(pasted.length, 5)].current?.focus();
    e.preventDefault();
  };

  return (
    <div style={S.otpRow}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          style={{
            ...S.otpBox,
            borderColor: d ? "#ffd700" : "rgba(0,0,0,0.12)",
            boxShadow: d ? "0 0 0 3px rgba(255,215,0,0.18)" : "none",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Spinner ─────────────────────────────────────────────── */
const Spinner = () => (
  <>
    <span style={{
      width: "16px", height: "16px",
      border: "2px solid rgba(0,0,0,0.2)",
      borderTopColor: "#1a1c1d",
      borderRadius: "50%", display: "inline-block",
      animation: "spin 0.7s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </>
);

/* ─── Main Modal ──────────────────────────────────────────── */
export default function EmailOTPModal({ isOpen, onClose, emailToVerify, onEmailUpdated }) {
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [resendTimer, setResendTimer] = useState(60); // start at 60s since OTP was just sent
  const timerRef = useRef(null);

  /* timer countdown */
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendTimer]);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setOtp("");
      setFieldError("");
      setResendTimer(60);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const otpComplete = otp.replace(/\D/g, "").length === 6;

  /* ── reset & close ── */
  const handleClose = () => {
    setOtp("");
    setFieldError("");
    onClose();
  };

  /* ── verify OTP ── */
  const handleVerify = async () => {
    if (!otpComplete) return;
    setVerifying(true); setFieldError("");
    try {
      const res = await profileAPI.verifyEmailOTP(emailToVerify, otp);
      toast.success("Email updated successfully! ✉️");
      onEmailUpdated(res.email || emailToVerify);
      handleClose();
    } catch (err) {
      let msg = "Invalid or expired OTP.";
      try {
        const d = JSON.parse(err.message);
        msg = d.error || d.detail || msg;
      } catch { msg = err.message || msg; }
      setFieldError(msg);
    }
    setVerifying(false);
  };

  /* ── Resend OTP ── */
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setSending(true); setFieldError(""); setOtp("");
    try {
      await profileAPI.requestEmailOTP(emailToVerify);
      setResendTimer(60);
      toast.success("OTP resent!");
    } catch (err) {
      setFieldError("Failed to resend OTP. Please try again.");
    }
    setSending(false);
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
          <div style={S.stepBadge}>
            <Shield size={11} />
            Verify Email
          </div>
          <h2 style={S.title}>Verify Your New Email</h2>
          <p style={S.subtitle}>
            A 6-digit code was sent to <strong>{emailToVerify}</strong>. Enter it below.
          </p>
        </div>

        {/* ── OTP Form ── */}
        <div style={S.formGroup}>
          <label style={S.label}>Enter 6-Digit OTP</label>
          <OTPInput value={otp} onChange={setOtp} />
          {fieldError && (
            <div style={{ ...S.fieldMsg, color: "#b91c1c", justifyContent: "center", marginTop: "0.75rem" }}>
              <AlertTriangle size={13} /> {fieldError}
            </div>
          )}
        </div>

        <div style={S.actions}>
          <button
            style={{ ...S.primaryBtn, opacity: (!otpComplete || verifying) ? 0.7 : 1 }}
            onClick={handleVerify}
            disabled={!otpComplete || verifying}
            onMouseEnter={(e) => { if (otpComplete && !verifying) e.currentTarget.style.background = "#ffe333"; }}
            onMouseLeave={(e) => { if (otpComplete && !verifying) e.currentTarget.style.background = "#ffd700"; }}
          >
            {verifying
              ? <><Spinner /> Verifying…</>
              : <><CheckCircle2 size={16} /> Verify & Update Email</>}
          </button>

          <div style={S.resendRow}>
            {resendTimer > 0 ? (
              <span>Resend available in {resendTimer}s</span>
            ) : (
              <button
                style={{ background: "none", border: "none", cursor: "pointer", color: "#5a5446", fontWeight: "600", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.35rem", fontFamily: "Inter, sans-serif" }}
                onClick={handleResend}
                disabled={sending}
              >
                <RefreshCw size={13} /> Resend OTP
              </button>
            )}
          </div>

          <button
            style={S.secondaryBtn}
            onClick={handleClose}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
