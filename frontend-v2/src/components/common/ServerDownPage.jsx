import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { checkServerHealth } from "@/store/systemSlice";

export default function ServerDownPage() {
  const dispatch = useDispatch();
  const { isCheckingHealth } = useSelector((state) => state.system);

  const [countdown, setCountdown] = useState(5);

  const handleManualRetry = () => {
    setCountdown(5);
    dispatch(checkServerHealth());
  };

  useEffect(() => {
    // Perform an initial health check on mount
    dispatch(checkServerHealth());

    // Countdown interval (1s)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          dispatch(checkServerHealth());
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [dispatch]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-slate-50/90 backdrop-blur-md animate-fade-in">
      {/* Soft Ambient Blobs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-rose-200/40 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 -right-20 w-96 h-96 bg-amber-200/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-72 h-72 bg-sky-200/50 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glass Card */}
      <div className="relative z-10 w-full max-w-lg rounded-3xl p-8 sm:p-10 text-center plain-card shadow-2xl space-y-6 border border-slate-200/80">
        
        {/* Offline Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto border border-amber-300/40 shadow-xs">
          <span className="material-symbols-outlined text-4xl select-none animate-bounce">
            cloud_off
          </span>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950">
            Server Connection Lost
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
            Our backend service is currently unreachable or undergoing maintenance. We’ll have everything back online shortly.
          </p>
        </div>

        {/* Status Indicator & Timer */}
        <div className="bg-slate-100/80 rounded-2xl p-4 flex items-center justify-between gap-3 text-left border border-slate-200/60">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-800">Automatic Reconnect</p>
              <p className="text-[10px] text-slate-500 font-medium">
                {isCheckingHealth ? "Checking server status..." : `Retrying in ${countdown} seconds`}
              </p>
            </div>
          </div>

          <span className={`material-symbols-outlined text-lg text-slate-400 ${isCheckingHealth ? "animate-spin text-amber-600" : ""}`}>
            refresh
          </span>
        </div>

        {/* Action Button */}
        <div>
          <button
            type="button"
            onClick={handleManualRetry}
            disabled={isCheckingHealth}
            className="w-full btn-primary text-slate-950 text-xs font-extrabold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-base ${isCheckingHealth ? "animate-spin" : ""}`}>
              sync
            </span>
            <span>{isCheckingHealth ? "Connecting..." : "Check Connection Now"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
