export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const getResponseData = async (res) => {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
};

export const extractErrorMessage = (data) => {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    if (data.detail) return data.detail;
    if (data.non_field_errors) return Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors;
    
    // Map over keys for DRF field errors
    const errors = Object.keys(data).map(key => {
      const fieldError = data[key];
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

  // Default to application/json unless body is FormData
  if (!('Content-Type' in headers) && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // If a caller explicitly passed null or undefined to remove the default, clean it up
  if (headers['Content-Type'] === null || headers['Content-Type'] === undefined) {
    delete headers['Content-Type'];
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

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

          const refreshData = await refreshResponse.json();
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
