import { fetchWithAuth } from '@/services/apiClient';

export const bookingAPI = {
  /**
   * Create a new booking for a flight.
   * POST /api/bookings/
   */
  create: async (flightId, passengers, cabinClass = 'ECONOMY') => {
    return fetchWithAuth('/bookings/', {
      method: 'POST',
      body: JSON.stringify({
        flight: flightId,
        cabin_class: cabinClass,
        passengers,
      }),
    });
  },

  /**
   * List all bookings for the authenticated user.
   * GET /api/bookings/?pnr=&status=
   */
  list: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.pnr) query.append('pnr', params.pnr);
    if (params.status) query.append('status', params.status);
    const queryString = query.toString();
    const url = queryString ? `/bookings/?${queryString}` : '/bookings/';
    return fetchWithAuth(url);
  },

  /**
   * Retrieve a single booking by ID.
   * GET /api/bookings/:id/
   */
  retrieve: async (id) => {
    return fetchWithAuth(`/bookings/${id}/`);
  },

  /**
   * Cancel a booking.
   * POST /api/bookings/:id/cancel/
   */
  cancel: async (id) => {
    return fetchWithAuth(`/bookings/${id}/cancel/`, {
      method: 'POST',
    });
  },

  /**
   * List passengers for the authenticated user.
   * GET /api/bookings/passengers/
   */
  getPassengers: async (search = '') => {
    const url = search ? `/bookings/passengers/?search=${encodeURIComponent(search)}` : '/bookings/passengers/';
    return fetchWithAuth(url);
  },
};
