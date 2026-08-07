import toast from 'react-hot-toast';

/**
 * Normalizes DRF errors and optionally sets local state/shows toast notifications.
 * @param {any} err - The error from the API/Redux slice.
 * @param {Function|null} setLocalErrors - State setter for mapping field-level errors.
 * @param {string} fallbackMsg - The message to show if parsing fails.
 * @returns {object} The normalized error object.
 */
export const parseApiErrors = (err, setLocalErrors = null, fallbackMsg = 'Failed to save. Please try again.') => {
  if (err && typeof err === 'object') {
    const normalised = {};
    Object.entries(err).forEach(([key, val]) => {
      if (Array.isArray(val)) normalised[key] = val[0];
      else if (typeof val === 'string') normalised[key] = val;
    });

    if (setLocalErrors) {
      setLocalErrors(prev => ({ ...prev, ...normalised }));
    }

    if (err.non_field_errors) {
      toast.error(Array.isArray(err.non_field_errors) ? err.non_field_errors[0] : err.non_field_errors);
    } else if (err.detail || err.error || err.message) {
      toast.error(err.detail || err.error || err.message);
    } else if (Object.keys(normalised).length === 0) {
      toast.error(fallbackMsg);
    }

    return normalised;
  } else {
    toast.error(typeof err === 'string' ? err : fallbackMsg);
    return {};
  }
};
