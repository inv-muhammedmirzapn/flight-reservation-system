import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_BASE_URL } from '@/services/apiClient';

export const checkServerHealth = createAsyncThunk(
  'system/checkHealth',
  async (_, { rejectWithValue }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Ping a lightweight GET endpoint
      const response = await fetch(`${API_BASE_URL}/flights/`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status < 500) {
        return true;
      }
      return rejectWithValue('Server unavailable');
    } catch (err) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

const initialState = {
  isServerDown: false,
  isCheckingHealth: false,
  lastCheckedAt: null,
};

const systemSlice = createSlice({
  name: 'system',
  initialState,
  reducers: {
    setServerDown: (state, action) => {
      state.isServerDown = Boolean(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkServerHealth.pending, (state) => {
        state.isCheckingHealth = true;
      })
      .addCase(checkServerHealth.fulfilled, (state) => {
        state.isCheckingHealth = false;
        state.isServerDown = false;
        state.lastCheckedAt = new Date().toISOString();
      })
      .addCase(checkServerHealth.rejected, (state) => {
        state.isCheckingHealth = false;
        state.isServerDown = true;
        state.lastCheckedAt = new Date().toISOString();
      });
  },
});

export const { setServerDown } = systemSlice.actions;
export default systemSlice.reducer;
