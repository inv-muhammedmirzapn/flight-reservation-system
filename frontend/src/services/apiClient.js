export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const getResponseData = async (res) => {
  if (res.status === 204) {
    // Always consume the body stream so the connection is released cleanly
    await res.text().catch(() => {});
    return null;
  }
  const text = await res.text();
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    // Unwrap our backend envelope if present (e.g. StandardizedJSONRenderer)
    if (data && typeof data === 'object' && data.status === 'success' && 'data' in data) {
      return data.data;
    }
    return data;
  } catch (_) {
    return text;
  }
};

export const extractErrorMessage = (data) => {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    // New standardized error envelope format
    if (data.status === 'error' && data.message) return data.message;
    
    // Legacy formats
    if (data.detail) return data.detail;
    if (data.non_field_errors) return Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors;
    
    // Fallback: check if standard envelope has field errors
    const errorDict = data.errors || data;
    
    // Map over keys for DRF field errors
    const errors = Object.keys(errorDict).map(key => {
      const fieldError = errorDict[key];
      const msg = Array.isArray(fieldError) ? fieldError[0] : fieldError;
      return `${key.charAt(0).toUpperCase() + key.slice(1)}: ${msg}`;
    });
    return errors.join(' · ');
  }
  return "An unexpected error occurred.";
};

let refreshPromise = null;

// Helper to make authenticated requests
export const fetchWithAuth = async (endpoint, options = {}) => {
  const token = localStorage.getItem('access_token');

  const headers = {
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  // Default to application/json only if a body is present and not FormData
  if (options.body && !('Content-Type' in headers) && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Clean up empty or null Content-Type
  if (!options.body || headers['Content-Type'] === null || headers['Content-Type'] === undefined) {
    delete headers['Content-Type'];
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr) {
    if (netErr.message === 'Failed to fetch' || netErr.name === 'TypeError') {
      throw new Error("Unable to connect to server. Please try again.");
    }
    throw netErr;
  }

  // If unauthorized, attempt token refresh (if a refresh token is present)
  if (response.status === 401 && localStorage.getItem('refresh_token')) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: localStorage.getItem('refresh_token') }),
          });

          if (!refreshResponse.ok) {
            throw new Error("Refresh token expired or invalid");
          }

          const refreshData = await getResponseData(refreshResponse);
          localStorage.setItem('access_token', refreshData.access);
          if (refreshData.refresh) {
            localStorage.setItem('refresh_token', refreshData.refresh);
          }
          return refreshData.access;
        } catch (refreshErr) {
          console.error("Token refresh failed. Logging out.", refreshErr);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          
          if (window.location.pathname.startsWith('/admin')) {
            window.location.href = '/admin/login';
          } else {
            window.location.href = '/login';
          }
          throw refreshErr;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    try {
      const newAccess = await refreshPromise;
      // Retry the original request with the new token
      headers['Authorization'] = `Bearer ${newAccess}`;
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (err) {
      throw new Error("Session expired. Please log in again.");
    }
  }

  const data = await getResponseData(response);
  if (!response.ok) {
    console.error('[API Error]', response.status, response.url, data);
    const error = new Error(extractErrorMessage(data));
    error.data = data;
    throw error;
  }
  return data;
};
