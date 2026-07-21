import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import waitlistReducer, {
  joinWaitlist,
  fetchWaitlistEntries,
  cancelWaitlistEntry,
  clearJoinState,
} from '@/store/waitlistSlice';
import * as waitlistService from '@/services/waitlist-service/waitlistService';

/* ── helpers ─────────────────────────────────────── */
vi.mock('@/services/waitlist-service/waitlistService');

const makeStore = () =>
  configureStore({ reducer: { waitlist: waitlistReducer } });

const MOCK_FLIGHT = {
  id: 'flight-uuid-1',
  flight_number: 'AG-101',
  airline: 'AeroGlass',
};

const MOCK_ENTRY = {
  id: 'entry-uuid-1',
  flight: MOCK_FLIGHT.id,
  flight_detail: MOCK_FLIGHT,
  status: 'PENDING',
  seat_count: 2,
  price: 200,
  created_at: new Date().toISOString(),
};

/* ── tests ────────────────────────────────────────── */
describe('waitlistSlice', () => {
  let store;

  beforeEach(() => {
    store = makeStore();
    vi.clearAllMocks();
  });

  // ── Initial state ──
  it('has correct initial state', () => {
    const state = store.getState().waitlist;
    expect(state.list).toEqual([]);
    expect(state.joinLoading).toBe(false);
    expect(state.joinError).toBeNull();
    expect(state.lastJoined).toBeNull();
    expect(state.listLoading).toBe(false);
    expect(state.cancelLoadingId).toBeNull();
  });

  // ── Join Waitlist ──
  describe('joinWaitlist', () => {
    it('sets joinLoading=true while pending', async () => {
      waitlistService.waitlistAPI.join = vi.fn(() => new Promise(() => {}));
      store.dispatch(joinWaitlist({ flightId: 'flight-uuid-1', seatCount: 2 }));
      expect(store.getState().waitlist.joinLoading).toBe(true);
      expect(store.getState().waitlist.joinError).toBeNull();
    });

    it('sets lastJoined and prepends to list on success', async () => {
      waitlistService.waitlistAPI.join = vi.fn().mockResolvedValue(MOCK_ENTRY);
      await store.dispatch(joinWaitlist({ flightId: 'flight-uuid-1', seatCount: 2 }));

      const state = store.getState().waitlist;
      expect(state.joinLoading).toBe(false);
      expect(state.lastJoined).toEqual(MOCK_ENTRY);
      expect(state.list).toHaveLength(1);
      expect(state.list[0]).toEqual(MOCK_ENTRY);
    });

    it('sets joinError on failure', async () => {
      waitlistService.waitlistAPI.join = vi.fn().mockRejectedValue(
        new Error(JSON.stringify({ error: 'Already on the waitlist' }))
      );
      await store.dispatch(joinWaitlist({ flightId: 'flight-uuid-1', seatCount: 2 }));

      const state = store.getState().waitlist;
      expect(state.joinLoading).toBe(false);
      expect(state.joinError).toBe('Already on the waitlist');
      expect(state.lastJoined).toBeNull();
    });
  });

  // ── clearJoinState reducer ──
  it('clearJoinState resets join state', async () => {
    waitlistService.waitlistAPI.join = vi.fn().mockResolvedValue(MOCK_ENTRY);
    await store.dispatch(joinWaitlist({ flightId: 'flight-uuid-1', seatCount: 2 }));
    store.dispatch(clearJoinState());

    const state = store.getState().waitlist;
    expect(state.lastJoined).toBeNull();
    expect(state.joinError).toBeNull();
    expect(state.joinLoading).toBe(false);
  });

  // ── Fetch Waitlist Entries ──
  describe('fetchWaitlistEntries', () => {
    it('populates list on success (plain array)', async () => {
      waitlistService.waitlistAPI.list = vi.fn().mockResolvedValue([MOCK_ENTRY]);
      await store.dispatch(fetchWaitlistEntries());

      const state = store.getState().waitlist;
      expect(state.listLoading).toBe(false);
      expect(state.list).toHaveLength(1);
      expect(state.list[0].id).toBe('entry-uuid-1');
    });

    it('sets listError on failure', async () => {
      waitlistService.waitlistAPI.list = vi.fn().mockRejectedValue(
        new Error(JSON.stringify({ detail: 'Failed to load waitlist' }))
      );
      await store.dispatch(fetchWaitlistEntries());

      const state = store.getState().waitlist;
      expect(state.listLoading).toBe(false);
      expect(state.listError).toBe('Failed to load waitlist');
    });
  });

  // ── Cancel Waitlist Entry ──
  describe('cancelWaitlistEntry', () => {
    beforeEach(async () => {
      waitlistService.waitlistAPI.list = vi.fn().mockResolvedValue([MOCK_ENTRY]);
      await store.dispatch(fetchWaitlistEntries());
    });

    it('tracks cancelLoadingId while pending', () => {
      waitlistService.waitlistAPI.cancel = vi.fn(() => new Promise(() => {}));
      store.dispatch(cancelWaitlistEntry('entry-uuid-1'));
      expect(store.getState().waitlist.cancelLoadingId).toBe('entry-uuid-1');
    });

    it('updates entry status to CANCELLED in list on success', async () => {
      waitlistService.waitlistAPI.cancel = vi.fn().mockResolvedValue({
        message: 'Waitlist entry cancelled',
        status: 'CANCELLED',
      });
      await store.dispatch(cancelWaitlistEntry('entry-uuid-1'));

      const state = store.getState().waitlist;
      expect(state.cancelLoadingId).toBeNull();
      expect(state.list[0].status).toBe('CANCELLED');
    });

    it('sets cancelError on failure', async () => {
      waitlistService.waitlistAPI.cancel = vi.fn().mockRejectedValue(
        new Error(JSON.stringify({ error: 'Only pending entries can be cancelled.' }))
      );
      await store.dispatch(cancelWaitlistEntry('entry-uuid-1'));

      const state = store.getState().waitlist;
      expect(state.cancelLoadingId).toBeNull();
      expect(state.cancelError).toBe('Only pending entries can be cancelled.');
    });
  });
});
