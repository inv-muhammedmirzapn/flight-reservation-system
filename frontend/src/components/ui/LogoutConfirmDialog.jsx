import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

/**
 * LogoutConfirmDialog
 * A glassmorphism pop-up dialog that asks the user to confirm logout.
 * Matches the Passenger theme: gold accents, frosted glass, dark overlay.
 *
 * Props:
 *   open     – boolean, whether the dialog is visible
 *   onConfirm – () => void, called when "Sign Out" is confirmed
 *   onCancel  – () => void, called when "Cancel" is chosen
 */
export function LogoutConfirmDialog({ open, onConfirm, onCancel }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);

  /* Focus-trap & ESC key */
  useEffect(() => {
    if (!open) return;

    const handleKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);

    /* Shift focus to dialog so ESC works without clicking */
    dialogRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onCancel}
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

      {/* ── Dialog card ── */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-desc"
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
            maxWidth: "22rem",
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(32px)",
            WebkitBackdropFilter: "blur(32px)",
            border: "1px solid rgba(255,255,255,0.75)",
            borderRadius: "1.5rem",
            boxShadow:
              "0 24px 64px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.9) inset",
            padding: "2rem 1.75rem 1.75rem",
            animation: "lgPopIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards",
            outline: "none",
          }}
        >
          {/* ── Icon ── */}
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>

          {/* ── Heading ── */}
          <h2
            id="logout-title"
            style={{
              margin: "0 0 0.5rem",
              fontSize: "1.2rem",
              fontWeight: 700,
              color: "#1a1c1d",
              textAlign: "center",
              letterSpacing: "-0.01em",
            }}
          >
            {t("auth.signOutPrompt")}
          </h2>

          {/* ── Body copy ── */}
          <p
            id="logout-desc"
            style={{
              margin: "0 0 1.75rem",
              fontSize: "0.9rem",
              color: "#6b7280",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {t("auth.signOutDesc")}
          </p>

          {/* ── Actions ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {/* Confirm — gold CTA matching theme */}
            <button
              id="logout-confirm-btn"
              onClick={onConfirm}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.875rem",
                background: "#ffd700",
                color: "#1a1c1d",
                fontWeight: 700,
                fontSize: "0.95rem",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(255,215,0,0.45)",
                transition: "transform 0.15s, box-shadow 0.15s, background 0.15s",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(255,215,0,0.55)";
                e.currentTarget.style.background = "#ffe033";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(255,215,0,0.45)";
                e.currentTarget.style.background = "#ffd700";
              }}
            >
              {t("auth.yesSignOut")}
            </button>

            {/* Cancel — ghost */}
            <button
              id="logout-cancel-btn"
              onClick={onCancel}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.875rem",
                background: "rgba(0,0,0,0.05)",
                color: "#374151",
                fontWeight: 600,
                fontSize: "0.95rem",
                border: "1.5px solid rgba(0,0,0,0.08)",
                cursor: "pointer",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0,0,0,0.09)";
                e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0,0,0,0.05)";
                e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)";
              }}
            >
              {t("auth.cancel")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Keyframes ── */}
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
