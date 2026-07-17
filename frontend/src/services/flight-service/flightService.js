import { API_BASE_URL, fetchWithAuth } from '@/services/apiClient';

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
