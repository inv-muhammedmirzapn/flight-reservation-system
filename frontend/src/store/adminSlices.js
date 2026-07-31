/**
 * Admin entity slices — all generated via createCrudSlice factory.
 * Each entity gets: fetchList, fetchDetail, add, update, remove thunks
 * and loading/error/items/selected state in Redux.
 */
import { createAsyncThunk } from '@reduxjs/toolkit';
import { createCrudSlice } from './crudSliceFactory';
import { fetchWithAuth } from '@/services/apiClient';

// ─── Country ──────────────────────────────────────────────────────────────────
const countrySliceDef = createCrudSlice('country', '/flights/v2/countries');
export const countryActions = countrySliceDef.actions;
export const {
  fetchList: fetchCountries,
  fetchDetail: fetchCountryDetail,
  add: addCountry,
  update: updateCountry,
  remove: removeCountry,
} = countrySliceDef.thunks;
export const countryReducer = countrySliceDef.slice.reducer;

// ─── Airport ──────────────────────────────────────────────────────────────────
const airportSliceDef = createCrudSlice('airport', '/flights/v2/airports');
export const airportActions = airportSliceDef.actions;
export const {
  fetchList: fetchAirports,
  fetchDetail: fetchAirportDetail,
  add: addAirport,
  update: updateAirport,
  remove: removeAirport,
} = airportSliceDef.thunks;
export const airportReducer = airportSliceDef.slice.reducer;

// ─── Airline ──────────────────────────────────────────────────────────────────
const airlineSliceDef = createCrudSlice('airline', '/flights/v2/airlines');
export const airlineActions = airlineSliceDef.actions;
export const {
  fetchList: fetchAirlines,
  fetchDetail: fetchAirlineDetail,
  add: addAirline,
  update: updateAirline,
  remove: removeAirline,
} = airlineSliceDef.thunks;
export const airlineReducer = airlineSliceDef.slice.reducer;

// ─── AircraftModel ────────────────────────────────────────────────────────────
const aircraftModelSliceDef = createCrudSlice('aircraftModel', '/flights/v2/aircraft-models');
export const aircraftModelActions = aircraftModelSliceDef.actions;
export const {
  fetchList: fetchAircraftModels,
  fetchDetail: fetchAircraftModelDetail,
  add: addAircraftModel,
  update: updateAircraftModel,
  remove: removeAircraftModel,
} = aircraftModelSliceDef.thunks;
export const aircraftModelReducer = aircraftModelSliceDef.slice.reducer;

// ─── Aircraft ─────────────────────────────────────────────────────────────────
const aircraftSliceDef = createCrudSlice('aircraft', '/flights/v2/aircraft');
export const aircraftActions = aircraftSliceDef.actions;
export const {
  fetchList: fetchAircraft,
  fetchDetail: fetchAircraftDetail,
  add: addAircraft,
  update: updateAircraft,
  remove: removeAircraft,
} = aircraftSliceDef.thunks;
export const aircraftReducer = aircraftSliceDef.slice.reducer;

// ─── FlightRoute ──────────────────────────────────────────────────────────────
const flightRouteSliceDef = createCrudSlice('flightRoute', '/flights/v2/flight-routes');
export const flightRouteActions = flightRouteSliceDef.actions;
export const {
  fetchList: fetchFlightRoutes,
  fetchDetail: fetchFlightRouteDetail,
  add: addFlightRoute,
  update: updateFlightRoute,
  remove: removeFlightRoute,
} = flightRouteSliceDef.thunks;
export const flightRouteReducer = flightRouteSliceDef.slice.reducer;

// ─── FlightInstance ───────────────────────────────────────────────────────────
const flightInstanceSliceDef = createCrudSlice('flightInstance', '/flights/v2/flight-instances');
export const flightInstanceActions = flightInstanceSliceDef.actions;
export const {
  fetchList: fetchFlightInstances,
  fetchDetail: fetchFlightInstanceDetail,
  add: addFlightInstance,
  update: updateFlightInstance,
  remove: removeFlightInstance,
} = flightInstanceSliceDef.thunks;
export const flightInstanceReducer = flightInstanceSliceDef.slice.reducer;

// Custom: generate seats
export const generateSeats = createAsyncThunk(
  'flightInstance/generateSeats',
  async (instanceId, { rejectWithValue }) => {
    try {
      return await fetchWithAuth(`/flights/v2/flight-instances/${instanceId}/generate-seats/`, {
        method: 'POST',
      });
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const applyPremiumPricing = createAsyncThunk(
  'flightInstance/applyPremiumPricing',
  async ({ instanceId, data }, { rejectWithValue }) => {
    try {
      return await fetchWithAuth(`/flights/v2/flight-instances/${instanceId}/apply-premium-pricing/`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// Custom: populate standard countries from pycountry presets
export const populateCountries = createAsyncThunk(
  'country/populatePresets',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchWithAuth('/flights/v2/countries/populate-presets/', {
        method: 'POST',
      });
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to populate countries');
    }
  }
);

// Custom: import openflights airports
export const importOpenFlights = createAsyncThunk(
  'airport/importOpenFlights',
  async (params = {}, { rejectWithValue }) => {
    const { overwrite, limit, file, countries } = params;
    const query = new URLSearchParams();
    if (overwrite !== undefined) query.append('overwrite', overwrite);
    if (limit !== undefined) query.append('limit', limit);
    if (countries !== undefined) query.append('countries', countries);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    try {
      let body;
      if (file) {
        body = new FormData();
        body.append('file', file);
      }
      return await fetchWithAuth(`/flights/v2/airports/import-openflights/${queryString}`, {
        method: 'POST',
        body,
      });
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to import airports');
    }
  }
);


// ─── Seat ─────────────────────────────────────────────────────────────────────
const seatSliceDef = createCrudSlice('seat', '/flights/v2/seats');
export const seatActions = seatSliceDef.actions;
export const {
  fetchList: fetchSeats,
  fetchDetail: fetchSeatDetail,
  add: addSeat,
  update: updateSeat,
  remove: removeSeat,
} = seatSliceDef.thunks;
export const seatReducer = seatSliceDef.slice.reducer;

// ─── Fare ─────────────────────────────────────────────────────────────────────
const fareSliceDef = createCrudSlice('fare', '/flights/v2/fares');
export const fareActions = fareSliceDef.actions;
export const {
  fetchList: fetchFares,
  fetchDetail: fetchFareDetail,
  add: addFare,
  update: updateFare,
  remove: removeFare,
} = fareSliceDef.thunks;
export const fareReducer = fareSliceDef.slice.reducer;

// ─── FoodItem ─────────────────────────────────────────────────────────────────
const foodItemSliceDef = createCrudSlice('foodItem', '/flights/v2/food-items');
export const foodItemActions = foodItemSliceDef.actions;
export const {
  fetchList: fetchFoodItems,
  fetchDetail: fetchFoodItemDetail,
  add: addFoodItem,
  update: updateFoodItem,
  remove: removeFoodItem,
} = foodItemSliceDef.thunks;
export const foodItemReducer = foodItemSliceDef.slice.reducer;

// ─── FlightMeal ───────────────────────────────────────────────────────────────
const flightMealSliceDef = createCrudSlice('flightMeal', '/flights/v2/flight-meals');
export const flightMealActions = flightMealSliceDef.actions;
export const {
  fetchList: fetchFlightMeals,
  fetchDetail: fetchFlightMealDetail,
  add: addFlightMeal,
  update: updateFlightMeal,
  remove: removeFlightMeal,
} = flightMealSliceDef.thunks;
export const flightMealReducer = flightMealSliceDef.slice.reducer;
