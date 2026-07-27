import { fetchWithAuth } from '@/services/apiClient';

export const waitlistAPI = {
  join: async (flightId, passengers = []) => {
    return fetchWithAuth('/waitlist/join/', {
      method: 'POST',
      body: JSON.stringify({
        flight: flightId,
        passengers,
      }),
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

  flightCount: async (flightId) => {
    return fetchWithAuth(`/waitlist/flight/${flightId}/`);
  },
};
