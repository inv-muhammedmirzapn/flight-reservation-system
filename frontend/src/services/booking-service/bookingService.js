import { fetchWithAuth } from '@/services/apiClient';

export const bookingAPI = {
  /**
   * Create a new booking for a flight.
   * POST /api/bookings/
   */
  create: async (flightId, passengers, fareClass) => {
    return fetchWithAuth('/bookings/', {
      method: 'POST',
      body: JSON.stringify({ flight: flightId, passengers, fare_class: fareClass }),
    });
  },

  /**
   * List all bookings for the authenticated user.
   * GET /api/bookings/
   */
  list: async () => {
    return fetchWithAuth('/bookings/');
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
};
