export default function LogoutConfirmModal({ isAdmin, onConfirm, onCancel }) {
  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-fade-in bg-black/35 backdrop-blur-[6px]" 
      onClick={onCancel}
    >
      {/* Modal Card */}
      <div
        className="relative bg-white rounded-3xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-slide-up p-7 flex flex-col items-center text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl text-rose-500">logout</span>
        </div>

        <h2 className="text-lg font-bold text-slate-900 mb-1">Sign out?</h2>
        <p className="text-sm text-slate-500 mb-6">
          You'll need to sign in again to access{" "}
          {isAdmin ? "the admin workspace" : "your account"}.
        </p>

        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all cursor-pointer active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold transition-all cursor-pointer active:scale-95 shadow-md shadow-rose-500/20"
          >
            Yes, sign out
          </button>
        </div>
      </div>
    </div>
  );
}
