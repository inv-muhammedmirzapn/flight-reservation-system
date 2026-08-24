import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { profileAPI } from "@/services/profile-service/profileService";
import { updateProfileSuccess } from "@/store/authSlice";
import toast from "react-hot-toast";
import { handleApiError, logError } from "@/utils/errorUtils";
import CustomSelect from "@/components/ui/CustomSelect";
import SingleDatePickerModal from "@/components/ui/SingleDatePickerModal";
import ChangePasswordModal from "@/components/ui/ChangePasswordModal";
import countriesData from "../../../resources/countries.json";

const formatGender = (genderStr) => {
  if (!genderStr) return "Male";
  const upper = genderStr.toUpperCase();
  if (upper === "FEMALE") return "Female";
  if (upper === "OTHER") return "Other";
  return "Male";
};

const getDialCode = (countryName) => {
  if (!countryName) return "+91";
  const match = countriesData.find(
    (c) => c.name.toLowerCase() === countryName.toLowerCase()
  );
  return match ? match.dial_code : "+91";
};

const extractLocalPhone = (fullPhoneStr, countryName) => {
  if (!fullPhoneStr) return "";
  const dialCode = getDialCode(countryName);
  if (dialCode && fullPhoneStr.startsWith(dialCode)) {
    return fullPhoneStr.substring(dialCode.length).trim();
  }
  if (fullPhoneStr.startsWith("+")) {
    const spaceIdx = fullPhoneStr.indexOf(" ");
    if (spaceIdx !== -1) {
      return fullPhoneStr.substring(spaceIdx + 1).trim();
    }
  }
  return fullPhoneStr;
};

export default function UserProfilePage() {
  const dispatch = useDispatch();
  const auth = useSelector((state) => state?.auth) || {};
  const { profile: reduxProfile, isInitializing } = auth;

  const [profile, setLocalProfile] = useState(reduxProfile || null);
  const [loading, setLoading] = useState(!reduxProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDobModalOpen, setIsDobModalOpen] = useState(false);
  const [dobError, setDobError] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

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

  // Sync local profile state from Redux whenever:
  //  - fetchProfile resolves (initial page load / hard refresh)
  //  - updateProfileSuccess fires (after a save — profile in Redux updates)
  //  - isInitializing flips to false (ensures loading clears even if profile is null)
  useEffect(() => {
    if (reduxProfile) {
      setLocalProfile(reduxProfile);
    }
    if (!isInitializing) {
      setLoading(false);
    }
  }, [reduxProfile, isInitializing]);



  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        username: profile.username || "",
        email: profile.email || "",
        phone_number: extractLocalPhone(profile.phone_number, profile.country),
        gender: formatGender(profile.gender),
        date_of_birth: profile.date_of_birth || "",
        city: profile.city || "",
        state: profile.state || "",
        country: profile.country || "India",
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

  const calculateAge = (dobString) => {
    if (!dobString) return 0;
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getDobError = (dobString) => {
    if (!dobString) return "";
    const birthDate = new Date(dobString);
    const today = new Date();
    if (birthDate > today) {
      return "Date of birth cannot be in the future.";
    }
    const age = calculateAge(dobString);
    if (age < 18) {
      return "You must be at least 18 years old.";
    }
    if (age > 120) {
      return "Please enter a valid date of birth.";
    }
    return "";
  };

  const countryOptions = countriesData.map((c) => ({
    label: `${c.name} (${c.dial_code})`,
    value: c.name,
  }));

  const handleCountryChange = (selectedCountryName) => {
    setFormData((prev) => ({
      ...prev,
      country: selectedCountryName,
    }));
  };

  const currentLocalPhone = extractLocalPhone(profile?.phone_number, profile?.country);
  const hasChanges =
    Boolean(profile) &&
    (formData.first_name.trim() !== (profile.first_name || "") ||
      formData.last_name.trim() !== (profile.last_name || "") ||
      formData.gender !== formatGender(profile.gender) ||
      formData.date_of_birth !== (profile.date_of_birth || "") ||
      formData.city.trim() !== (profile.city || "") ||
      formData.state.trim() !== (profile.state || "") ||
      formData.country.trim() !== (profile.country || "") ||
      formData.phone_number.trim() !== (currentLocalPhone || ""));

  const handleCancel = () => {
    setDobError("");
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        username: profile.username || "",
        email: profile.email || "",
        phone_number: extractLocalPhone(profile.phone_number, profile.country),
        gender: formatGender(profile.gender),
        date_of_birth: profile.date_of_birth || "",
        city: profile.city || "",
        state: profile.state || "",
        country: profile.country || "India",
      });
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    const activeDobError = dobError || getDobError(formData.date_of_birth);
    if (activeDobError) {
      setDobError(activeDobError);
      return;
    }

    setSaving(true);
    try {
      const dialCode = getDialCode(formData.country);
      const fullPhoneNumber = formData.phone_number.trim()
        ? `${dialCode} ${formData.phone_number.trim()}`.trim()
        : "";

      const payload = {
        ...formData,
        gender: formData.gender ? formData.gender.toUpperCase() : "MALE",
        date_of_birth: formData.date_of_birth || null,
        phone_number: fullPhoneNumber,
      };
      const updated = await profileAPI.updateProfile(payload);
      
      setLocalProfile(updated);
      dispatch(updateProfileSuccess(updated));
      toast.success("Profile updated successfully!");
      setDobError("");
      setIsEditing(false);
    } catch (err) {
      logError('UserProfilePage/handleSave', err);
      handleApiError(err, { fallback: 'Failed to update profile. Please try again.' });
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

  const hasUsablePassword = profile?.has_usable_password !== false;

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-12 mt-12 bg-slate-50/60">
      {/* Sky-themed Soft Ambient Aesthetic Blobs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-sky-200/50 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 -right-20 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-72 h-72 bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />

      <h1 className="text-xl font-bold text-slate-950 w-full max-w-2xl mb-7 ml-5">
        Profile
      </h1>

      {/* Container Card */}
      <div className="relative z-10 w-full max-w-2xl rounded-3xl px-8 pt-3 pb-12 sm:px-10 animate-fade-in plain-card space-y-6">
        {/* Top-Right Edit / Action Buttons */}
        <div className="absolute top-6 right-6 sm:top-8 sm:right-8 flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="h-8 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all duration-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">key</span>
                <span className="hidden sm:inline">{hasUsablePassword ? "Update Password" : "Set Password"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="h-8 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all duration-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                <span>Edit</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="h-8 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="h-8 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#ffd600] hover:bg-yellow-400 text-black font-bold text-xs transition-all duration-200 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#ffd600]"
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
                  className={`input-field font-semibold text-slate-800 ${!isEditing ? "cursor-default" : "focus:border-slate-400"
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
                  className={`input-field font-semibold text-slate-800 ${!isEditing ? "cursor-default" : "focus:border-slate-400"
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
                  <div>
                    <button
                      type="button"
                      onClick={() => setIsDobModalOpen(true)}
                      className={`input-field flex items-center justify-between text-left cursor-pointer w-full border ${(dobError || getDobError(formData.date_of_birth)) ? "border-rose-400 focus:border-rose-500" : "border-slate-200"
                        }`}
                    >
                      <span className={formData.date_of_birth ? "text-slate-800 font-semibold text-sm" : "text-slate-400 text-sm"}>
                        {formData.date_of_birth ? formatDate(formData.date_of_birth) : "Select DOB"}
                      </span>
                      <span className="material-symbols-outlined text-sm text-slate-500">calendar_today</span>
                    </button>
                    {(dobError || getDobError(formData.date_of_birth)) && (
                      <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                        <p className="field-error ml-2">{dobError || getDobError(formData.date_of_birth)}</p>
                      </div>
                    )}
                  </div>
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
                className={`input-field font-semibold text-slate-800 ${!isEditing ? "cursor-default" : "focus:border-slate-400"
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
                className={`input-field font-semibold text-slate-800 ${!isEditing ? "cursor-default" : "focus:border-slate-400"
                  }`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                Country
              </label>
              {isEditing ? (
                <CustomSelect
                  value={formData.country}
                  onChange={handleCountryChange}
                  options={countryOptions}
                  placeholder="Select Country"
                />
              ) : (
                <input
                  type="text"
                  readOnly
                  value={profile?.country || "-"}
                  className="input-field cursor-default font-semibold text-slate-800"
                />
              )}
            </div>
          </div>
        </div>

        {/* Contact Details Group */}
        <div className="pt-2">
          <h3 className="text-xs font-bold text-slate-400 tracking-wide mb-4 ml-1">
            Contact Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                Phone number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={getDialCode(isEditing ? formData.country : profile?.country)}
                  className="input-field w-20 sm:w-16 text-center cursor-default bg-slate-100/90 font-bold text-slate-700 select-none flex-shrink-0"
                  title="Country Code (Auto-filled from selected Country)"
                />
                <input
                  type="text"
                  name="phone_number"
                  readOnly={!isEditing}
                  value={isEditing ? formData.phone_number : (extractLocalPhone(profile?.phone_number, profile?.country) || "-")}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      phone_number: e.target.value.replace(/[^0-9]/g, ""),
                    }))
                  }
                  placeholder="Enter phone number"
                  className={`input-field flex-1 font-semibold text-slate-800 ${!isEditing ? "cursor-default" : "focus:border-slate-400"
                    }`}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                Email address
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  name="email"
                  readOnly
                  value={profile?.email || "-"}
                  className="input-field font-semibold text-slate-800 pr-10 cursor-default"
                />
                {profile?.email && (
                  <span className="material-symbols-outlined text-base text-emerald-500 absolute right-3 pointer-events-none" title="Verified Email">
                    verified
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SingleDatePickerModal
        isOpen={isDobModalOpen}
        onClose={() => setIsDobModalOpen(false)}
        selectedDate={formData.date_of_birth}
        onSelectDate={(date) => {
          const err = getDobError(date);
          if (err) {
            setDobError(err);
          } else {
            setDobError("");
            setFormData((prev) => ({ ...prev, date_of_birth: date }));
          }
          setIsDobModalOpen(false);
        }}
      />

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        hasUsablePassword={hasUsablePassword}
      />
    </div>
  );
}
