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

// Helper to make authenticated requests
export const fetchWithAuth = async (endpoint, options = {}) => {
  const token = localStorage.getItem('access_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // If unauthorized, attempt token refresh (if a refresh token is present)
  if (response.status === 401 && localStorage.getItem('refresh_token')) {
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: localStorage.getItem('refresh_token') }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        localStorage.setItem('access_token', refreshData.access);

        // Retry the original request with the new token
        headers['Authorization'] = `Bearer ${refreshData.access}`;
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
        const retryData = await getResponseData(retryResponse);
        if (!retryResponse.ok) throw new Error(typeof retryData === 'string' ? retryData : JSON.stringify(retryData));
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
  if (!response.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
  return data;
};
