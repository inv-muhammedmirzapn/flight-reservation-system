import React, { useState, useEffect } from 'react';

export default function SeatHoldTimer({ expiresAt, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    const targetTime = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0 && onExpire) {
        onExpire();
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);

    return () => clearInterval(timerId);
  }, [expiresAt, onExpire]);

  if (timeLeft <= 0) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isUrgent = timeLeft < 120; // less than 2 minutes

  return (
    <div
      className={`mb-6 p-3 sm:p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between shadow-sm ${
        isUrgent
          ? 'bg-rose-50 border-rose-200 text-rose-900 animate-pulse'
          : 'bg-amber-50/90 border-amber-200 text-amber-900'
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            isUrgent ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
          }`}
        >
          <span className="material-symbols-outlined text-lg sm:text-xl">timer</span>
        </div>
        <div>
          <p className="text-xs sm:text-sm font-bold">Seats Temporarily Reserved</p>
          <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
            Complete your booking before hold expires
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className={`font-mono text-sm sm:text-base font-bold px-3 py-1 rounded-xl shadow-inner ${
            isUrgent
              ? 'bg-rose-200/70 text-rose-950'
              : 'bg-amber-200/70 text-amber-950'
          }`}
        >
          {formattedTime}
        </span>
      </div>
    </div>
  );
}
