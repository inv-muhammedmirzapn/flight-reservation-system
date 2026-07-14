import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { profileAPI } from "../services/api";
import { 
  User, Mail, Phone, Calendar, Flag, Map, MapPin, Lock, 
  CheckCircle2, AlertCircle, Edit2, ShieldAlert
} from "lucide-react";

const REGISTRATION_FIELDS = ["username", "email", "first_name", "last_name"];
const PROFILE_FIELDS = ["phone_number", "gender", "date_of_birth", "country", "state", "city"];
const GENDER_OPTIONS = ["", "MALE", "FEMALE", "OTHER"];

const fieldLabel = (key) => key.replace(/_/g, " ");

const FIELD_ICONS = {
  username: User, email: Mail, first_name: User, last_name: User,
  phone_number: Phone, gender: User, date_of_birth: Calendar,
  country: Flag, state: Map, city: MapPin
};

function ViewField({ label, value, isEmpty, icon: Icon }) {
  return (
    <div className="flex flex-col p-4 rounded-xl hover:bg-gray-50/50 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          {label}
        </span>
      </div>
      <div className="pl-6">
        {isEmpty ? (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-sm font-medium text-gray-400 italic">Not set</span>
          </div>
        ) : (
          <span className="text-sm font-semibold text-gray-900">{value}</span>
        )}
      </div>
    </div>
  );
}

function FormInput({ id, label, value, onChange, type = "text", readOnly = false, options = null, icon: Icon }) {
  const base = "w-full rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium border transition-all duration-200 outline-none";
  const locked = "bg-gray-50/80 text-gray-500 border-gray-100 cursor-not-allowed";
  const editable = "bg-white text-gray-900 border-gray-200 focus:border-[#ffcc00] focus:ring-4 focus:ring-[#ffcc00]/20 hover:border-gray-300";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 flex items-center justify-between">
        <span>{label}</span>
        {readOnly && (
          <span className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
            <Lock className="w-3 h-3" /> Locked
          </span>
        )}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
          <Icon className="w-4 h-4" />
        </div>
        {options ? (
          <select id={id} name={id} value={value} onChange={onChange} disabled={readOnly}
            className={`${base} ${readOnly ? locked : editable} appearance-none`}>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "" ? "Select gender" : opt.charAt(0) + opt.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        ) : (
          <input id={id} name={id} type={type} value={value} onChange={onChange} readOnly={readOnly}
            className={`${base} ${readOnly ? locked : editable}`} />
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState({ type: "", text: "" });

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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg({ type: "", text: "" });
    try {
      const updated = await profileAPI.updateProfile({
        email: formData.email, first_name: formData.first_name,
        last_name: formData.last_name, phone_number: formData.phone_number,
        gender: formData.gender, date_of_birth: formData.date_of_birth || null,
        country: formData.country, state: formData.state, city: formData.city,
      });
      setProfile(updated);
      setFormData((prev) => ({ ...prev, ...updated }));
      localStorage.setItem("firstName", updated.first_name || "");
      localStorage.setItem("lastName", updated.last_name || "");
      window.dispatchEvent(new Event("authChange"));
      setSaveMsg({ type: "success", text: "Profile updated successfully" });
      setEditMode(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveMsg({ type: "", text: "" }), 3000);
    } catch (err) {
      setSaveMsg({ type: "error", text: "Failed to save: " + err.message });
    }
    setSaving(false);
  };

  const allFields = [...REGISTRATION_FIELDS, ...PROFILE_FIELDS];
  const emptyFields = profile ? PROFILE_FIELDS.filter((f) => !profile[f] || profile[f] === "") : [];
  const completeness = profile
    ? Math.round(((allFields.length - emptyFields.length) / allFields.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-gray-100 border-t-[#ffcc00] rounded-full animate-spin" />
        <p className="text-sm font-medium text-gray-500">Loading profile data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <p className="text-sm font-medium text-red-500">{error}</p>
        <button onClick={fetchProfile} className="px-6 py-2 bg-[#ffcc00] hover:bg-[#ffdb4d] text-black font-semibold rounded-xl transition-colors">
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: "140px" }} className="min-h-screen pb-16 px-4 font-sans bg-transparent flex flex-col items-center w-full">
      <div className="w-full max-w-[860px] flex flex-col gap-6">

        {/* ── Header Block ── */}
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60">
          <div className="w-24 h-24 rounded-full bg-[#ffcc00] flex items-center justify-center text-[36px] font-bold text-black shrink-0">
            {(profile?.first_name?.charAt(0) || profile?.username?.charAt(0) || "U").toUpperCase()}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {profile?.first_name && profile?.last_name
                ? `${profile.first_name} ${profile.last_name}` : profile?.username}
            </h1>
            <p className="text-gray-500 text-sm mt-1 font-medium">@{profile?.username}</p>
          </div>
          
          <div className="flex flex-col items-center bg-gray-50/50 p-4 rounded-[1.5rem] border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-gray-200" strokeWidth="4" />
                  <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-[#ffcc00]" strokeWidth="4"
                    strokeDasharray={`${completeness} ${100 - completeness}`}
                    strokeDashoffset="0" strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900">
                  {completeness}%
                </span>
              </div>
              <div className="flex flex-col hidden sm:flex max-w-[120px]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Profile Status</span>
                <span className="text-[11px] font-medium text-gray-600 leading-tight mt-0.5">
                  {completeness === 100 ? "All set! Your profile is complete." : "Complete your profile for full access"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Save Message ── */}
        {saveMsg.text && (
          <div className={`w-full px-5 py-3.5 rounded-[1rem] text-sm font-medium border flex items-center gap-3 shadow-sm ${
            saveMsg.type === "error" ? "bg-red-50 text-red-600 border-red-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
          }`}>
            {saveMsg.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {saveMsg.text}
          </div>
        )}

        {/* ── View Mode ── */}
        {!editMode && (
          <div className="bg-white rounded-[2rem] p-6 sm:p-10 flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Profile Details</h2>
                {emptyFields.length > 0 ? (
                  <p className="text-sm font-medium text-amber-600 mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {emptyFields.length} of {allFields.length} fields missing
                  </p>
                ) : (
                  <p className="text-sm font-medium text-emerald-600 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> All fields completed
                  </p>
                )}
              </div>
              <button onClick={() => setEditMode(true)}
                className="px-6 py-2.5 rounded-[1rem] bg-[#ffcc00] text-black text-sm font-bold hover:bg-[#ffdb4d] transition-colors flex items-center gap-2">
                <Edit2 className="w-4 h-4" /> Update Profile
              </button>
            </div>

            <div className="bg-gray-50/50 p-6 rounded-[1.5rem] border border-gray-100 mb-8">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-2">Account Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {REGISTRATION_FIELDS.map((key) => (
                  <ViewField key={key} label={fieldLabel(key)} value={profile[key]} isEmpty={!profile[key]} icon={FIELD_ICONS[key]} />
                ))}
              </div>
            </div>

            <div className="p-6">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-2">Personal Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {PROFILE_FIELDS.map((key) => (
                  <ViewField key={key} label={fieldLabel(key)} 
                    value={key === "gender" && profile[key] ? profile[key].charAt(0) + profile[key].slice(1).toLowerCase() : profile[key]} 
                    isEmpty={!profile[key]} icon={FIELD_ICONS[key]} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Mode ── */}
        {editMode && (
          <form onSubmit={handleSave} className="bg-white rounded-[2rem] p-6 sm:p-10 flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Edit Profile</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">Update your personal information</p>
              </div>
            </div>

            <div className="bg-gray-50/50 p-6 rounded-[1.5rem] border border-gray-100 mb-8">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-5 px-2">Account Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <FormInput id="username" label="Username" value={formData.username} onChange={handleChange} readOnly icon={FIELD_ICONS.username} />
                <FormInput id="email" label="Email" type="email" value={formData.email} onChange={handleChange} readOnly icon={FIELD_ICONS.email} />
                <FormInput id="first_name" label="First Name" value={formData.first_name} onChange={handleChange} readOnly icon={FIELD_ICONS.first_name} />
                <FormInput id="last_name" label="Last Name" value={formData.last_name} onChange={handleChange} readOnly icon={FIELD_ICONS.last_name} />
              </div>
            </div>

            <div className="p-6">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-5 px-2">Personal Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <FormInput id="phone_number" label="Phone Number" value={formData.phone_number} onChange={handleChange} icon={FIELD_ICONS.phone_number} />
                <FormInput id="gender" label="Gender" value={formData.gender} onChange={handleChange} options={GENDER_OPTIONS} icon={FIELD_ICONS.gender} />
                <FormInput id="date_of_birth" label="Date of Birth" type="date" value={formData.date_of_birth} onChange={handleChange} icon={FIELD_ICONS.date_of_birth} />
                <FormInput id="country" label="Country" value={formData.country} onChange={handleChange} icon={FIELD_ICONS.country} />
                <FormInput id="state" label="State" value={formData.state} onChange={handleChange} icon={FIELD_ICONS.state} />
                <FormInput id="city" label="City" value={formData.city} onChange={handleChange} icon={FIELD_ICONS.city} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
              <button type="button" disabled={saving} onClick={() => { setEditMode(false); setSaveMsg({ type: "", text: "" }); }}
                className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="w-full sm:w-auto px-8 py-2.5 bg-[#ffcc00] hover:bg-[#ffdb4d] text-black text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    Saving…
                  </>
                ) : "Save Changes"}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}