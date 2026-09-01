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
    const { store } = await import('@/store');
    const { logout } = await import('@/store/authSlice');
    store.dispatch(logout());
  } catch (err) {
    console.error("Could not dispatch logout state:", err);
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
    // Unwrap global API response envelope: { status: "success", data: ..., message: ... }
    if (json && typeof json === 'object' && json.status === 'success') {
      if (json.data !== undefined && json.data !== null) {
        if (typeof json.data === 'object' && !Array.isArray(json.data) && json.message && !json.data.message) {
          return { ...json.data, message: json.message };
        }
        return json.data;
      }
      if (json.message) {
        return { message: json.message };
      }
      return json.data !== undefined ? json.data : json;
    }
    return json;
  } catch (_) {
    return text;
  }
};

// extractErrorMessage is intentionally not re-exported.
// Use parseApiError from '@/utils/errorUtils' instead.

/**
 * fetchWithAuth — authenticated API client.
 *
 * Tokens are now stored as HttpOnly cookies set by the backend.
 * The browser attaches them automatically via `credentials: 'include'`.
 * We no longer manage tokens in localStorage or inject Authorization headers manually.
 *
 * On a 401, we attempt a silent token refresh by calling the cookie-based refresh
 * endpoint. The backend rotates both cookies. The browser then re-attaches the new
 * access_token cookie on the retried request automatically.
 */
export const fetchWithAuth = async (endpoint, options = {}) => {
  const isFormData = options.body instanceof FormData;

  const headers = {
    // Don't set Content-Type for FormData — the browser sets it with the correct
    // multipart boundary automatically. For everything else default to JSON.
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',  // send/receive HttpOnly cookies automatically
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

  // If unauthorized, attempt a silent cookie-based token refresh
  if (response.status === 401) {
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        credentials: 'include',   // sends the HttpOnly refresh_token cookie automatically
        headers: { 'Content-Type': 'application/json' },
        // No body — the backend reads the refresh token from its cookie
      });

      if (refreshResponse.ok) {
        // The backend has set new access_token + refresh_token cookies.
        // Retry the original request — the browser will attach the updated cookies.
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
          credentials: 'include',
        });
        const retryData = await getResponseData(retryResponse);
        if (!retryResponse.ok) throw new Error(parseApiError(retryData));
        return retryData;
      } else {
        // Refresh failed (token invalid or expired) — force logout
        console.error("Refresh token invalid or expired. Logging out user.");
        await dispatchLogout();
        throw new Error("Session expired. Please log in again.");
      }
    } catch (refreshErr) {
      if (refreshErr.message !== "Session expired. Please log in again.") {
        console.error("Token refresh failed. Logging out user.", refreshErr);
        await dispatchLogout();
      }
      throw new Error("Session expired. Please log in again.");
    }
  }

  const data = await getResponseData(response);
  if (!response.ok) {
    const errorObj = new Error(parseApiError(data));
    errorObj.data = data;
    throw errorObj;
  }
  return data;
};
