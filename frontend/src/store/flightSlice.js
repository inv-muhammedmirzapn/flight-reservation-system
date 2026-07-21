import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { flightsAPI } from '@/services/flight-service/flightService';

// fetchFlights accepts { page, params } or just a page number for backwards compat
export const fetchFlights = createAsyncThunk(
  'flights/fetchFlights',
  async (arg = 1, { rejectWithValue }) => {
    try {
      const page   = typeof arg === 'object' ? (arg.page   ?? 1)  : arg;
      const params = typeof arg === 'object' ? (arg.params ?? {}) : {};
      const data = await flightsAPI.list(page, params);
      return data; // { count, next, previous, results }
    } catch (error) {
      let message = 'Failed to fetch flights';
      try {
        const errObj = JSON.parse(error.message);
        message = errObj.detail || message;
      } catch (_) {}
      return rejectWithValue(message);
    }
  }
);


// fetchFlightStats — global per-status counts, independent of pagination
export const fetchFlightStats = createAsyncThunk(
  'flights/fetchFlightStats',
  async (_, { rejectWithValue }) => {
    try {
      return await flightsAPI.stats();
    } catch (error) {
      let message = 'Failed to fetch flight stats';
      try {
        const errObj = JSON.parse(error.message);
        message = errObj.detail || message;
      } catch (_) {}
      return rejectWithValue(message);
    }
  }
);

export const fetchFlightDetail = createAsyncThunk(
  'flights/fetchFlightDetail',
  async (id, { rejectWithValue }) => {
    try {
      const data = await flightsAPI.retrieve(id);
      return data;
    } catch (error) {
      let message = 'Failed to fetch flight detail';
      try {
        const errObj = JSON.parse(error.message);
        message = errObj.detail || message;
      } catch (_) {}
      return rejectWithValue(message);
    }
  }
);

export const addFlight = createAsyncThunk(
  'flights/addFlight',
  async (flightData, { rejectWithValue }) => {
    try {
      const data = await flightsAPI.create(flightData);
      return data;
    } catch (error) {
      try {
        const errObj = JSON.parse(error.message);
        return rejectWithValue(errObj);
      } catch (_) {
        return rejectWithValue({ non_field_errors: ['Failed to add flight'] });
      }
    }
  }
);

export const bulkImportFlights = createAsyncThunk(
  'flights/bulkImportFlights',
  async (flightsData, { rejectWithValue }) => {
    try {
      const data = await flightsAPI.bulkImport(flightsData);
      return data;
    } catch (error) {
      try {
        const errObj = JSON.parse(error.message);
        return rejectWithValue(errObj);
      } catch (_) {
        return rejectWithValue({ detail: 'Failed to import flights' });
      }
    }
  }
);

export const bulkImportFlightsCsv = createAsyncThunk(
  'flights/bulkImportFlightsCsv',
  async (file, { rejectWithValue }) => {
    try {
      const data = await flightsAPI.bulkImportCsv(file);
      return data;
    } catch (error) {
      try {
        const errObj = JSON.parse(error.message);
        return rejectWithValue(errObj);
      } catch (_) {
        return rejectWithValue({ detail: 'Failed to import CSV file' });
      }
    }
  }
);

export const updateFlight = createAsyncThunk(
  'flights/updateFlight',
  async ({ id, flightData }, { rejectWithValue }) => {
    try {
      const data = await flightsAPI.update(id, flightData);
      return data;
    } catch (error) {
      try {
        const errObj = JSON.parse(error.message);
        return rejectWithValue(errObj);
      } catch (_) {
        return rejectWithValue({ non_field_errors: ['Failed to update flight'] });
      }
    }
  }
);

export const patchFlight = createAsyncThunk(
  'flights/patchFlight',
  async ({ id, flightData }, { rejectWithValue }) => {
    try {
      const data = await flightsAPI.patch(id, flightData);
      return data;
    } catch (error) {
      try {
        const errObj = JSON.parse(error.message);
        return rejectWithValue(errObj);
      } catch (_) {
        return rejectWithValue({ non_field_errors: ['Failed to update flight status'] });
      }
    }
  }
);

export const deleteFlight = createAsyncThunk(
  'flights/deleteFlight',
  async (id, { rejectWithValue }) => {
    try {
      await flightsAPI.delete(id);
      return id;
    } catch (error) {
      let message = 'Failed to delete flight';
      try {
        const errObj = JSON.parse(error.message);
        message = errObj.detail || message;
      } catch (_) {}
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  list: [],
  count: 0,          // total number of flights matching current query (for pagination)
  currentPage: 1,    // which page we are on
  totalPages: 1,     // derived from count / page_size
  filters: {},       // active filter params for the admin listing
  stats: {           // global per-status counts — fetched independently, stable across pages
    total: 0,
    scheduled: 0,
    delayed: 0,
    cancelled: 0,
    boarding: 0,
    departed: 0,
    arrived: 0,
  },
  detail: null,
  loading: false,
  statsLoading: false,
  detailLoading: false,
  actionLoading: false,
  error: null,
  validationErrors: null,
};

const PAGE_SIZE = 10;

const flightSlice = createSlice({
  name: 'flights',
  initialState,
  reducers: {
    clearFlightErrors: (state) => {
      state.error = null;
      state.validationErrors = null;
    },
    clearFlightDetail: (state) => {
      state.detail = null;
    },
    setCurrentPage: (state, action) => {
      state.currentPage = action.payload;
    },
    setFilters: (state, action) => {
      state.filters = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {};
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch List
      .addCase(fetchFlights.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFlights.fulfilled, (state, action) => {
        state.loading = false;
        const { count, results } = action.payload;
        state.list = results;
        state.count = count;
        state.totalPages = Math.ceil(count / PAGE_SIZE);
      })
      .addCase(fetchFlights.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch Stats
      .addCase(fetchFlightStats.pending, (state) => {
        state.statsLoading = true;
      })
      .addCase(fetchFlightStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.stats = action.payload;
      })
      .addCase(fetchFlightStats.rejected, (state) => {
        state.statsLoading = false;
      })
      // Fetch Detail
      .addCase(fetchFlightDetail.pending, (state) => {
        state.detailLoading = true;
        state.error = null;
      })
      .addCase(fetchFlightDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.detail = action.payload;
      })
      .addCase(fetchFlightDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.error = action.payload;
      })
      // Add Flight
      .addCase(addFlight.pending, (state) => {
        state.actionLoading = true;
        state.validationErrors = null;
      })
      .addCase(addFlight.fulfilled, (state) => {
        state.actionLoading = false;
      })
      .addCase(addFlight.rejected, (state, action) => {
        state.actionLoading = false;
        state.validationErrors = action.payload;
      })
      // Bulk Import (JSON)
      .addCase(bulkImportFlights.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(bulkImportFlights.fulfilled, (state) => {
        state.actionLoading = false;
      })
      .addCase(bulkImportFlights.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload?.detail || 'Failed to import flights';
      })
      // Bulk Import (CSV)
      .addCase(bulkImportFlightsCsv.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(bulkImportFlightsCsv.fulfilled, (state) => {
        state.actionLoading = false;
      })
      .addCase(bulkImportFlightsCsv.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload?.detail || 'Failed to import CSV file';
      })
      // Update Flight
      .addCase(updateFlight.pending, (state) => {
        state.actionLoading = true;
        state.validationErrors = null;
      })
      .addCase(updateFlight.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.detail = action.payload;
        const index = state.list.findIndex(f => f.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
      })
      .addCase(updateFlight.rejected, (state, action) => {
        state.actionLoading = false;
        state.validationErrors = action.payload;
      })
      // Patch Flight
      .addCase(patchFlight.pending, (state) => {
        state.actionLoading = true;
        state.validationErrors = null;
      })
      .addCase(patchFlight.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.detail = action.payload;
        const index = state.list.findIndex(f => f.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
      })
      .addCase(patchFlight.rejected, (state, action) => {
        state.actionLoading = false;
        state.validationErrors = action.payload;
      })
      // Delete Flight
      .addCase(deleteFlight.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deleteFlight.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.list = state.list.filter(f => f.id !== action.payload);
        // Adjust count; caller re-fetches if page becomes empty
        state.count = Math.max(0, state.count - 1);
        state.totalPages = Math.ceil(state.count / PAGE_SIZE);
      })
      .addCase(deleteFlight.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearFlightErrors, clearFlightDetail, setCurrentPage, setFilters, clearFilters } = flightSlice.actions;
export default flightSlice.reducer;
