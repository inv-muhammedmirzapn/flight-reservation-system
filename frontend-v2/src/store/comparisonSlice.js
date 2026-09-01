import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { flightsAPI } from '@/services/flight-service/flightService';

// Async thunk — calls the backend and stores the result

// creating an async Redux action.
export const fetchComparison = createAsyncThunk(
  'comparison/fetchComparison', // This is the action type prefix.
                                //Redux Toolkit will automatically generate three action types:

  // Thunk parameter- First parameter is ID, value passed by dispatch
  // rejectWithValue() lets you send a custom error value
  async (flightInstanceIds, { rejectWithValue }) => {
    try {
      return await flightsAPI.compareFlights(flightInstanceIds); // This calls your API service.
    } catch (error) {
      let message = 'Failed to fetch comparison data';
      try {
        const errObj = JSON.parse(error.message); // JSON.parse() converts that string into a JavaScript object
        message = errObj.flight_instance_ids?.[0] || errObj.detail || message;
      } catch (_) { /* empty */ }
      //The API operation failed, and here is the error message
      return rejectWithValue(message);
    }
  }
);


const comparisonSlice = createSlice({
  name: 'comparison',

  initialState: {
    selectedIds: [],       // IDs selected by the user.
    comparisonData: [],    // Full comparison objects returned by the API
    loading: false,
    error: null,
  },

  reducers: {
    // Add a flight ID to the selection (ignore if already added or if 4 already selected)
    addToComparison: (state, action) => {
      const id = action.payload;
      if (!state.selectedIds.includes(id) && state.selectedIds.length < 4) {
        state.selectedIds.push(id);
      }
    },

    // Remove a flight ID from the selection
    removeFromComparison: (state, action) => {
      state.selectedIds = state.selectedIds.filter(id => id !== action.payload);
    },

    // Reset everything — used when the user navigates away
    clearComparison: (state) => {
      state.selectedIds = [];   // Removes all selected flight IDs.
      state.comparisonData = [];  // Removes old comparison results.
      state.error = null;       // Removes any error messages.
    },
  },


// extraReducers allows your slice to respond to actions
  extraReducers: (builder) => {
    builder
      .addCase(fetchComparison.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchComparison.fulfilled, (state, action) => {
        state.loading = false;
        // Backend returns { status: "success", data: [...] }
        
        //Store the data in the redux  --- optional chaining + nullish coalescing.
        state.comparisonData = action.payload?.data ?? action.payload ?? [];
      })
      .addCase(fetchComparison.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { addToComparison, removeFromComparison, clearComparison } = comparisonSlice.actions;
export default comparisonSlice.reducer;
