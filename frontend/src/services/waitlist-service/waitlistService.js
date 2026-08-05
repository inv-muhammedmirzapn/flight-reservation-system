import { fetchWithAuth } from '@/services/apiClient';

export const waitlistAPI = {
  join: async (flightId, passengers = [], cabinClass = null) => {
    const body = {
      flight: flightId,
      passengers,
    };
    if (cabinClass) {
      body.cabin_class = cabinClass;
    }
    return fetchWithAuth('/waitlist/join/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  list: async (flightId = null) => {
    const endpoint = flightId ? `/waitlist/?flight=${flightId}` : '/waitlist/';
    return fetchWithAuth(endpoint);
  },

  retrieve: async (id) => {
    return fetchWithAuth(`/waitlist/${id}/`);
  },

  cancel: async (id) => {
    return fetchWithAuth(`/waitlist/${id}/cancel/`, {
      method: 'POST',
    });
  },

  promote: async (id) => {
    return fetchWithAuth(`/waitlist/${id}/promote/`, {
      method: 'POST',
    });
  },

  flightCount: async (flightId) => {
    return fetchWithAuth(`/waitlist/flight/${flightId}/`);
  },
};
