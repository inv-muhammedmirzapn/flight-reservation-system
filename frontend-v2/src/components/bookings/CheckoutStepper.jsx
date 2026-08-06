import React from "react";

export default function CheckoutStepper({ currentStep, steps, onStepClick }) {
  const totalSteps = steps.length;
  const progressPercent =
    totalSteps > 1 ? ((currentStep - 1) / (totalSteps - 1)) * 100 : 0;

  return (
    <div className="w-full py-4 mb-4 animate-fade-in">
      <div className="relative flex items-center justify-between max-w-2xl mx-auto px-4">
        {/* Background Track Line Container (positioned between circle centers) */}
        <div className="absolute top-5 left-9 right-9 h-1.5 z-0">
          {/* Base Gray Track */}
          <div className="w-full h-full bg-slate-200 rounded-full" />
          {/* Active Progress Track */}
          <div
            className="absolute top-0 left-0 h-full bg-slate-900 rounded-full transition-all duration-500 ease-in-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step Nodes */}
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          const isClickable = !isActive && Boolean(onStepClick);

          return (
            <div
              key={step.id || idx}
              className={`flex flex-col items-center relative z-10 ${
                isClickable ? "cursor-pointer group" : ""
              }`}
              onClick={() => isClickable && onStepClick(stepNum)}
            >
              {/* Circle Node */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                  isCompleted
                    ? "bg-emerald-600 text-white shadow-sm ring-4 ring-emerald-100"
                    : isActive
                    ? "bg-slate-950 text-white ring-4 ring-slate-950/15 shadow-md scale-105"
                    : "bg-slate-200 text-slate-600 border-2 border-white"
                }`}
              >
                {isCompleted ? (
                  <span className="material-symbols-outlined text-lg font-bold">
                    check
                  </span>
                ) : (
                  <span>{stepNum}</span>
                )}
              </div>

              {/* Title below Node */}
              <div className="mt-3 text-center">
                <span
                  className={`text-xs block tracking-tight transition-colors ${
                    isActive
                      ? "text-slate-950 font-bold"
                      : isCompleted
                      ? "text-emerald-700 font-bold"
                      : "text-slate-500 font-medium"
                  }`}
                >
                  {step.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
