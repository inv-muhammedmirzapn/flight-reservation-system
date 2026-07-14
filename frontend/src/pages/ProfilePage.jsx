import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { profileAPI } from "../services/api";


// Fields that came from registration (read-only in display, locked in form)
const REGISTRATION_FIELDS = ["username", "email", "first_name", "last_name"];
// Fields that the user fills in on profile update
const PROFILE_FIELDS = ["phone_number", "gender", "date_of_birth", "country", "state", "city"];

const GENDER_OPTIONS = ["", "MALE", "FEMALE", "OTHER"];

function FieldRow({ label, value, isEmpty }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-container last:border-0">
      <span className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span
        className={`text-sm font-medium ${isEmpty ? "text-on-surface-variant italic" : "text-on-surface"
          }`}
      >
        {isEmpty ? "—  Not set" : value}
      </span>
      {isEmpty && (
        <span className="text-xs bg-primary-container/30 text-on-primary-container px-2 py-0.5 rounded-full self-start sm:self-auto">
          Update needed
        </span>
      )}
    </div>
  );
}

// ─── sub-component: styled input ──────────────────────────────────────────────
function FormInput({ id, label, value, onChange, type = "text", readOnly = false, options = null }) {
  const baseClass =
    "w-full rounded-xl px-4 py-3 text-sm font-medium text-on-surface border transition-all duration-200 outline-none bg-white/50";
  const readOnlyClass = "bg-surface-container/60 text-on-surface-variant cursor-not-allowed border-surface-container";
  const editClass = "border-white/60 focus:border-primary/50 focus:bg-white/70 focus:shadow-[0_0_0_3px_rgba(112,93,0,0.08)]";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
        {readOnly && (
          <span className="ml-2 text-[10px] normal-case font-normal bg-surface-container px-1.5 py-0.5 rounded text-on-surface-variant">
            locked
          </span>
        )}
      </label>
      {options ? (
        <select
          id={id}
          name={id}
          value={value}
          onChange={onChange}
          disabled={readOnly}
          className={`${baseClass} ${readOnly ? readOnlyClass : editClass}`}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "" ? "Select gender" : opt.charAt(0) + opt.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          className={`${baseClass} ${readOnly ? readOnlyClass : editClass}`}
        />
      )}
    </div>
  );
}

// ─── main ProfilePage ──────────────────────────────────────────────────────────
export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      navigate("/login");
      return;
    }
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await profileAPI.getProfile();
      setProfile(data);
      setFormData({
        username: data.username || "",
        email: data.email || "",
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        phone_number: data.phone_number || "",
        gender: data.gender || "",
        date_of_birth: data.date_of_birth || "",
        country: data.country || "",
        state: data.state || "",
        city: data.city || "",
      });
      // Update navbar initials from real profile data
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

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg({ type: "", text: "" });
    try {
      const payload = {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number,
        gender: formData.gender,
        date_of_birth: formData.date_of_birth || null,
        country: formData.country,
        state: formData.state,
        city: formData.city,
      };
      const updated = await profileAPI.updateProfile(payload);
      setProfile(updated);
      setFormData((prev) => ({ ...prev, ...updated }));
      // Update initials in navbar
      localStorage.setItem("firstName", updated.first_name || "");
      localStorage.setItem("lastName", updated.last_name || "");
      window.dispatchEvent(new Event("authChange"));
      setSaveMsg({ type: "success", text: "Profile updated successfully! ✓" });
      setEditMode(false);
    } catch (err) {
      setSaveMsg({ type: "error", text: "Failed to save. " + err.message });
    }
    setSaving(false);
  };

  // ── compute completeness ──
  const allFields = [...REGISTRATION_FIELDS, ...PROFILE_FIELDS];
  const emptyFields = profile
    ? PROFILE_FIELDS.filter((f) => !profile[f] || profile[f] === "")
    : [];
  const completeness = profile
    ? Math.round(((allFields.length - emptyFields.length) / allFields.length) * 100)
    : 0;

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
        <p className="text-on-surface-variant text-sm">Loading your profile…</p>
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-error text-sm font-medium">{error}</p>
        <button
          onClick={fetchProfile}
          className="px-4 py-2 rounded-xl bg-primary-container text-on-surface text-sm font-semibold hover:bg-[#ffe140] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">

      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div className="glass-card rounded-[2rem] p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center text-3xl font-bold text-on-surface shrink-0 shadow-lg border-4 border-white/60">
          {(profile?.first_name?.charAt(0) || profile?.username?.charAt(0) || "U").toUpperCase()}
        </div>

        {/* Name + role */}
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-bold text-on-surface">
            {profile?.first_name && profile?.last_name
              ? `${profile.first_name} ${profile.last_name}`
              : profile?.username}
          </h1>
          <p className="text-on-surface-variant text-sm mt-0.5">@{profile?.username}</p>
        </div>

        {/* Completeness ring */}
        <div className="flex flex-col items-center gap-1">
          <div className="relative w-16 h-16">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e2e4" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke="#ffd700" strokeWidth="3"
                strokeDasharray={`${completeness} ${100 - completeness}`}
                strokeDashoffset="0"
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-on-surface">
              {completeness}%
            </span>
          </div>
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wide font-semibold">
            Complete
          </span>
        </div>
      </div>

      {/* ── Save message ────────────────────────────────────────────────── */}
      {saveMsg.text && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium border ${saveMsg.type === "error"
              ? "bg-error-container text-on-error-container border-[#ffb4ab]"
              : "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]"
            }`}
        >
          {saveMsg.text}
        </div>
      )}

      {/* ── View Mode ───────────────────────────────────────────────────── */}
      {!editMode && (
        <div className="glass-card rounded-[2rem] p-8 flex flex-col gap-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-on-surface">Profile Details</h2>
            <button
              id="edit-profile-btn"
              onClick={() => { setEditMode(true); setSaveMsg({ type: "", text: "" }); }}
              className="px-5 py-2 rounded-xl bg-primary-container text-on-surface text-sm font-bold hover:bg-[#ffe140] transition-all duration-200 active:scale-95 shadow-sm"
            >
              ✏️ Update Profile
            </button>
          </div>

          {/* Registration fields */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
            Account Info
          </p>
          {REGISTRATION_FIELDS.map((key) => (
            <FieldRow
              key={key}
              label={fieldLabel(key)}
              value={profile[key]}
              isEmpty={!profile[key]}
            />
          ))}

          {/* Profile fields */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-4 mb-1">
            Personal Details
          </p>
          {PROFILE_FIELDS.map((key) => (
            <FieldRow
              key={key}
              label={fieldLabel(key)}
              value={key === "gender" ? (profile[key]?.charAt(0) + profile[key]?.slice(1).toLowerCase()) : profile[key]}
              isEmpty={!profile[key]}
            />
          ))}

          {emptyFields.length > 0 && (
            <p className="text-xs text-on-surface-variant mt-4 text-center">
              {emptyFields.length} field{emptyFields.length > 1 ? "s" : ""} missing — click{" "}
              <span
                className="text-primary font-semibold cursor-pointer hover:underline"
                onClick={() => setEditMode(true)}
              >
                Update Profile
              </span>{" "}
              to complete your profile.
            </p>
          )}
        </div>
      )}

      {/* ── Edit Mode ───────────────────────────────────────────────────── */}
      {editMode && (
        <form onSubmit={handleSave} className="glass-card rounded-[2rem] p-8 flex flex-col gap-5">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-on-surface">Update Profile</h2>
            <button
              type="button"
              onClick={() => { setEditMode(false); setSaveMsg({ type: "", text: "" }); }}
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Read-only registration fields */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              Account Info (read-only)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput id="username" label="Username" value={formData.username} onChange={handleChange} readOnly />
              <FormInput id="email" label="Email" type="email" value={formData.email} onChange={handleChange} readOnly />
              <FormInput id="first_name" label="First Name" value={formData.first_name} onChange={handleChange} readOnly />
              <FormInput id="last_name" label="Last Name" value={formData.last_name} onChange={handleChange} readOnly />
            </div>
          </div>

          {/* Editable profile fields */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              Personal Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput id="phone_number" label="Phone Number" value={formData.phone_number} onChange={handleChange} />
              <FormInput
                id="gender"
                label="Gender"
                value={formData.gender}
                onChange={handleChange}
                options={GENDER_OPTIONS}
              />
              <FormInput id="date_of_birth" label="Date of Birth" type="date" value={formData.date_of_birth} onChange={handleChange} />
              <FormInput id="country" label="Country" value={formData.country} onChange={handleChange} />
              <FormInput id="state" label="State" value={formData.state} onChange={handleChange} />
              <FormInput id="city" label="City" value={formData.city} onChange={handleChange} />
            </div>
          </div>

          <button
            id="save-profile-btn"
            type="submit"
            disabled={saving}
            className="w-full bg-primary-container text-on-surface font-bold py-3 rounded-xl hover:bg-[#ffe140] transition-colors duration-300 shadow-[0px_8px_16px_rgba(255,215,0,0.2)] active:scale-95 flex items-center justify-center gap-2 mt-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-on-surface/30 border-t-on-surface rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </form>
      )}
    </div>
  );
}