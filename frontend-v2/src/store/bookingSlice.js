import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { bookingAPI } from '@/services/booking-service/bookingService';

/* ─── Async Thunks ──────────────────────────────────────── */

export const createBooking = createAsyncThunk(
  'bookings/create',
  async ({ flightId, passengers, cabinClass }, { rejectWithValue }) => {
    try {
      return await bookingAPI.create(flightId, passengers, cabinClass);
    } catch (error) {
      let message = 'Booking failed';
      try {
        const errObj = JSON.parse(error.message);
        message = errObj.detail || errObj.message || message;
      } catch (_) {
        message = error.message || message;
      }
      return rejectWithValue(message);
    }
  }
);

export const fetchMyBookings = createAsyncThunk(
  'bookings/fetchMine',
  async (_, { rejectWithValue }) => {
    try {
      return await bookingAPI.list();
    } catch (error) {
      let message = 'Failed to load bookings';
      try {
        const errObj = JSON.parse(error.message);
        message = errObj.detail || message;
      } catch (_) {}
      return rejectWithValue(message);
    }
  }
);

export const cancelBooking = createAsyncThunk(
  'bookings/cancel',
  async (bookingId, { rejectWithValue }) => {
    try {
      const data = await bookingAPI.cancel(bookingId);
      return { bookingId, ...data };
    } catch (error) {
      let message = 'Failed to cancel booking';
      try {
        const errObj = JSON.parse(error.message);
        message = errObj.detail || message;
      } catch (_) {}
      return rejectWithValue(message);
    }
  }
);

/* ─── Slice ──────────────────────────────────────────────── */

const initialState = {
  list: [],
  listLoading: false,
  listError: null,

  // Create flow
  createLoading: false,
  createError: null,
  lastCreated: null,   // the newly created booking, used to drive confirmation screen

  // Cancel flow
  cancelLoadingId: null,  // tracks which booking is being cancelled
  cancelError: null,
};

const bookingSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    clearCreateState: (state) => {
      state.createLoading = false;
      state.createError = null;
      state.lastCreated = null;
    },
    clearCancelError: (state) => {
      state.cancelError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      /* ── Create ── */
      .addCase(createBooking.pending, (state) => {
        state.createLoading = true;
        state.createError = null;
        state.lastCreated = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.createLoading = false;
        state.lastCreated = action.payload;
        // prepend to list if already loaded
        state.list = [action.payload, ...state.list];
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload;
      })

      /* ── Fetch list ── */
      .addCase(fetchMyBookings.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchMyBookings.fulfilled, (state, action) => {
        state.listLoading = false;
        // API may return paginated or plain array
        state.list = Array.isArray(action.payload)
          ? action.payload
          : (action.payload.results ?? action.payload);
      })
      .addCase(fetchMyBookings.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload;
      })

      /* ── Cancel ── */
      .addCase(cancelBooking.pending, (state, action) => {
        state.cancelLoadingId = action.meta.arg;
        state.cancelError = null;
      })
      .addCase(cancelBooking.fulfilled, (state, action) => {
        state.cancelLoadingId = null;
        // Update status in list
        const idx = state.list.findIndex((b) => b.id === action.payload.bookingId);
        if (idx !== -1) {
          state.list[idx] = { ...state.list[idx], status: 'CANCELLED' };
        }
      })
      .addCase(cancelBooking.rejected, (state, action) => {
        state.cancelLoadingId = null;
        state.cancelError = action.payload;
      });
  },
});

export const { clearCreateState, clearCancelError } = bookingSlice.actions;
export default bookingSlice.reducer;
