import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notificationsAPI } from '@/services/notifications-service/notificationsService';

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

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      return await notificationsAPI.list();
    } catch (error) {
      return rejectWithValue(parseError(error, 'Failed to load notifications'));
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id, { rejectWithValue }) => {
    try {
      return await notificationsAPI.read(id);
    } catch (error) {
      return rejectWithValue(parseError(error, 'Failed to mark notification as read'));
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      await notificationsAPI.markAllRead();
      return;
    } catch (error) {
      return rejectWithValue(parseError(error, 'Failed to mark all notifications as read'));
    }
  }
);

/* ─── Slice ──────────────────────────────────────────────── */

const initialState = {
  list: [],
  listLoading: false,
  listError: null,
  unreadCount: 0,
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearNotificationState: (state) => {
      state.list = [];
      state.listLoading = false;
      state.listError = null;
      state.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      /* ── Fetch all ── */
      .addCase(fetchNotifications.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.listLoading = false;
        const payloadData = Array.isArray(action.payload)
          ? action.payload
          : (action.payload?.results ?? []);
        state.list = Array.isArray(payloadData) ? payloadData : [];
        state.unreadCount = state.list.filter((n) => !n.is_read).length;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload;
      })

      /* ── Mark read ── */
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const index = state.list.findIndex((n) => n.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        state.unreadCount = state.list.filter((n) => !n.is_read).length;
      })

      /* ── Mark all read ── */
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.list = state.list.map((n) => ({ ...n, is_read: true }));
        state.unreadCount = 0;
      });
  },
});

export const { clearNotificationState } = notificationsSlice.actions;
export default notificationsSlice.reducer;
