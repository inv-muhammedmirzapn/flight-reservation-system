import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// parseApiError(err, fallback?)
//
// Canonical error-message extractor for the entire frontend.
// Accepts any of:
//   • A JS Error object whose .message may be a plain string OR a
//     JSON-serialized API body (the shape fetchWithAuth produces).
//   • A plain object with DRF / custom-envelope fields.
//   • A raw string.
//   • null / undefined.
//
// Priority order:
//   1. Unwrap JSON-serialized .message strings (fetchWithAuth pattern)
//   2. Custom envelope: { message, errors }
//   3. DRF: detail, non_field_errors
//   4. First field-level error
//   5. .message (Error instance fallback)
//   6. fallback string
// ─────────────────────────────────────────────────────────────────────────────
export function parseApiError(err, fallback = 'An unexpected error occurred.') {
  if (!err) return fallback;

  // ── Plain string ──────────────────────────────────────────────────────────
  if (typeof err === 'string') return err || fallback;

  // ── JS Error – attempt to unwrap a JSON-serialised body ──────────────────
  if (err instanceof Error || (err.message && typeof err.message === 'string')) {
    const msg = err.message;
    if (msg === 'null') return 'An unexpected error occurred. Please check backend connection.';

    if (msg.startsWith('{') || msg.startsWith('[')) {
      try {
        const parsed = JSON.parse(msg);
        // Recurse with the parsed object (strips the Error wrapper)
        return parseApiError(parsed, fallback);
      } catch {
        // Not valid JSON – fall through to use msg as-is
      }
    }

    // Plain Error message (e.g. network error thrown by fetchWithAuth)
    if (msg) return msg;
  }

  // ── Object (DRF response body / custom envelope) ──────────────────────────
  if (typeof err === 'object') {
    // Custom envelope: { status: "error", message: "...", errors: { field: [...] } }
    if (err.message && typeof err.message === 'string') {
      if (err.errors && typeof err.errors === 'object' && Object.keys(err.errors).length > 0) {
        const details = Object.entries(err.errors)
          .map(([field, msgs]) => {
            const msgStr = Array.isArray(msgs) ? msgs.join(', ') : msgs;
            return `${field.charAt(0).toUpperCase() + field.slice(1)}: ${msgStr}`;
          })
          .join(' · ');
        return details ? `${err.message} — ${details}` : err.message;
      }
      return err.message;
    }

    // DRF: detail
    if (err.detail) {
      if (typeof err.detail === 'string') return err.detail;
      if (Array.isArray(err.detail) && err.detail.length > 0) return err.detail[0];
    }

    // DRF: non_field_errors
    if (Array.isArray(err.non_field_errors) && err.non_field_errors.length > 0) {
      return err.non_field_errors[0];
    }

    // DRF field-level errors: { field: ["msg", ...] } or { field: "msg" }
    const skip = new Set(['status', 'message', 'non_field_errors', 'detail', 'errors']);
    for (const key of Object.keys(err)) {
      if (skip.has(key)) continue;
      const val = err[key];
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') return val[0];
      if (typeof val === 'string') return val;
    }
  }

  return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// handleApiError(err, options?)
//
// Parses the error AND fires a toast.error — the one-stop-shop for catch blocks.
//
// options:
//   fallback    – custom fallback message string
//   setErrors   – React state setter: merges field-level DRF errors into it
//   silent      – if true, suppresses the toast (useful for background fetches)
//
// Returns: the resolved human-readable message string.
// ─────────────────────────────────────────────────────────────────────────────
export function handleApiError(err, { fallback, setErrors, silent = false } = {}) {
  const message = parseApiError(err, fallback ?? 'An unexpected error occurred.');

  // Populate field-level errors when a setter is provided
  if (setErrors) {
    const raw = _getRawObject(err);
    if (raw && typeof raw === 'object') {
      const normalised = {};
      const skip = new Set(['status', 'message', 'detail', 'non_field_errors', 'errors']);
      for (const [key, val] of Object.entries(raw)) {
        if (skip.has(key)) continue;
        if (Array.isArray(val)) normalised[key] = val[0];
        else if (typeof val === 'string') normalised[key] = val;
      }
      // Also handle { errors: { field: [...] } } envelope shape
      if (raw.errors && typeof raw.errors === 'object') {
        for (const [key, val] of Object.entries(raw.errors)) {
          normalised[key] = Array.isArray(val) ? val[0] : val;
        }
      }
      if (Object.keys(normalised).length > 0) {
        setErrors((prev) => ({ ...prev, ...normalised }));
      }
    }
  }

  if (!silent) {
    toast.error(message);
  }

  return message;
}

// ─────────────────────────────────────────────────────────────────────────────
// logError(context, err)
//
// Centralised console.error wrapper so all error logs have a consistent format.
// In a future iteration this could be swapped for a remote logging service.
// ─────────────────────────────────────────────────────────────────────────────
export function logError(context, err) {
  console.error(`[${context}]`, err);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper – unwrap a raw object from an err that may be a
// JSON-serialised Error (the fetchWithAuth pattern).
// ─────────────────────────────────────────────────────────────────────────────
function _getRawObject(err) {
  if (!err) return null;
  if (typeof err === 'object' && !(err instanceof Error)) return err;
  if (err.message && typeof err.message === 'string') {
    if (err.message.startsWith('{') || err.message.startsWith('[')) {
      try { return JSON.parse(err.message); } catch { /* ignore */ }
    }
  }
  return null;
}
