import { Loader2 } from 'lucide-react';

export default function PageLoader({ label = 'Loading...', fullScreen = false }) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-50/90 backdrop-blur-sm flex flex-col justify-center items-center">
        <Loader2 size={48} className="animate-spin text-[#705d00] mb-4" />
        <div className="text-base font-semibold text-slate-800">{label}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col justify-center items-center p-8 w-full min-h-[200px]">
      <Loader2 size={32} className="animate-spin text-[#705d00] mb-3" />
      <div className="text-sm font-semibold text-slate-500">{label}</div>
    </div>
  );
}
