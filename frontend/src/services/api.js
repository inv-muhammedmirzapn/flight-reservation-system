const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getResponseData = async (res) => {
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

export const authAPI = {
  register: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    return data;
  },

  login: async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    return data;
  },

  googleLogin: async (token) => {
    const response = await fetch(`${API_BASE_URL}/auth/google-login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    return data;
  },

  getProfile: async () => {
    return fetchWithAuth('/auth/profile/');
  }
};

export const flightsAPI = {
  list: async (page = 1, params = {}) => {
    const qs = new URLSearchParams({ page: String(page) });
    if (params.search)       qs.set('search', params.search);
    if (params.status)       qs.set('status', params.status);
    if (params.source)       qs.set('source', params.source);
    if (params.destination)  qs.set('destination', params.destination);
    if (params.date)         qs.set('date', params.date);
    if (params.arrival_date) qs.set('arrival_date', params.arrival_date);
    if (params.ordering)     qs.set('ordering', params.ordering);
    return fetchWithAuth(`/flights/?${qs.toString()}`);
  },

  listAll: async () => {
    return fetchWithAuth(`/flights/?page_size=1000`);
  },

  retrieve: async (id) => {
    return fetchWithAuth(`/flights/${id}/`);
  },

  create: async (flightData) => {
    return fetchWithAuth('/flights/', {
      method: 'POST',
      body: JSON.stringify(flightData),
    });
  },

  update: async (id, flightData) => {
    return fetchWithAuth(`/flights/${id}/update/`, {
      method: 'PUT',
      body: JSON.stringify(flightData),
    });
  },

  patch: async (id, flightData) => {
    return fetchWithAuth(`/flights/${id}/update/`, {
      method: 'PATCH',
      body: JSON.stringify(flightData),
    });
  },

  delete: async (id) => {
    return fetchWithAuth(`/flights/${id}/`, {
      method: 'DELETE',
    });
  },

  bulkImport: async (flightsData) => {
    return fetchWithAuth('/flights/bulk-import/', {
      method: 'POST',
      body: JSON.stringify(flightsData),
    });
  },

  bulkImportCsv: async (file) => {
    const token = localStorage.getItem('access_token');
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/flights/bulk-import/`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    return data;
  },

  stats: async () => {
    return fetchWithAuth('/flights/stats/');
  },
};


export const profileAPI = {
  getProfile: async () => {
    return fetchWithAuth('/auth/profile/');
  },

  updateProfile: async (profileData) => {
    return fetchWithAuth('/auth/profile/', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  },

  changePassword: async (passwordData) => {
    return fetchWithAuth('/auth/change-password/', {
      method: 'POST',
      body: JSON.stringify(passwordData),
    });
  },
};
