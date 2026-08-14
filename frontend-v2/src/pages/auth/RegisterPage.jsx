import { useState, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { registerUser } from "@/store/authSlice";
import toast from "react-hot-toast";
import CustomSelect from "@/components/ui/CustomSelect";
import SingleDatePickerModal from "@/components/ui/SingleDatePickerModal";
import { formatDisplayDate } from "@/components/ui/DatePickerModal";
import { PASSWORD_RULES } from "@/utils/validators";

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);

  const fromDestination = location.state?.from;

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    gender: "Male",
    date_of_birth: "",
    username: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isDobModalOpen, setIsDobModalOpen] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Input Refs for Auto-Focus
  const inputRefs = {
    first_name: useRef(null),
    last_name: useRef(null),
    date_of_birth: useRef(null),
    username: useRef(null),
    email: useRef(null),
    password: useRef(null),
    confirm_password: useRef(null),
  };

  const genderOptions = [
    { label: "Male", value: "Male" },
    { label: "Female", value: "Female" },
    { label: "Other", value: "Other" },
  ];

  // Age Calculator
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

  // Password Live Strength Criteria Checks
  const passwordRules = PASSWORD_RULES.map(rule => ({
    ...rule,
    met: rule.test(formData.password)
  }));

  const isPasswordStrong = passwordRules.every((rule) => rule.met);

  // Show requirements while typing and not yet complete; hide immediately once all rules pass
  const showPasswordRequirements =
    !isPasswordStrong && (isPasswordFocused || formData.password.length > 0);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // First and last name: only alphabets, max 20 chars
    if (name === "first_name" || name === "last_name") {
      if (value.length > 20) return;
      if (value !== "" && !/^[a-zA-Z]+$/.test(value)) return;
    }

    // Username: max 20 chars
    if (name === "username" && value.length > 20) {
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    if (name === "password") {
      setIsPasswordFocused(false);
    }
  };

  const handlePasswordFocus = () => {
    setIsPasswordFocused(true);
  };

  // Field validation rules
  const getFieldError = (name) => {
    if (!touched[name] && !formData[name]) return "";

    switch (name) {
      case "first_name":
        if (!formData.first_name.trim()) return "First name is required";
        if (!/^[a-zA-Z]+$/.test(formData.first_name)) return "Only alphabets are allowed";
        break;

      case "last_name":
        if (!formData.last_name.trim()) return "Last name is required";
        if (!/^[a-zA-Z]+$/.test(formData.last_name)) return "Only alphabets are allowed";
        break;

      case "date_of_birth": {
        if (!formData.date_of_birth) return "Date of birth is required";
        const age = calculateAge(formData.date_of_birth);
        if (age < 18) return "You must be at least 18 years old to register";
        break;
      }

      case "username":
        if (!formData.username.trim()) return "Username is required";
        if (formData.username.startsWith("_")) return "Cannot start with an underscore";
        if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) return "Only letters, numbers, and underscores allowed";
        if (formData.username.length < 3) return "Must be at least 3 characters";
        break;

      case "email":
        if (!formData.email.trim()) return "Email is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return "Invalid email address";
        break;

      case "password":
        if (!formData.password) return "Password is required";
        if (!isPasswordStrong) return "Please fulfill all password requirements";
        break;

      case "confirm_password":
        if (!formData.confirm_password) return "Please confirm password";
        if (formData.confirm_password !== formData.password) return "Passwords do not match";
        break;

      default:
        return "";
    }
    return "";
  };

  const errors = {
    first_name: getFieldError("first_name"),
    last_name: getFieldError("last_name"),
    date_of_birth: getFieldError("date_of_birth"),
    username: getFieldError("username"),
    email: getFieldError("email"),
    password: getFieldError("password"),
    confirm_password: getFieldError("confirm_password"),
  };

  const isPasswordMatched =
    formData.confirm_password !== "" && formData.confirm_password === formData.password;

  const userAge = calculateAge(formData.date_of_birth);

  const isFormValid =
    formData.first_name.trim() !== "" &&
    formData.last_name.trim() !== "" &&
    formData.date_of_birth !== "" &&
    userAge >= 18 &&
    formData.username.trim() !== "" &&
    !formData.username.startsWith("_") &&
    formData.email.trim() !== "" &&
    isPasswordStrong &&
    formData.confirm_password !== "" &&
    isPasswordMatched &&
    !Object.values(errors).some((err) => err !== "");

  // Focus first invalid element
  const focusFirstInvalidField = () => {
    const fieldOrder = [
      "first_name",
      "last_name",
      "date_of_birth",
      "username",
      "email",
      "password",
      "confirm_password",
    ];

    for (const field of fieldOrder) {
      let isInvalid = false;

      if (field === "first_name" && (!formData.first_name.trim() || !/^[a-zA-Z]+$/.test(formData.first_name))) {
        isInvalid = true;
      } else if (field === "last_name" && (!formData.last_name.trim() || !/^[a-zA-Z]+$/.test(formData.last_name))) {
        isInvalid = true;
      } else if (field === "date_of_birth" && (!formData.date_of_birth || calculateAge(formData.date_of_birth) < 18)) {
        isInvalid = true;
      } else if (field === "username" && (!formData.username.trim() || formData.username.startsWith("_") || !/^[a-zA-Z0-9_]+$/.test(formData.username) || formData.username.length < 3)) {
        isInvalid = true;
      } else if (field === "email" && (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))) {
        isInvalid = true;
      } else if (field === "password" && (!formData.password || !isPasswordStrong)) {
        isInvalid = true;
      } else if (field === "confirm_password" && (!formData.confirm_password || formData.confirm_password !== formData.password)) {
        isInvalid = true;
      }

      if (isInvalid) {
        if (field === "date_of_birth") {
          setIsDobModalOpen(true);
        } else if (inputRefs[field]?.current) {
          inputRefs[field].current.focus();
        }
        break;
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({
      first_name: true,
      last_name: true,
      date_of_birth: true,
      username: true,
      email: true,
      password: true,
      confirm_password: true,
    });

    if (!isFormValid) {
      focusFirstInvalidField();
      return;
    }

    try {
      const payload = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        password: formData.password,
      };

      const resultAction = await dispatch(registerUser(payload));

      if (registerUser.fulfilled.match(resultAction)) {
        toast.success("Account created successfully! Please sign in.");
        navigate("/login", { state: { from: fromDestination } });
      } else {
        const errorMsg = resultAction.payload || "Registration failed";
        toast.error(errorMsg);
      }
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-12 mt-16 bg-slate-50/60">

      {/* Sky-themed Soft Ambient Aesthetic Blobs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-sky-200/50 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 -right-20 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-72 h-72 bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 text-center mb-4">
        <h2 className="text-xl font-bold text-slate-800">Create an Account</h2>
      </div>

      {/* Container Card */}
      <div className="relative z-10 w-full max-w-lg rounded-3xl p-8 sm:px-10 animate-fade-in plain-card">

        {/* Back to Sign In Header */}
        <div className="mb-4">
          <Link
            to="/login"
            state={{ from: fromDestination }}
            className="inline-flex items-center gap-2 text-slate-600 font-semibold text-xs hover:text-slate-900 transition-colors mb-3"
          >
            <span className="material-symbols-outlined text-xs select-none">arrow_back</span>
            Back to Sign In
          </Link>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* First & Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                First name
              </label>
              <input
                ref={inputRefs.first_name}
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="First name"
                className="input-field"
              />
              {errors.first_name && (
                <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                  <p className="field-error ml-2">{errors.first_name}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                Last name
              </label>
              <input
                ref={inputRefs.last_name}
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Last name"
                className="input-field"
              />
              {errors.last_name && (
                <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                  <p className="field-error ml-2">{errors.last_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Gender & Date of Birth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                Gender
              </label>
              <CustomSelect
                value={formData.gender}
                onChange={(val) => setFormData((prev) => ({ ...prev, gender: val }))}
                options={genderOptions}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                Date of Birth
              </label>
              <button
                ref={inputRefs.date_of_birth}
                type="button"
                onClick={() => setIsDobModalOpen(true)}
                className="input-field flex items-center justify-between text-left cursor-pointer w-full"
              >
                <span className={formData.date_of_birth ? "text-slate-800 font-semibold" : "text-slate-400"}>
                  {formData.date_of_birth ? formatDisplayDate(formData.date_of_birth) : "Select DOB"}
                </span>
                <span className="material-symbols-outlined text-sm text-slate-500">calendar_today</span>
              </button>
              {errors.date_of_birth && (
                <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                  <p className="field-error ml-2">{errors.date_of_birth}</p>
                </div>
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
                ref={inputRefs.username}
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Choose username"
                className="input-field"
              />
              {errors.username && (
                <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                  <p className="field-error ml-2">{errors.username}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
                Email
              </label>
              <input
                ref={inputRefs.email}
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="your@email.com"
                className="input-field"
              />
              {errors.email && (
                <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                  <p className="field-error ml-2">{errors.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Password with Collapsible Vertical Live Strength Checklist */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                ref={inputRefs.password}
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onFocus={handlePasswordFocus}
                onBlur={handleBlur}
                placeholder="Create a strong password"
                className="input-field"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none"
              >
                <span className="material-symbols-outlined text-sm">
                  {showPassword ? "visibility_off" : "visibility"}
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

            {errors.password && touched.password && !isPasswordStrong && !showPasswordRequirements && (
              <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                <p className="field-error ml-2">{errors.password}</p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 ml-2">
              Confirm Password
            </label>
            <div className="relative flex items-center">
              <input
                ref={inputRefs.confirm_password}
                type={showConfirmPassword ? "text" : "password"}
                name="confirm_password"
                value={formData.confirm_password}
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
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showConfirmPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>
            {errors.confirm_password && (
              <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                <p className="field-error ml-2">{errors.confirm_password}</p>
              </div>
            )}
          </div>

          {/* Create Account Button */}
          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-5 py-2 rounded-xl text-sm"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </button>
          </div>

        </form>

        {/* Footer Link */}
        <div className="mt-8 text-center pt-5 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500">
            Already have an account?{" "}
            <Link to="/login" state={{ from: fromDestination }} className="text-slate-900 font-bold hover:underline transition-all">
              Sign In
            </Link>
          </p>
        </div>

      </div>

      {/* Date of Birth Picker Modal */}
      <SingleDatePickerModal
        isOpen={isDobModalOpen}
        onClose={() => setIsDobModalOpen(false)}
        initialDate={formData.date_of_birth}
        title="Select Date of Birth"
        onSelectDate={(dateStr) => {
          setFormData((prev) => ({ ...prev, date_of_birth: dateStr }));
          setTouched((prev) => ({ ...prev, date_of_birth: true }));
        }}
      />
    </div>
  );
}
