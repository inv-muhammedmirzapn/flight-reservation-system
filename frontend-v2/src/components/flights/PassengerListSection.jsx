import React from "react";

export default function PassengerListSection({ passengers, onChangePassengers }) {
  const handleAddPassenger = () => {
    const updated = [
      ...passengers,
      { id: Date.now(), name: "", age: "", gender: "Male" }
    ];
    onChangePassengers(updated);
  };

  const handleRemovePassenger = (index) => {
    if (passengers.length <= 1) return;
    const updated = passengers.filter((_, i) => i !== index);
    onChangePassengers(updated);
  };

  const handleFieldChange = (index, field, value) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    onChangePassengers(updated);
  };

  return (
    <div className="booking-container-card space-y-4">
      <h3 className="text-xl font-extrabold text-slate-950 tracking-tight">
        Add Passengers
      </h3>

      {/* Passenger List Cards */}
      <div className="space-y-3">
        {passengers.map((passenger, index) => (
          <div
            key={passenger.id || index}
            className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xs border border-slate-100/60 relative"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700">
                Passenger {index + 1}
              </span>
              {passengers.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemovePassenger(index)}
                  className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                  title="Remove passenger"
                >
                  <span className="material-symbols-outlined text-base font-bold">close</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Name Field */}
              <div className="sm:col-span-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={passenger.name}
                  onChange={(e) => handleFieldChange(index, "name", e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Age Field */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Age
                </label>
                <input
                  type="number"
                  placeholder="e.g. 28"
                  min="1"
                  max="120"
                  value={passenger.age}
                  onChange={(e) => handleFieldChange(index, "age", e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Gender Field */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Gender
                </label>
                <select
                  value={passenger.gender}
                  onChange={(e) => handleFieldChange(index, "gender", e.target.value)}
                  className="input-field cursor-pointer"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Passenger Action */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleAddPassenger}
          className="text-sky-600 hover:text-sky-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
        >
          <span>+ Add New Passenger</span>
        </button>
      </div>
    </div>
  );
}
