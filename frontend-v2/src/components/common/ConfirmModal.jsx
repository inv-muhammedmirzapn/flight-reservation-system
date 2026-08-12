import { createPortal } from "react-dom";

export default function ConfirmModal({
  isOpen = true,
  title,
  description,
  icon = "warning",
  variant = "warning", // "warning" | "danger" | "primary"
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  children,
}) {
  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const variantStyles = {
    warning: {
      badge: "bg-amber-50 border-amber-200/80 text-amber-600",
      confirmBtn: "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white",
    },
    danger: {
      badge: "bg-rose-50 border-rose-100 text-rose-500",
      confirmBtn: "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20 text-white",
    },
    primary: {
      badge: "bg-slate-100 border-slate-200 text-slate-900",
      confirmBtn: "btn-primary text-slate-950",
    },
  }[variant] || {
    badge: "bg-amber-50 border-amber-200/80 text-amber-600",
    confirmBtn: "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white",
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Icon Badge */}
        {icon && (
          <div className={`modal-icon-badge ${variantStyles.badge} border`}>
            <span className="material-symbols-outlined text-3xl">{icon}</span>
          </div>
        )}

        {/* Title & Description */}
        {title && (
          <h2 className="text-xl font-bold text-slate-950 mb-2">
            {title}
          </h2>
        )}
        {description && (
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {description}
          </p>
        )}

        {/* Custom Children */}
        {children}

        {/* Action Buttons */}
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={onCancel}
            className="modal-btn-cancel"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`modal-btn-confirm ${variantStyles.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
