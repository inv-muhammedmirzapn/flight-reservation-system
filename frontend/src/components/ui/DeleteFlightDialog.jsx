import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

/**
 * DeleteFlightDialog
 * Confirmation dialog before deleting a flight.
 * Identical style, structure and animations to LogoutConfirmDialog.
 * Only differences: trash icon, copy, and a dark confirm button (matching
 * the "Save" button in the admin panel) instead of gold.
 *
 * Props:
 *   open         – boolean
 *   flightNumber – string, e.g. "AI-202"
 *   airline      – string, e.g. "Air India"
 *   loading      – boolean, true while the API call is in-flight
 *   onConfirm    – () => void
 *   onCancel     – () => void
 */
export function DeleteFlightDialog({ open, flightNumber, airline, loading, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const { t } = useTranslation();

  /* Focus-trap & ESC key — identical to LogoutConfirmDialog */
  useEffect(() => {
    if (!open) return;

    const handleKey = (e) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    document.addEventListener("keydown", handleKey);
    dialogRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return createPortal(
    <>
      {/* ── Backdrop — identical to LogoutConfirmDialog ── */}
      <div
        onClick={() => !loading && onCancel()}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10, 10, 15, 0.55)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 9998,
          animation: "lgBackdropIn 0.25s ease forwards",
        }}
      />

      {/* ── Dialog card — identical geometry to LogoutConfirmDialog ── */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dfd-title"
        aria-describedby="dfd-desc"
        tabIndex={-1}
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "26rem",
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(32px)",
            WebkitBackdropFilter: "blur(32px)",
            border: "1px solid rgba(255,255,255,0.75)",
            borderRadius: "1.5rem",
            boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.9) inset",
            padding: "2rem 1.75rem 1.75rem",
            animation: "lgPopIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards",
            outline: "none",
          }}
        >
          {/* ── Icon — gold circle, same as logout ── */}
          <div
            style={{
              width: "3.5rem",
              height: "3.5rem",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)",
              border: "1.5px solid rgba(255,215,0,0.35)",
              boxShadow: "0 4px 16px rgba(255,215,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.25rem",
            }}
          >
            {/* Trash icon, amber stroke matching the door icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </div>

          {/* ── Heading — identical style to LogoutConfirmDialog ── */}
          <h2
            id="dfd-title"
            style={{
              margin: "0 0 0.5rem",
              fontSize: "1.2rem",
              fontWeight: 700,
              color: "#1a1c1d",
              textAlign: "center",
              letterSpacing: "-0.01em",
            }}
          >
            {t("admin.delete.title", { defaultValue: 'Delete Flight?' })}
          </h2>

          {/* ── Body copy — identical style ── */}
          <p
            id="dfd-desc"
            style={{
              margin: "0 0 1.75rem",
              fontSize: "0.9rem",
              color: "#6b7280",
              textAlign: "center",
              lineHeight: 1.5,
            }}
            dangerouslySetInnerHTML={{
              __html: t("admin.delete.desc", {
                flightNumber: `<strong style="color: #1a1c1d">${flightNumber}</strong>`,
                airline: airline ? `<strong style="color: #1a1c1d">${airline}</strong>` : '',
                defaultValue: `You are about to permanently delete <strong style="color: #1a1c1d">${airline ? `${airline} flight ` : "flight "}${flightNumber}</strong>. This action cannot be undone.`
              })
            }}
          />

          {/* ── Actions — identical layout to LogoutConfirmDialog ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>

            {/* Confirm — gold CTA matching LogoutConfirmDialog */}
            <button
              id="delete-flight-confirm-btn"
              onClick={onConfirm}
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.875rem",
                background: loading ? "rgba(255,215,0,0.5)" : "#ffd700",
                color: "#1a1c1d",
                fontWeight: 700,
                fontSize: "0.95rem",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 14px rgba(255,215,0,0.45)",
                transition: "transform 0.15s, box-shadow 0.15s, background 0.15s",
                letterSpacing: "0.01em",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(255,215,0,0.55)";
                  e.currentTarget.style.background = "#ffe033";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = loading ? "none" : "0 4px 14px rgba(255,215,0,0.45)";
                e.currentTarget.style.background = loading ? "rgba(255,215,0,0.5)" : "#ffd700";
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 15,
                    height: 15,
                    border: "2px solid rgba(26,28,29,0.3)",
                    borderTopColor: "#1a1c1d",
                    borderRadius: "50%",
                    animation: "spin 0.75s linear infinite",
                  }} />
                  {t("admin.delete.deleting", { defaultValue: 'Deleting...' })}
                </>
              ) : t("admin.delete.yes", { defaultValue: 'Yes, Delete Flight' })}
            </button>

            {/* Cancel — identical ghost button to LogoutConfirmDialog */}
            <button
              id="delete-flight-cancel-btn"
              onClick={onCancel}
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.875rem",
                background: "rgba(0,0,0,0.05)",
                color: "#374151",
                fontWeight: 600,
                fontSize: "0.95rem",
                border: "1.5px solid rgba(0,0,0,0.08)",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s, border-color 0.15s",
                opacity: loading ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = "rgba(0,0,0,0.09)";
                  e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0,0,0,0.05)";
                e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)";
              }}
            >
              {t("admin.delete.cancel", { defaultValue: 'Cancel' })}
            </button>
          </div>
        </div>
      </div>

      {/* ── Keyframes — same names as LogoutConfirmDialog so they share the rule ── */}
      <style>{`
        @keyframes lgBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes lgPopIn {
          from {
            opacity: 0;
            transform: scale(0.82) translateY(16px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>,
    document.body
  );
}
