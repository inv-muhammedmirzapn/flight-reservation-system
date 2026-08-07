export default function getErrorMessage(err, fallback = 'An unexpected error occurred.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  // detail
  if (err.detail) {
    if (typeof err.detail === 'string') return err.detail;
    if (Array.isArray(err.detail) && err.detail.length > 0) return err.detail[0];
  }

  // non_field_errors[0]
  if (Array.isArray(err.non_field_errors) && err.non_field_errors.length > 0) {
    return err.non_field_errors[0];
  }

  // first field-level error
  const keys = Object.keys(err);
  for (const key of keys) {
    if (key !== 'status' && key !== 'message' && key !== 'non_field_errors' && key !== 'detail') {
      const val = err[key];
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        return val[0];
      }
      if (typeof val === 'string') {
        return val;
      }
    }
  }

  // message
  if (err.message) return err.message;

  // fallback string
  return fallback;
}
