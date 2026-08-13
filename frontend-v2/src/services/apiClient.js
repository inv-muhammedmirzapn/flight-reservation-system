import { parseApiError } from '@/utils/errorUtils';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const dispatchServerDown = async () => {
  try {
    const { store } = await import('@/store');
    const { setServerDown } = await import('@/store/systemSlice');
    store.dispatch(setServerDown(true));
  } catch (err) {
    console.error("Could not dispatch server down state:", err);
  }
};

export const getResponseData = async (res) => {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    const json = JSON.parse(text);
    // Unwrap global API response envelope: { status: "success", data: ... }
    if (json && typeof json === 'object' && json.status === 'success') {
      return json.data !== undefined ? json.data : json;
    }
    return json;
  } catch (_) {
    return text;
  }
};

// extractErrorMessage is intentionally not re-exported.
// Use parseApiError from '@/utils/errorUtils' instead.

// Helper to make authenticated requests
export const fetchWithAuth = async (endpoint, options = {}) => {
  const token = localStorage.getItem('access_token');
  const isFormData = options.body instanceof FormData;

  const headers = {
    // Don't set Content-Type for FormData — the browser must set it with the
    // correct multipart boundary automatically. For everything else default to JSON.
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (_netErr) {
    // Catch network connectivity failure / connection refused
    dispatchServerDown();
    throw new Error("Unable to connect to server. Please check backend connection.");
  }

  // Handle server outage / maintenance statuses (502 Bad Gateway, 503 Service Unavailable, 504 Timeout)
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    dispatchServerDown();
    throw new Error("Server is currently experiencing issues. Please try again shortly.");
  }

  // If unauthorized, attempt token refresh (if a refresh token is present)
  if (response.status === 401 && localStorage.getItem('refresh_token')) {
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: localStorage.getItem('refresh_token') }),
      });

      if (refreshResponse.ok) {
        const refreshRaw = await refreshResponse.json();
        const refreshData = (refreshRaw && refreshRaw.status === 'success' && refreshRaw.data)
          ? refreshRaw.data
          : refreshRaw;

        const newAccess = refreshData.access;
        const newRefresh = refreshData.refresh || localStorage.getItem('refresh_token');

        if (newAccess) localStorage.setItem('access_token', newAccess);
        if (newRefresh) localStorage.setItem('refresh_token', newRefresh);

        // Retry the original request with the new token
        headers['Authorization'] = `Bearer ${newAccess}`;
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
        const retryData = await getResponseData(retryResponse);
        if (!retryResponse.ok) throw new Error(parseApiError(retryData));
        return retryData;
      }
    } catch (refreshErr) {
      console.error("Token refresh failed. Logging out.", refreshErr);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/';
      throw new Error("Session expired. Please log in again.");
    }
  }

  const data = await getResponseData(response);
  if (!response.ok) throw new Error(parseApiError(data));
  return data;
};
