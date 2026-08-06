import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { waitlistAPI } from '@/services/waitlist-service/waitlistService';

const parseError = (error, defaultMsg) => {
  let message = defaultMsg;
  try {
    const errObj = JSON.parse(error.message);
    message = errObj.error || errObj.detail || message;
  } catch (_) {
    message = error.message || message;
  }
  return message;
};

/* ─── Async Thunks ──────────────────────────────────────── */

export const joinWaitlist = createAsyncThunk(
  'waitlist/join',
  async ({ flightId, passengers, cabinClass }, { rejectWithValue }) => {
    try {
      return await waitlistAPI.join(flightId, passengers, cabinClass);
    } catch (error) {
      return rejectWithValue(parseError(error, 'Failed to join waitlist'));
    }
  }
);

export const fetchWaitlistEntries = createAsyncThunk(
  'waitlist/fetchAll',
  async (flightId, { rejectWithValue }) => {
    try {
      return await waitlistAPI.list(flightId);
    } catch (error) {
      return rejectWithValue(parseError(error, 'Failed to load waitlist'));
    }
  }
);

export const cancelWaitlistEntry = createAsyncThunk(
  'waitlist/cancel',
  async (id, { rejectWithValue }) => {
    try {
      const data = await waitlistAPI.cancel(id);
      return { id, ...data };
    } catch (error) {
      return rejectWithValue(parseError(error, 'Failed to cancel waitlist entry'));
    }
  }
);

export const fetchWaitlistFlightCount = createAsyncThunk(
  'waitlist/fetchFlightCount',
  async (flightId, { rejectWithValue }) => {
    try {
      const data = await waitlistAPI.flightCount(flightId);
      return { flightId, count: data.waitlist_count };
    } catch (error) {
      return rejectWithValue(parseError(error, 'Failed to fetch waitlist count'));
    }
  }
);

/* ─── Slice ──────────────────────────────────────────────── */

const initialState = {
  list: [],
  listLoading: false,
  listError: null,

  // Join flow
  joinLoading: false,
  joinError: null,
  lastJoined: null,

  // Cancel flow
  cancelLoadingId: null,
  cancelError: null,

  // Flight counts caching
  counts: {}, // flightId -> count
  countsLoading: {},
};

const waitlistSlice = createSlice({
  name: 'waitlist',
  initialState,
  reducers: {
    clearJoinState: (state) => {
      state.joinLoading = false;
      state.joinError = null;
      state.lastJoined = null;
    },
    clearCancelError: (state) => {
      state.cancelError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      /* ── Join ── */
      .addCase(joinWaitlist.pending, (state) => {
        state.joinLoading = true;
        state.joinError = null;
        state.lastJoined = null;
      })
      .addCase(joinWaitlist.fulfilled, (state, action) => {
        state.joinLoading = false;
        state.lastJoined = action.payload;
        state.list = [action.payload, ...state.list];
        // Optimistically increment waitlist count for the flight
        const fId = action.payload.flight;
        if (fId && typeof state.counts[fId] === 'number') {
          state.counts[fId] += action.payload.seat_count;
        }
      })
      .addCase(joinWaitlist.rejected, (state, action) => {
        state.joinLoading = false;
        state.joinError = action.payload;
      })

      /* ── Fetch list ── */
      .addCase(fetchWaitlistEntries.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchWaitlistEntries.fulfilled, (state, action) => {
        state.listLoading = false;
        state.list = Array.isArray(action.payload)
          ? action.payload
          : (action.payload.results ?? action.payload);
      })
      .addCase(fetchWaitlistEntries.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload;
      })

      /* ── Cancel ── */
      .addCase(cancelWaitlistEntry.pending, (state, action) => {
        state.cancelLoadingId = action.meta.arg;
        state.cancelError = null;
      })
      .addCase(cancelWaitlistEntry.fulfilled, (state, action) => {
        state.cancelLoadingId = null;
        const idx = state.list.findIndex((w) => w.id === action.payload.id);
        if (idx !== -1) {
          const entry = state.list[idx];
          state.list[idx] = { ...entry, status: 'CANCELLED' };
          
          // Optimistically decrement waitlist count for the flight
          const fId = entry.flight;
          if (fId && typeof state.counts[fId] === 'number') {
            state.counts[fId] = Math.max(0, state.counts[fId] - entry.seat_count);
          }
        }
      })
      .addCase(cancelWaitlistEntry.rejected, (state, action) => {
        state.cancelLoadingId = null;
        state.cancelError = action.payload;
      })

      /* ── Fetch Flight Count ── */
      .addCase(fetchWaitlistFlightCount.pending, (state, action) => {
        state.countsLoading[action.meta.arg] = true;
      })
      .addCase(fetchWaitlistFlightCount.fulfilled, (state, action) => {
        const { flightId, count } = action.payload;
        state.countsLoading[flightId] = false;
        state.counts[flightId] = count;
      })
      .addCase(fetchWaitlistFlightCount.rejected, (state, action) => {
        state.countsLoading[action.meta.arg] = false;
      });
  },
});

export const { clearJoinState, clearCancelError } = waitlistSlice.actions;
export default waitlistSlice.reducer;
