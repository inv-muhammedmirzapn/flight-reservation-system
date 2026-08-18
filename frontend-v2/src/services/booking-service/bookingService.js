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

  /**
   * Hold a seat temporarily for a flight instance.
   * POST /api/bookings/holds/
   * Body: { flight_instance, seat_number, old_seat_number? }
   */
  holdSeat: async (flightInstanceId, seatNumber, oldSeatNumber = null) => {
    return fetchWithAuth('/bookings/holds/', {
      method: 'POST',
      body: JSON.stringify({
        flight_instance: flightInstanceId,
        seat_number: seatNumber,
        ...(oldSeatNumber && { old_seat_number: oldSeatNumber }),
      }),
    });
  },

  /**
   * Release a temporary seat hold early.
   * DELETE /api/bookings/holds/:id/
   */
  releaseHold: async (holdId) => {
    return fetchWithAuth(`/bookings/holds/${holdId}/`, {
      method: 'DELETE',
    });
  },

  /**
   * Download the booking ticket PDF (server-generated).
   * GET /api/bookings/:id/download-pdf/
   * Triggers a browser file download.
   */
  downloadPdf: async (id, refCode) => {
    // fetchWithAuth will automatically handle 401s, token refreshes, and returning the Blob
    const blob = await fetchWithAuth(`/bookings/${id}/download-pdf/`);
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = `Passenger-Ticket-${refCode}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  },

  /**
   * Re-send the booking confirmation email with PDF attached.
   * POST /api/bookings/:id/send-ticket-email/
   */
  sendTicketEmail: async (id) => {
    return fetchWithAuth(`/bookings/${id}/send-ticket-email/`, {
      method: 'POST',
    });
  },
};
