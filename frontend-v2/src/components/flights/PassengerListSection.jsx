import CustomSelect from "@/components/ui/CustomSelect";

export default function PassengerListSection({
  passengers = [],
  onChangePassengers,
  errors = {},
  inputRefs,
  onBlurField,
}) {
  const handleAddPassenger = () => {
    const updated = [
      ...passengers,
      { id: Date.now(), name: "", age: "", gender: "Male", phone_number: "" }
    ];
    onChangePassengers(updated);
  };

  const handleRemovePassenger = (index) => {
    if (passengers.length <= 1) return;
    const updated = passengers.filter((_, i) => i !== index);
    onChangePassengers(updated);
  };

  const handleNameChange = (index, rawValue) => {
    // Only alphabets and spaces allowed, max 40 chars
    const sanitized = rawValue.replace(/[^A-Za-z\s]/g, "").slice(0, 40);
    const updated = [...passengers];
    updated[index] = { ...updated[index], name: sanitized };
    onChangePassengers(updated, index, "name");
  };

  const handleAgeChange = (index, rawValue) => {
    // Only digits allowed
    let sanitized = rawValue.replace(/[^0-9]/g, "");
    if (sanitized !== "" && Number(sanitized) > 120) {
      sanitized = "120";
    }
    const updated = [...passengers];
    updated[index] = { ...updated[index], age: sanitized };
    onChangePassengers(updated, index, "age");
  };

  const handleGenderChange = (index, value) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], gender: value };
    onChangePassengers(updated, index, "gender");
  };

  const handlePhoneChange = (index, rawValue) => {
    const sanitized = rawValue.replace(/[^0-9+\s-]/g, "").slice(0, 15);
    const updated = [...passengers];
    updated[index] = { ...updated[index], phone_number: sanitized };
    onChangePassengers(updated, index, "phone_number");
  };

  return (
    <div className="booking-container-card space-y-4 animate-fade-in transition-all duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gray-200 text-gray-900 flex items-center justify-center font-bold shadow-xs">
          <span className="material-symbols-outlined text-xl">people</span>
        </div>
        <h3 className="text-xl font-bold text-slate-950">
          Add Passengers
        </h3>
      </div>

      {/* Passenger List Cards */}
      <div className="space-y-4">
        {passengers.map((passenger, index) => {
          const pErrors = errors[index] || {};

          return (
            <div
              key={passenger.id || index}
              style={{ zIndex: 50 - index }}
              className="relative timeline-card animate-fade-in transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-bold text-slate-700">
                  Passenger {index + 1}
                </span>
                {passengers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePassenger(index)}
                    className="text-slate-400 hover:text-rose-500 transition-all duration-200 p-1 cursor-pointer"
                    title="Remove passenger"
                  >
                    <span className="material-symbols-outlined text-xs font-bold">
                      close
                    </span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-start">
                {/* Name Field */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wider px-2">
                      Full Name
                    </label>
                    <span className="text-[9px] font-medium text-slate-400">
                      {passenger.name.length}/40
                    </span>
                  </div>
                  <input
                    ref={(el) => {
                      if (inputRefs && inputRefs.current) {
                        inputRefs.current[`${index}-name`] = el;
                      }
                    }}
                    type="text"
                    placeholder="e.g. John Doe"
                    maxLength={40}
                    value={passenger.name}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                    onBlur={() => onBlurField?.(index, "name")}
                    className={`input-field transition-all duration-200 ${
                      pErrors.name ? "border border-rose-400 bg-rose-50/20 focus:ring-1 focus:ring-rose-500" : ""
                    }`}
                  />
                  {pErrors.name && (
                    <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                      <p className="field-error ml-2">{pErrors.name}</p>
                    </div>
                  )}
                </div>

                {/* Age Field */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 tracking-wider block mb-1.5 px-2">
                    Age
                  </label>
                  <input
                    ref={(el) => {
                      if (inputRefs && inputRefs.current) {
                        inputRefs.current[`${index}-age`] = el;
                      }
                    }}
                    type="text"
                    placeholder="e.g. 28"
                    value={passenger.age}
                    onChange={(e) => handleAgeChange(index, e.target.value)}
                    onBlur={() => onBlurField?.(index, "age")}
                    className={`input-field transition-all duration-200 ${
                      pErrors.age ? "border border-rose-400 bg-rose-50/20 focus:ring-1 focus:ring-rose-500" : ""
                    }`}
                  />
                  {pErrors.age && (
                    <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                      <p className="field-error ml-2">{pErrors.age}</p>
                    </div>
                  )}
                </div>

                {/* Gender Custom Dropdown Field */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 tracking-wider block mb-1.5 px-2">
                    Gender
                  </label>
                  <CustomSelect
                    value={passenger.gender || "Male"}
                    onChange={(val) => handleGenderChange(index, val)}
                    options={["Male", "Female", "Other"]}
                    placeholder="Select Gender"
                    error={Boolean(pErrors.gender)}
                  />
                  {pErrors.gender && (
                    <div className="overflow-hidden transition-all duration-200 mt-1 animate-fade-in">
                      <p className="field-error ml-2">{pErrors.gender}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Phone Number (Optional) Field */}
              <div className="mt-3">
                <label className="text-[10px] font-bold text-slate-400 tracking-wider block mb-1.5 px-2">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={passenger.phone_number || ""}
                  onChange={(e) => handlePhoneChange(index, e.target.value)}
                  className="input-field transition-all duration-200"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Passenger Action Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleAddPassenger}
          className="text-sky-600 hover:text-sky-700 text-xs font-bold transition-all duration-200 cursor-pointer inline-flex items-center gap-1 hover:gap-1.5"
        >
          <span>+ Add New Passenger</span>
        </button>
      </div>
    </div>
  );
}
