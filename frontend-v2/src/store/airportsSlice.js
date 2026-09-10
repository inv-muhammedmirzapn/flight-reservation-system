import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { flightsAPI } from '@/services/flight-service/flightService';
import { registerAirports } from '@/utils/airportHelpers';

export const fetchAirports = createAsyncThunk(
  'airports/fetchAirports',
  async (params = { page_size: 1000 }, { rejectWithValue }) => {
    try {
      const data = await flightsAPI.getAirports(params);
      const results = data?.results || (Array.isArray(data) ? data : []);
      const formatted = results.map((item) => ({
        id: item.id,
        code: (item.iata_code || item.code || '').trim().toUpperCase(),
        city: item.city || '',
        name: item.airport_name || item.name || '',
        country: item.country_name || item.country || '',
        timezone: item.timezone || '',
        latitude: item.latitude || '',
        longitude: item.longitude || '',
        terminals: item.terminals || [],
      }));

      // Register into airportHelpers so getAirportInfo knows these dynamically
      registerAirports(formatted);

      return formatted;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch airports');
    }
  }
);

const initialState = {
  items: [],
  loading: false,
  loaded: false,
  error: null,
};

const airportsSlice = createSlice({
  name: 'airports',
  initialState,
  reducers: {
    setAirports: (state, action) => {
      state.items = action.payload;
      state.loaded = true;
      registerAirports(action.payload);
    },
    clearAirports: (state) => {
      state.items = [];
      state.loaded = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAirports.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAirports.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.items = action.payload;
      })
      .addCase(fetchAirports.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to load airports';
      });
  },
});

export const { setAirports, clearAirports } = airportsSlice.actions;
export default airportsSlice.reducer;
