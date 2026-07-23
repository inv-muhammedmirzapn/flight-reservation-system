import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { profileAPI } from "@/services/profile-service/profileService";
import {
  User, Mail, Phone, Calendar, Flag, Map, MapPin,
  Edit2, ShieldAlert, Save, X, Key
} from "lucide-react";
import { Select } from "@/components/ui/Select";
import ChangePasswordModal from "@/components/ui/ChangePasswordModal";
import EmailOTPModal from "@/components/ui/EmailOTPModal";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

const REGISTRATION_FIELDS = ["username", "email", "first_name", "last_name"];
const PROFILE_FIELDS = ["phone_number", "gender", "date_of_birth", "country", "state", "city"];
const GENDER_OPTIONS = [
  { value: "", label: "Select gender" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" }
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getFieldLabels = (t) => ({
  username: t("auth.username"), email: t("auth.email"), first_name: t("auth.firstName"),
  last_name: t("auth.lastName"), phone_number: t("profile.phone"), gender: t("profile.gender"),
  date_of_birth: t("profile.dob"), country: t("profile.country"), state: t("profile.state"), city: t("profile.city"),
});

const FIELD_ICONS = {
  username: User, email: Mail, first_name: User, last_name: User,
  phone_number: Phone, gender: User, date_of_birth: Calendar,
  country: Flag, state: Map, city: MapPin,
  oldPassword: Key, newPassword: Key, confirmPassword: Key,
};

/* ── Inline style objects ─────────────────────────── */
const S = {
  page: {
    minHeight: "100vh",
    paddingTop: "100px",
    paddingBottom: "3rem",
    paddingLeft: "1rem",
    paddingRight: "1rem",
    fontFamily: "Inter, sans-serif",
  },
  container: {
    width: "100%",
    maxWidth: "860px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  // ── Header card ──
  headerCard: {
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: "1.5rem",
    boxShadow: "0 8px 32px rgba(0,0,0,0.07)",
    padding: "2rem 2.5rem",
    display: "flex",
    alignItems: "center",
    gap: "2rem",
    flexWrap: "wrap",
  },
  avatar: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #ffd700 0%, #ffb300 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "2rem",
    fontWeight: "800",
    color: "#1a1c1d",
    flexShrink: 0,
    boxShadow: "0 4px 16px rgba(255,215,0,0.4)",
    letterSpacing: "-0.02em",
  },
  headerInfo: {
    flex: 1,
    minWidth: "160px",
  },
  headerName: {
    fontSize: "1.625rem",
    fontWeight: "800",
    color: "#1a1c1d",
    letterSpacing: "-0.03em",
    lineHeight: 1.2,
    margin: 0,
  },
  headerUsername: {
    fontSize: "0.9rem",
    color: "#8a7f72",
    fontWeight: "500",
    marginTop: "0.25rem",
  },
  progressWrap: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    background: "rgba(0,0,0,0.03)",
    border: "1px solid rgba(0,0,0,0.06)",
    borderRadius: "1rem",
    padding: "1rem 1.25rem",
    marginLeft: "auto",
  },
  progressLabel: {
    fontSize: "0.7rem",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#8a7f72",
  },
  progressText: {
    fontSize: "0.8rem",
    color: "#5a5446",
    fontWeight: "500",
    marginTop: "0.2rem",
    maxWidth: "140px",
    lineHeight: 1.4,
  },
  // ── Alert banner ──
  alertBase: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.875rem 1.25rem",
    borderRadius: "0.875rem",
    fontSize: "0.875rem",
    fontWeight: "500",
    border: "1px solid",
  },
  // ── Section card ──
  card: {
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: "1.5rem",
    boxShadow: "0 8px 32px rgba(0,0,0,0.07)",
    overflow: "hidden",

  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.75rem 2rem 0",
    marginBottom: "1.5rem",
    flexWrap: "wrap",
    gap: "1rem",
  },
  cardTitle: {
    fontSize: "1.125rem",
    fontWeight: "700",
    color: "#1a1c1d",
    letterSpacing: "-0.02em",
    margin: 0,
  },
  cardSubtitle: {
    fontSize: "0.825rem",
    color: "#8a7f72",
    fontWeight: "500",
    marginTop: "0.2rem",
  },
  editBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.6rem 1.25rem",
    background: "#ffd700",
    color: "#1a1c1d",
    fontWeight: "700",
    fontSize: "0.875rem",
    border: "none",
    borderRadius: "1rem",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(255,215,0,0.35)",
    transition: "all 0.2s",
    fontFamily: "Inter, sans-serif",
  },
  // ── Section group ──
  sectionGroup: {
    margin: "0 2rem 1.5rem",
  },
  sectionGroupLast: {
    margin: "0 2rem 2rem",
  },
  sectionLabel: {
    fontSize: "0.65rem",
    fontWeight: "800",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#b0a896",
    marginBottom: "0.875rem",
    paddingBottom: "0.5rem",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "0.25rem",
  },
  fieldGrid2col: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.25rem",
  },
  // ── View field ──
  viewField: {
    padding: "0.875rem 0.75rem",
    borderRadius: "0.75rem",
    transition: "background 0.15s",
    cursor: "default",
  },
  viewFieldIconRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.25rem",
  },
  viewFieldLabel: {
    fontSize: "0.68rem",
    fontWeight: "700",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#b0a896",
  },
  viewFieldValue: {
    paddingLeft: "1.5rem",
    fontSize: "0.9rem",
    fontWeight: "600",
    color: "#1a1c1d",
  },
  viewFieldEmpty: {
    paddingLeft: "1.5rem",
    fontSize: "0.875rem",
    color: "#c9b98a",
    fontStyle: "italic",
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  // ── Form input ──
  formFieldWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  formLabel: {
    fontSize: "0.68rem",
    fontWeight: "700",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#8a7f72",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  changeEmailBtn: {
    display: "inline-flex", alignItems: "center", gap: "0.3rem",
    fontSize: "0.72rem", fontWeight: "700", color: "#1a1c1d",
    background: "#ffd700", border: "none", cursor: "pointer",
    padding: "0.2rem 0.65rem", borderRadius: "99px",
    fontFamily: "Inter, sans-serif",
  },
  inputWrap: {
    position: "relative",
  },
  inputIcon: {
    position: "absolute",
    left: "0.875rem",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: "#b0a896",
  },
  inputBase: {
    width: "100%",
    paddingLeft: "2.5rem",
    paddingRight: "1rem",
    paddingTop: "0.6rem",
    paddingBottom: "0.6rem",
    fontSize: "0.9rem",
    fontWeight: "500",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.75rem",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  // ── Divider ──
  divider: {
    height: "1px",
    background: "rgba(0,0,0,0.06)",
    margin: "0 2rem",
  },
  // ── Form actions ──
  formActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "0.75rem",
    padding: "1.5rem 2rem",
    borderTop: "1px solid rgba(0,0,0,0.06)",
    flexWrap: "wrap",
  },
  cancelBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.6rem 1.25rem",
    background: "rgba(0,0,0,0.05)",
    color: "#5a5446",
    fontWeight: "600",
    fontSize: "0.875rem",
    border: "none",
    borderRadius: "0.75rem",
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    transition: "background 0.2s",
  },
  saveBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.6rem 1.5rem",
    background: "#ffd700",
    color: "#1a1c1d",
    fontWeight: "700",
    fontSize: "0.875rem",
    border: "none",
    borderRadius: "0.75rem",
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    boxShadow: "0 4px 12px rgba(255,215,0,0.35)",
    transition: "all 0.2s",
  },
};

/* ── Sub-components ────────────────────────────────── */
function ViewField({ fieldKey, value, label }) {
  const Icon = FIELD_ICONS[fieldKey];
  const isEmpty = !value || value === "";
  const displayVal =
    fieldKey === "gender" && value
      ? value.charAt(0) + value.slice(1).toLowerCase()
      : value;

  return (
    <div
      style={S.viewField}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.025)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={S.viewFieldIconRow}>
        <Icon size={13} color="#c0b49e" />
        <span style={S.viewFieldLabel}>{label}</span>
      </div>
      {isEmpty ? (
        <div style={S.viewFieldEmpty}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f0c040", display: "inline-block" }} />

        </div>
      ) : (
        <div style={S.viewFieldValue}>{displayVal}</div>
      )}
    </div>
  );
}

function FormField({ id, value, onChange, label, type = "text", readOnly = false, options = null, rightAddon = null }) {
  const Icon = FIELD_ICONS[id];

  const readOnlyStyle = {
    ...S.inputBase,
    background: "rgba(0,0,0,0.03)",
    border: "1.5px solid rgba(0,0,0,0.07)",
    color: "#7a7060",
    cursor: "default",
  };
  const editableStyle = {
    ...S.inputBase,
    background: "rgba(255,255,255,0.8)",
    border: "1.5px solid rgba(0,0,0,0.12)",
    color: "#1a1c1d",
  };

  return (
    <div style={S.formFieldWrap}>
      <label htmlFor={id} style={S.formLabel}>
        <span>{label}</span>
      </label>
      <div style={S.inputWrap}>
        <span style={S.inputIcon}><Icon size={15} /></span>
        {options ? (
          <Select
            id={id} name={id} value={value} onChange={onChange}
            disabled={readOnly}
            options={options}
            style={{ ...(readOnly ? readOnlyStyle : editableStyle), paddingRight: "2.5rem" }}
            label=""
          />
        ) : (
          <input
            id={id} name={id} type={type} value={value}
            onChange={readOnly ? undefined : onChange}
            readOnly={readOnly}
            style={{ ...(readOnly ? readOnlyStyle : editableStyle), paddingRight: rightAddon ? "6.5rem" : "1rem" }}
            onFocus={(e) => {
              if (!readOnly) { e.target.style.borderColor = "#ffd700"; e.target.style.boxShadow = "0 0 0 3px rgba(255,215,0,0.18)"; }
            }}
            onBlur={(e) => {
              if (!readOnly) { e.target.style.borderColor = "rgba(0,0,0,0.12)"; e.target.style.boxShadow = "none"; }
            }}
          />
        )}
        {rightAddon && (
          <div style={{ position: "absolute", right: "0.35rem", top: "50%", transform: "translateY(-50%)" }}>
            {rightAddon}
          </div>
        )}
      </div>
    </div>
  );
}

function CircleProgress({ pct }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e8e0d0" strokeWidth="4" />
      <circle
        cx="22" cy="22" r={r} fill="none" stroke="#ffd700" strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
      <text x="22" y="26" textAnchor="middle" fontSize="9" fontWeight="800" fill="#1a1c1d" fontFamily="Inter,sans-serif">
        {pct}%
      </text>
    </svg>
  );
}

/* ── Main Page ─────────────────────────────────────── */
export default function ProfilePage() {
  const { t } = useTranslation();
  const fieldLabels = getFieldLabels(t);
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEmailModalOpen,    setIsEmailModalOpen]    = useState(false);
  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await profileAPI.getProfile();
      setProfile(data);
      setFormData({
        username: data.username || "", email: data.email || "",
        first_name: data.first_name || "", last_name: data.last_name || "",
        phone_number: data.phone_number || "", gender: data.gender || "",
        date_of_birth: data.date_of_birth || "", country: data.country || "",
        state: data.state || "", city: data.city || "",
      });
      if (data.first_name) {
        localStorage.setItem("firstName", data.first_name);
        localStorage.setItem("lastName", data.last_name || "");
        window.dispatchEvent(new Event("authChange"));
      }
    } catch (err) {
      setError("Failed to load profile. Please try again.");
    }
    setLoading(false);
  };

  const handleChange = (e) => setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleVerifyEmail = async () => {
    if (!EMAIL_REGEX.test(formData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setVerifyingEmail(true);
    try {
      await profileAPI.requestEmailOTP(formData.email);
      setIsEmailModalOpen(true);
      toast.success("OTP sent! Check your new email inbox.");
    } catch (err) {
      let msg = "Failed to send OTP.";
      try {
        const d = JSON.parse(err.message);
        msg = d.new_email?.[0] || d.detail || msg;
      } catch { msg = err.message || msg; }
      toast.error(msg);
    }
    setVerifyingEmail(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    // Validate Basic Info (Mandatory Fields)
    if (!formData.username?.trim() || !formData.first_name?.trim() || !formData.last_name?.trim() || !formData.email?.trim()) {
      toast.error("Please fill in all basic information fields (Username, Email, First Name, Last Name).");
      setSaving(false);
      return;
    }

    if (formData.email !== profile?.email) {
      toast.error("Please verify your new email before saving changes.");
      setSaving(false);
      return;
    }
    try {
      const updated = await profileAPI.updateProfile({
        username: formData.username,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number,
        gender: formData.gender,
        date_of_birth: formData.date_of_birth || null,
        country: formData.country,
        state: formData.state,
        city: formData.city,
      });
      setProfile(updated);
      setFormData((prev) => ({ ...prev, ...updated }));
      localStorage.setItem("firstName", updated.first_name || "");
      localStorage.setItem("lastName", updated.last_name || "");
      window.dispatchEvent(new Event("authChange"));
      toast.success("Profile updated successfully!");
      setEditMode(false);
    } catch (err) {
      let msg = "Failed to save profile.";
      try {
        const d = JSON.parse(err.message);
        msg = d.username?.[0] || d.detail || msg;
      } catch { msg = err.message || msg; }
      toast.error(msg);
    }
    setSaving(false);
  };

  const handleEmailUpdated = (newEmail) => {
    setProfile((prev) => ({ ...prev, email: newEmail }));
    setFormData((prev) => ({ ...prev, email: newEmail }));
  };


  const allFields = [...REGISTRATION_FIELDS, ...PROFILE_FIELDS];
  const emptyFields = profile ? PROFILE_FIELDS.filter((f) => !profile[f] || profile[f] === "") : [];
  const completeness = profile
    ? Math.round(((allFields.length - emptyFields.length) / allFields.length) * 100) : 0;

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: "1rem" }}>
        <div style={{ width: "40px", height: "40px", border: "4px solid #e8e0d0", borderTopColor: "#ffd700", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ fontSize: "0.9rem", color: "#8a7f72", fontWeight: "500" }}>Loading profile…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: "1rem" }}>
        <ShieldAlert size={48} color="#e06060" />
        <p style={{ fontSize: "0.9rem", color: "#b05050", fontWeight: "500" }}>{error}</p>
        <button onClick={fetchProfile} style={{ ...S.editBtn, marginTop: "0.5rem" }}>
          Retry Connection
        </button>
      </div>
    );
  }

  const fullName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}` : profile?.username;
  const avatarChar = (profile?.first_name?.charAt(0) || profile?.username?.charAt(0) || "U").toUpperCase();

  return (
    <>
      <div style={S.page}>
        <div style={S.container}>

          {/* ── Header Card ── */}
          <div style={S.headerCard}>
            <div style={S.avatar}>{avatarChar}</div>

            <div style={S.headerInfo}>
              <h1 style={S.headerName}>{fullName}</h1>
              <p style={S.headerUsername}>@{profile?.username}</p>
            </div>

            <div style={S.progressWrap}>
              <CircleProgress pct={completeness} />
              <div>
                <div style={S.progressLabel}>{t("profile.status")}</div>
                <div style={S.progressText}>
                  {completeness === 100
                    ? t("profile.complete")
                    : t("profile.remaining", { count: emptyFields.length })}
                </div>
              </div>
            </div>
          </div>



          {/* ════════════ VIEW MODE ════════════ */}
          {!editMode && (
            <div style={S.card}>
              <div style={S.cardHeader}>
                <div>
                  <h2 style={S.cardTitle}>{t("profile.personalInfo")}</h2>
                  <div style={S.cardSubtitle}>
                    {emptyFields.length > 0
                      ? t("profile.notFilled", { empty: emptyFields.length, total: allFields.length })
                      : t("profile.allComplete")}
                  </div>
                </div>
                <div style={{ "display": "flex", "flex-wrap": "wrap", "gap": "1rem" }}>

                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(true)}
                    style={S.editBtn}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe333")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#ffd700")}
                  >
                    <Key size={14} /> {t("profile.updatePassword")}
                  </button>
                  <button
                    onClick={() => setEditMode(true)}
                    style={S.editBtn}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe333")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#ffd700")}
                  >
                    <Edit2 size={14} /> {t("profile.editProfile")}
                  </button>
                </div>
              </div>

              {/* Account Information */}
              <div style={S.sectionGroup}>
                <div style={S.sectionLabel}>{t("profile.basicInfo")}</div>
                <div style={S.fieldGrid2col}>
                  {REGISTRATION_FIELDS.map((key) => (
                    <ViewField key={key} fieldKey={key} value={profile[key]} label={fieldLabels[key]} />
                  ))}
                </div>
              </div>

              <div style={S.divider} />

              {/* Personal Details */}
              <div style={{ ...S.sectionGroup, ...S.sectionGroupLast, marginTop: "1.5rem" }}>
                <div style={S.sectionLabel}>{t("profile.contactDetails")}</div>
                <div style={S.fieldGrid}>
                  {PROFILE_FIELDS.map((key) => (
                    <ViewField key={key} fieldKey={key} value={profile[key]} label={fieldLabels[key]} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════════ EDIT MODE ════════════ */}
          {editMode && (
            <form onSubmit={handleSave} style={S.card}>
              <div style={S.cardHeader}>
                <div>
                  <h2 style={S.cardTitle}>{t("profile.editProfile")}</h2>
                  <div style={S.cardSubtitle}>{t("profile.updateDetails")}</div>
                </div>
              </div>

              {/* Account Information — all editable */}
              <div style={S.sectionGroup}>
                <div style={S.sectionLabel}>{t("profile.basicInfo")}</div>
                <div style={S.fieldGrid2col}>
                  <FormField id="username" label={fieldLabels.username} value={formData.username} onChange={handleChange} />
                  <FormField
                    id="email" label={fieldLabels.email} type="email"
                    value={formData.email} onChange={handleChange}
                    rightAddon={
                      formData.email !== profile?.email ? (
                        <button
                          type="button"
                          style={{
                            ...S.changeEmailBtn,
                            padding: "0.4rem 0.85rem",
                            fontSize: "0.78rem",
                            opacity: verifyingEmail ? 0.7 : 1
                          }}
                          onClick={handleVerifyEmail}
                          disabled={verifyingEmail}
                        >
                          {verifyingEmail ? (
                            <span style={{ width: "12px", height: "12px", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#1a1c1d", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                          ) : (
                            <ShieldAlert size={12} />
                          )}
                          Verify
                        </button>
                      ) : null
                    }
                  />
                  <FormField id="first_name" label={fieldLabels.first_name} value={formData.first_name} onChange={handleChange} />
                  <FormField id="last_name" label={fieldLabels.last_name} value={formData.last_name} onChange={handleChange} />
                </div>
              </div>

              <div style={S.divider} />

              {/* Personal Details — editable */}
              <div style={{ ...S.sectionGroup, marginTop: "1.5rem" }}>
                <div style={S.sectionLabel}>{t("profile.contactDetails")}</div>
                <div style={S.fieldGrid}>
                  <FormField id="phone_number" label={fieldLabels.phone_number} value={formData.phone_number} onChange={handleChange} />
                  <FormField id="gender" label={fieldLabels.gender} value={formData.gender} onChange={handleChange} options={GENDER_OPTIONS} />
                  <FormField id="date_of_birth" label={fieldLabels.date_of_birth} type="date" value={formData.date_of_birth} onChange={handleChange} />
                  <FormField id="country" label={fieldLabels.country} value={formData.country} onChange={handleChange} />
                  <FormField id="state" label={fieldLabels.state} value={formData.state} onChange={handleChange} />
                  <FormField id="city" label={fieldLabels.city} value={formData.city} onChange={handleChange} />
                </div>
              </div>

              {/* Actions */}
              <div style={S.formActions}>
                <button
                  type="button" disabled={saving}
                  onClick={() => { setEditMode(false); }}
                  style={S.cancelBtn}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
                >
                  <X size={14} /> {t("profile.cancel")}
                </button>
                <button
                  type="submit" disabled={saving}
                  style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }}
                  onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = "#ffe333"; }}
                  onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = "#ffd700"; }}
                >
                  {saving ? (
                    <>
                      <span style={{ width: "14px", height: "14px", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#1a1c1d", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                      {t("profile.updating")}
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </>
                  ) : (
                    <><Save size={14} /> {t("profile.saveChanges")}</>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>

      </div>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
      <EmailOTPModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        emailToVerify={formData.email}
        onEmailUpdated={handleEmailUpdated}
      />
    </>
  );
}