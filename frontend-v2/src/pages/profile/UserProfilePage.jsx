import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { profileAPI } from "@/services/profile-service/profileService";
import { updateProfileSuccess } from "@/store/authSlice";
import toast from "react-hot-toast";
import CustomSelect from "@/components/ui/CustomSelect";
import SingleDatePickerModal from "@/components/ui/SingleDatePickerModal";

export default function UserProfilePage() {
  const dispatch = useDispatch();
  const auth = useSelector((state) => state?.auth) || {};

  const [profile, setLocalProfile] = useState(auth.profile || null);
  const [loading, setLoading] = useState(!profile);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDobModalOpen, setIsDobModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone_number: "",
    gender: "Male",
    date_of_birth: "",
    city: "",
    state: "",
    country: "",
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchProfile() {
      try {
        const res = await profileAPI.getProfile();
        if (isMounted) {
          setLocalProfile(res);
          dispatch(updateProfileSuccess(res));
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProfile();
  }, [dispatch]);

  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        username: profile.username || "",
        email: profile.email || "",
        phone_number: profile.phone_number || "",
        gender: profile.gender || "Male",
        date_of_birth: profile.date_of_birth || "",
        city: profile.city || "",
        state: profile.state || "",
        country: profile.country || "",
      });
    }
  }, [profile]);

  const formatDate = (dateStr, includeTime = false) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const day = d.getDate();
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();

    if (includeTime) {
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      return `${day} ${month} ${year}, ${hours}:${mins}`;
    }

    return `${day} ${month} ${year}`;
  };

  const getInitials = (p) => {
    if (p?.first_name && p?.last_name) {
      return `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
    }
    if (p?.username) {
      return p.username.substring(0, 2).toUpperCase();
    }
    return "AM";
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        username: profile.username || "",
        email: profile.email || "",
        phone_number: profile.phone_number || "",
        gender: profile.gender || "Male",
        date_of_birth: profile.date_of_birth || "",
        city: profile.city || "",
        state: profile.state || "",
        country: profile.country || "",
      });
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await profileAPI.updateProfile(formData);
      setLocalProfile(updated);
      dispatch(updateProfileSuccess(updated));
      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating profile:", err);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="relative overflow-hidden min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-12 mt-16 bg-slate-50/60">
        <div className="w-12 h-12 rounded-full border-4 border-slate-300 border-t-slate-900 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600">Loading Profile Details...</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-12 mt-14 bg-slate-50/60">
      {/* Sky-themed Soft Ambient Aesthetic Blobs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-sky-200/50 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 -right-20 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-72 h-72 bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />

      <h1 className="text-xl font-bold text-slate-950 w-full max-w-2xl mb-7 ml-5">
        Profile
      </h1>

      {/* Container Card */}
      <div className="relative z-10 w-full max-w-2xl rounded-3xl px-8 py-12 sm:px-10 animate-fade-in plain-card space-y-6">
        {/* Top-Right Edit / Action Buttons */}
        <div className="absolute top-6 right-6 sm:top-8 sm:right-8 flex items-center gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all duration-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              <span>Edit</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#ffd600] hover:bg-yellow-400 text-black font-bold text-xs transition-all duration-200 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>

        {/* Profile Avatar Header */}
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-slate-100">
          <div className="w-20 h-20 rounded-full bg-[#ffd600] text-black font-extrabold text-2xl flex items-center justify-center shadow-[0_0_25px_rgba(255,214,0,0.6)] select-none flex-shrink-0">
            {getInitials(profile)}
          </div>

          <div className="text-center sm:text-left space-y-1 flex-1">
            <h1 className="font-bold text-slate-800">
              {profile?.first_name || profile?.last_name
                ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
                : profile?.username || "Passenger Profile"}
            </h1>
            <p className="text-xs font-semibold text-slate-500">
              @{profile?.username || "-"}
            </p>
            <div className="pt-1 flex items-center justify-center sm:justify-start gap-1.5 text-xs font-medium text-slate-500">
              <span className="material-symbols-outlined text-sm text-slate-400">calendar_month</span>
              <span>Joined {formatDate(profile?.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Personal Information Group */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 tracking-wide mb-4 ml-1">
            Personal Information
          </h3>
          <div className="space-y-4">
            {/* First Name & Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                  First name
                </label>
                <input
                  type="text"
                  name="first_name"
                  readOnly={!isEditing}
                  value={isEditing ? formData.first_name : (profile?.first_name || "-")}
                  onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                  className={`input-field font-semibold text-slate-800 ${
                    !isEditing ? "cursor-default" : "bg-white border border-slate-200 focus:border-slate-400"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                  Last name
                </label>
                <input
                  type="text"
                  name="last_name"
                  readOnly={!isEditing}
                  value={isEditing ? formData.last_name : (profile?.last_name || "-")}
                  onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                  className={`input-field font-semibold text-slate-800 ${
                    !isEditing ? "cursor-default" : "bg-white border border-slate-200 focus:border-slate-400"
                  }`}
                />
              </div>
            </div>

            {/* Gender & Date of Birth */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                  Gender
                </label>
                {isEditing ? (
                  <CustomSelect
                    value={formData.gender}
                    onChange={(val) => setFormData((prev) => ({ ...prev, gender: val }))}
                    options={[
                      { label: "Male", value: "Male" },
                      { label: "Female", value: "Female" },
                      { label: "Other", value: "Other" },
                    ]}
                  />
                ) : (
                  <input
                    type="text"
                    readOnly
                    value={profile?.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1).toLowerCase() : "-"}
                    className="input-field cursor-default font-semibold text-slate-800"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                  Date of Birth
                </label>
                {isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsDobModalOpen(true)}
                    className="input-field flex items-center justify-between text-left cursor-pointer w-full bg-white border border-slate-200"
                  >
                    <span className={formData.date_of_birth ? "text-slate-800 font-semibold text-sm" : "text-slate-400 text-sm"}>
                      {formData.date_of_birth ? formatDate(formData.date_of_birth) : "Select DOB"}
                    </span>
                    <span className="material-symbols-outlined text-sm text-slate-500">calendar_today</span>
                  </button>
                ) : (
                  <input
                    type="text"
                    readOnly
                    value={profile?.date_of_birth ? formatDate(profile.date_of_birth) : "-"}
                    className="input-field cursor-default font-semibold text-slate-800"
                  />
                )}
              </div>
            </div>

            {/* Username & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  readOnly={!isEditing}
                  value={isEditing ? formData.username : (profile?.username || "-")}
                  onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                  className={`input-field font-semibold text-slate-800 ${
                    !isEditing ? "cursor-default" : "bg-white border border-slate-200 focus:border-slate-400"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                  Email address
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    name="email"
                    readOnly={!isEditing}
                    value={isEditing ? formData.email : (profile?.email || "-")}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className={`input-field font-semibold text-slate-800 pr-10 ${
                      !isEditing ? "cursor-default" : "bg-white border border-slate-200 focus:border-slate-400"
                    }`}
                  />
                  {profile?.email && !isEditing && (
                    <span className="material-symbols-outlined text-base text-emerald-500 absolute right-3 pointer-events-none" title="Verified Email">
                      verified
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                Phone number
              </label>
              <input
                type="text"
                name="phone_number"
                readOnly={!isEditing}
                value={isEditing ? formData.phone_number : (profile?.phone_number || "-")}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone_number: e.target.value }))}
                className={`input-field font-semibold text-slate-800 ${
                  !isEditing ? "cursor-default" : "bg-white border border-slate-200 focus:border-slate-400"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Address & Location Group */}
        <div className="pt-2">
          <h3 className="text-xs font-bold text-slate-400 tracking-wide mb-4 ml-1">
            Address & Location
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                City
              </label>
              <input
                type="text"
                name="city"
                readOnly={!isEditing}
                value={isEditing ? formData.city : (profile?.city || "-")}
                onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                className={`input-field font-semibold text-slate-800 ${
                  !isEditing ? "cursor-default" : "bg-white border border-slate-200 focus:border-slate-400"
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                State
              </label>
              <input
                type="text"
                name="state"
                readOnly={!isEditing}
                value={isEditing ? formData.state : (profile?.state || "-")}
                onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                className={`input-field font-semibold text-slate-800 ${
                  !isEditing ? "cursor-default" : "bg-white border border-slate-200 focus:border-slate-400"
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                Country
              </label>
              <input
                type="text"
                name="country"
                readOnly={!isEditing}
                value={isEditing ? formData.country : (profile?.country || "-")}
                onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                className={`input-field font-semibold text-slate-800 ${
                  !isEditing ? "cursor-default" : "bg-white border border-slate-200 focus:border-slate-400"
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      <SingleDatePickerModal
        isOpen={isDobModalOpen}
        onClose={() => setIsDobModalOpen(false)}
        selectedDate={formData.date_of_birth}
        onSelectDate={(date) => {
          setFormData((prev) => ({ ...prev, date_of_birth: date }));
          setIsDobModalOpen(false);
        }}
      />
    </div>
  );
}
