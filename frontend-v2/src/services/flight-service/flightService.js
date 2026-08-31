import { API_BASE_URL, fetchWithAuth, getResponseData } from '@/services/apiClient';

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
    if (params.min_fare)     qs.set('min_fare', params.min_fare);
    if (params.max_fare)     qs.set('max_fare', params.max_fare);
    if (params.stops !== undefined && params.stops !== "") qs.set('stops', params.stops);
    if (params.airlines)      qs.set('airlines', Array.isArray(params.airlines) ? params.airlines.join(',') : params.airlines);
    if (params.waitlist_mode) qs.set('waitlist_mode', params.waitlist_mode);
    if (params.cabin_class)   qs.set('cabin_class', params.cabin_class);
    if (params.passengers)   qs.set('passengers', params.passengers);
    if (params.page_size)    qs.set('page_size', params.page_size);
    return fetchWithAuth(`/flights/?${qs.toString()}`);
  },

  getBounds: async (params = {}) => {
    const qs = new URLSearchParams();
    if (params.source)       qs.set('source', params.source);
    if (params.destination)  qs.set('destination', params.destination);
    if (params.date)         qs.set('date', params.date);
    if (params.cabin_class)  qs.set('cabin_class', params.cabin_class);
    if (params.stops !== undefined && params.stops !== "") qs.set('stops', params.stops);
    if (params.airlines)      qs.set('airlines', Array.isArray(params.airlines) ? params.airlines.join(',') : params.airlines);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchWithAuth(`/flights/bounds/${query}`);
  },

  getCalendar: async (params = {}) => {
    const qs = new URLSearchParams();
    if (params.source)       qs.set('source', params.source);
    if (params.destination)  qs.set('destination', params.destination);
    if (params.start_date)   qs.set('start_date', params.start_date);
    if (params.end_date)     qs.set('end_date', params.end_date);
    if (params.cabin_class)  qs.set('cabin_class', params.cabin_class);
    if (params.stops !== undefined && params.stops !== "") qs.set('stops', params.stops);
    if (params.airlines)      qs.set('airlines', Array.isArray(params.airlines) ? params.airlines.join(',') : params.airlines);
    if (params.waitlist_mode) qs.set('waitlist_mode', params.waitlist_mode);
    if (params.max_fare)     qs.set('max_fare', params.max_fare);
    if (params.month)        qs.set('month', params.month);
    if (params.date)         qs.set('date', params.date);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchWithAuth(`/flights/calendar/${query}`);
  },

  retrieve: async (id) => {
    return fetchWithAuth(`/flights/${id}/`);
  },

  getMeals: async (instanceId, params = {}) => {
    const qs = new URLSearchParams();
    if (params.cabin_class) qs.set('cabin_class', params.cabin_class);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchWithAuth(`/flights/${instanceId}/meals/${query}`);
  },

  getSeats: async (instanceId) => {
    //console.log("INSTANCE ID: ", instanceId);
    return fetchWithAuth(`/flights/v2/seats/?flight_instance=${instanceId}`);
  },

  // Admin V2 CRUD Operations
  create: async (flightData) => {
    return fetchWithAuth('/flights/v2/', {
      method: 'POST',
      body: JSON.stringify(flightData),
    });
  },

  update: async (id, flightData) => {
    return fetchWithAuth(`/flights/v2/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(flightData),
    });
  },

  patch: async (id, flightData) => {
    return fetchWithAuth(`/flights/v2/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(flightData),
    });
  },

  delete: async (id) => {
    return fetchWithAuth(`/flights/v2/${id}/`, {
      method: 'DELETE',
    });
  },

  bulkImport: async (flightsData) => {
    return fetchWithAuth('/flights/v2/bulk-upload/', {
      method: 'POST',
      body: JSON.stringify(flightsData),
    });
  },

  bulkImportCsv: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetchWithAuth('/flights/v2/bulk-upload/', {
      method: 'POST',
      body: formData,
    });
  },

  stats: async () => {
    return fetchWithAuth('/flights/v2/stats/');
  },

  // Route Optimization — explicit on-demand calls
  fetchRecommendedRoutes: async (source, destination, date) => {
    const params = { source, destination };
    if (date) params.date = date;
    const qs = new URLSearchParams(params);
    return fetchWithAuth(`/flights/route-optimization/recommend/?${qs.toString()}`);
  },

  // Fare prediction
  getFarePrediction: async (flightInstanceId, cabinClass = 'ECONOMY') => {
    return fetchWithAuth(`/fare-prediction/${flightInstanceId}/?cabin_class=${cabinClass}`);
  },

};
