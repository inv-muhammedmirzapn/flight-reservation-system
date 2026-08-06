import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bookingsReducer, {
  createBooking,
  fetchMyBookings,
  cancelBooking,
  clearCreateState,
} from '@/store/bookingSlice';
import * as bookingService from '@/services/booking-service/bookingService';

/* ── helpers ─────────────────────────────────────── */
vi.mock('@/services/booking-service/bookingService');

const makeStore = () =>
  configureStore({ reducer: { bookings: bookingsReducer } });

const MOCK_FLIGHT = {
  id: 'flight-uuid-1',
  flight_number: 'AG-101',
  airline: 'Passenger',
  aircraft: 'Boeing 737',
  source_airport: 'DEL',
  destination_airport: 'BOM',
  departure_time: new Date(Date.now() + 86400000).toISOString(),
  arrival_time:   new Date(Date.now() + 90000000).toISOString(),
  base_fare: 5000,
  status: 'SCHEDULED',
};

const MOCK_BOOKING = {
  id: 'booking-uuid-1',
  flight: MOCK_FLIGHT.id,
  flight_detail: MOCK_FLIGHT,
  status: 'CONFIRMED',
  created_at: new Date().toISOString(),
};

/* ── tests ────────────────────────────────────────── */
describe('bookingSlice', () => {
  let store;

  beforeEach(() => {
    store = makeStore();
    vi.clearAllMocks();
  });

  // ── Initial state ──
  it('has correct initial state', () => {
    const state = store.getState().bookings;
    expect(state.list).toEqual([]);
    expect(state.createLoading).toBe(false);
    expect(state.createError).toBeNull();
    expect(state.lastCreated).toBeNull();
    expect(state.listLoading).toBe(false);
    expect(state.cancelLoadingId).toBeNull();
  });

  // ── Create booking ──
  describe('createBooking', () => {
    it('sets createLoading=true while pending', async () => {
      bookingService.bookingAPI.create = vi.fn(() => new Promise(() => {}));
      store.dispatch(createBooking('flight-uuid-1'));
      expect(store.getState().bookings.createLoading).toBe(true);
      expect(store.getState().bookings.createError).toBeNull();
    });

    it('sets lastCreated and prepends to list on success', async () => {
      bookingService.bookingAPI.create = vi.fn().mockResolvedValue(MOCK_BOOKING);
      await store.dispatch(createBooking('flight-uuid-1'));

      const state = store.getState().bookings;
      expect(state.createLoading).toBe(false);
      expect(state.lastCreated).toEqual(MOCK_BOOKING);
      expect(state.list).toHaveLength(1);
      expect(state.list[0]).toEqual(MOCK_BOOKING);
    });

    it('sets createError on failure', async () => {
      bookingService.bookingAPI.create = vi.fn().mockRejectedValue(
        new Error(JSON.stringify({ detail: 'No available seats on this flight.' }))
      );
      await store.dispatch(createBooking('flight-uuid-1'));

      const state = store.getState().bookings;
      expect(state.createLoading).toBe(false);
      expect(state.createError).toBe('No available seats on this flight.');
      expect(state.lastCreated).toBeNull();
    });
  });

  // ── clearCreateState reducer ──
  it('clearCreateState resets create state', async () => {
    bookingService.bookingAPI.create = vi.fn().mockResolvedValue(MOCK_BOOKING);
    await store.dispatch(createBooking('flight-uuid-1'));
    store.dispatch(clearCreateState());

    const state = store.getState().bookings;
    expect(state.lastCreated).toBeNull();
    expect(state.createError).toBeNull();
    expect(state.createLoading).toBe(false);
  });

  // ── Fetch my bookings ──
  describe('fetchMyBookings', () => {
    it('populates list on success (plain array)', async () => {
      bookingService.bookingAPI.list = vi.fn().mockResolvedValue([MOCK_BOOKING]);
      await store.dispatch(fetchMyBookings());

      const state = store.getState().bookings;
      expect(state.listLoading).toBe(false);
      expect(state.list).toHaveLength(1);
      expect(state.list[0].id).toBe('booking-uuid-1');
    });

    it('populates list on success (paginated response)', async () => {
      bookingService.bookingAPI.list = vi.fn().mockResolvedValue({
        count: 1,
        results: [MOCK_BOOKING],
      });
      await store.dispatch(fetchMyBookings());

      expect(store.getState().bookings.list).toHaveLength(1);
    });

    it('sets listError on failure', async () => {
      bookingService.bookingAPI.list = vi.fn().mockRejectedValue(
        new Error(JSON.stringify({ detail: 'Failed to load bookings' }))
      );
      await store.dispatch(fetchMyBookings());

      const state = store.getState().bookings;
      expect(state.listLoading).toBe(false);
      expect(state.listError).toBe('Failed to load bookings');
    });
  });

  // ── Cancel booking ──
  describe('cancelBooking', () => {
    beforeEach(async () => {
      bookingService.bookingAPI.list = vi.fn().mockResolvedValue([MOCK_BOOKING]);
      await store.dispatch(fetchMyBookings());
    });

    it('tracks cancelLoadingId while pending', () => {
      bookingService.bookingAPI.cancel = vi.fn(() => new Promise(() => {}));
      store.dispatch(cancelBooking('booking-uuid-1'));
      expect(store.getState().bookings.cancelLoadingId).toBe('booking-uuid-1');
    });

    it('updates booking status to CANCELLED in list on success', async () => {
      bookingService.bookingAPI.cancel = vi.fn().mockResolvedValue({
        detail: 'Booking cancelled successfully.',
        status: 'CANCELLED',
      });
      await store.dispatch(cancelBooking('booking-uuid-1'));

      const state = store.getState().bookings;
      expect(state.cancelLoadingId).toBeNull();
      expect(state.list[0].status).toBe('CANCELLED');
    });

    it('sets cancelError on failure', async () => {
      bookingService.bookingAPI.cancel = vi.fn().mockRejectedValue(
        new Error(JSON.stringify({ detail: 'Booking is already cancelled.' }))
      );
      await store.dispatch(cancelBooking('booking-uuid-1'));

      const state = store.getState().bookings;
      expect(state.cancelLoadingId).toBeNull();
      expect(state.cancelError).toBe('Booking is already cancelled.');
    });
  });
});
