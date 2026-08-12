import { Trash2, X } from 'lucide-react';

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Record",
  message = "Are you sure you want to delete this record? This action cannot be undone.",
  details = null,
  confirmText = "Delete",
  cancelText = "Cancel",
  loading = false
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm modal-backdrop-animate"
        onClick={loading ? undefined : onClose}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-admin-md bg-white p-6 shadow-2xl border border-admin-border modal-card-animate">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 rounded-lg p-1 text-admin-muted hover:bg-black/[0.04] hover:text-admin-ink transition-colors cursor-pointer border-none bg-transparent"
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center text-center mt-2">
          {/* Warning Icon Banner */}
          <div className="w-12 h-12 rounded-full bg-status-red-bg flex items-center justify-center text-status-red mb-4">
            <Trash2 size={24} />
          </div>
          
          <h3 className="text-lg font-bold text-admin-ink font-ui mb-2">
            {title}
          </h3>
          
          <p className="text-sm text-admin-muted font-ui mb-5 leading-relaxed">
            {message}
          </p>

          {/* Details Panel */}
          {details && (
            <div className="w-full bg-admin-bg border border-admin-border rounded-admin-sm p-4 mb-6 text-left font-ui text-admin-ink max-h-48 overflow-y-auto">
              <span className="font-bold text-admin-muted text-[11px] uppercase tracking-wider block mb-2.5">
                Record Info:
              </span>
              {typeof details === 'object' ? (
                <div className="flex flex-col gap-2">
                  {Object.entries(details).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center py-1 border-b border-black/[0.03] last:border-0">
                      <span className="text-admin-muted text-xs font-semibold uppercase">{key}:</span>
                      <span className="text-admin-ink text-sm font-bold">{String(val || '—')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-admin-ink text-sm font-bold">{details}</span>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 justify-end mt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="btn-secondary flex-1 sm:flex-none justify-center"
          >
            {cancelText}
          </button>
          
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="btn-danger flex-1 sm:flex-none justify-center gap-1.5"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-status-red border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {loading ? 'Deleting...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
