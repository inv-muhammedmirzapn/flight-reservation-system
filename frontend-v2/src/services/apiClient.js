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

const dispatchLogout = async () => {
  try {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    const { store } = await import('@/store');
    const { logout } = await import('@/store/authSlice');
    store.dispatch(logout());
  } catch (err) {
    console.error("Could not dispatch logout state:", err);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
  if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/admin/login')) {
    const isAdminPath = window.location.pathname.startsWith('/admin');
    window.location.href = isAdminPath ? '/admin/login' : '/login';
  }
};

export const getResponseData = async (res) => {
  if (res.status === 204) return null;
  
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/pdf')) {
    return await res.blob();
  }

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
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshRaw = await refreshResponse.json();
          const refreshData = (refreshRaw && refreshRaw.status === 'success' && refreshRaw.data)
            ? refreshRaw.data
            : refreshRaw;

          const newAccess = refreshData.access;
          const newRefresh = refreshData.refresh || refreshToken;

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
        } else {
          // Refresh token endpoint failed (e.g. 401/400 - token invalid or expired)
          console.error("Refresh token invalid or expired. Logging out user.");
          await dispatchLogout();
          throw new Error("Session expired. Please log in again.");
        }
      } catch (refreshErr) {
        console.error("Token refresh failed. Logging out user.", refreshErr);
        await dispatchLogout();
        throw new Error("Session expired. Please log in again.");
      }
    } else {
      // No refresh token available and request was unauthorized
      await dispatchLogout();
    }
  }

  const data = await getResponseData(response);
  if (!response.ok) throw new Error(parseApiError(data));
  return data;
};
