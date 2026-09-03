/**
 * Admin entity slices — all generated via createCrudSlice factory.
 * Each entity gets: fetchList, fetchDetail, add, update, remove thunks
 * and loading/error/items/selected state in Redux.
 */
import { createAsyncThunk } from '@reduxjs/toolkit';
import { createCrudSlice } from './crudSliceFactory';
import { fetchWithAuth } from '@/services/apiClient';
import { parseApiError } from '@/utils/errorUtils';

export const ADMIN_PAGE_SIZE = 10;

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

// Custom: apply a price to a list of seat IDs in one request
export const bulkPriceSeats = createAsyncThunk(
  'seat/bulkPrice',
  async ({ seatIds, price, ruleLabel = '' }, { rejectWithValue }) => {
    try {
      return await fetchWithAuth('/flights/v2/seats/bulk-price/', {
        method: 'POST',
        body: JSON.stringify({ seat_ids: seatIds, price, rule_label: ruleLabel }),
      });
    } catch (err) {
      return rejectWithValue(err.message || 'Bulk price failed');
    }
  }
);

// ─── SeatPriceTemplate ────────────────────────────────────────────────────────
const seatPriceTemplateSliceDef = createCrudSlice('seatPriceTemplate', '/flights/v2/seat-price-templates');
export const seatPriceTemplateActions = seatPriceTemplateSliceDef.actions;
export const {
  fetchList: fetchSeatPriceTemplates,
  fetchDetail: fetchSeatPriceTemplateDetail,
  add: addSeatPriceTemplate,
  update: updateSeatPriceTemplate,
  remove: removeSeatPriceTemplate,
} = seatPriceTemplateSliceDef.thunks;
export const seatPriceTemplateReducer = seatPriceTemplateSliceDef.slice.reducer;

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

// ─── RouteFareClass ───────────────────────────────────────────────────────────
const routeFareClassSliceDef = createCrudSlice('routeFareClass', '/flights/v2/route-fare-classes');
export const routeFareClassActions = routeFareClassSliceDef.actions;
export const {
  fetchList: fetchRouteFareClasses,
  fetchDetail: fetchRouteFareClassDetail,
  add: addRouteFareClass,
  update: updateRouteFareClass,
  remove: removeRouteFareClass,
} = routeFareClassSliceDef.thunks;
export const routeFareClassReducer = routeFareClassSliceDef.slice.reducer;

// Custom: update base price and reprice future unsold instances atomically
export const updateRouteFareClassPrice = createAsyncThunk(
  'routeFareClass/updatePrice',
  async ({ id, newBasePrice }, { rejectWithValue }) => {
    try {
      return await fetchWithAuth(`/flights/v2/route-fare-classes/${id}/update-price/`, {
        method: 'POST',
        body: JSON.stringify({ new_base_price: newBasePrice }),
      });
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to update route fare price');
    }
  }
);

// ─── DynamicPricingConfig ─────────────────────────────────────────────────────
const dynamicPricingConfigSliceDef = createCrudSlice('dynamicPricingConfig', '/pricing/dynamic-pricing-config');
export const dynamicPricingConfigActions = dynamicPricingConfigSliceDef.actions;
export const {
  fetchList: fetchDynamicPricingConfigs,
  fetchDetail: fetchDynamicPricingConfigDetail,
  update: updateDynamicPricingConfig,
} = dynamicPricingConfigSliceDef.thunks;
export const dynamicPricingConfigReducer = dynamicPricingConfigSliceDef.slice.reducer;

export const evaluateAllDynamicPricing = createAsyncThunk(
  'dynamicPricingConfig/evaluateAll',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchWithAuth('/pricing/dynamic-pricing-config/evaluate-all/', {
        method: 'POST',
      });
    } catch (err) {
      return rejectWithValue(parseApiError(err, 'Failed to trigger dynamic re-evaluation'));
    }
  }
);

export const simulateDynamicPricing = createAsyncThunk(
  'dynamicPricingConfig/simulate',
  async (payload, { rejectWithValue }) => {
    try {
      return await fetchWithAuth('/pricing/dynamic-pricing-config/simulate/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      return rejectWithValue(parseApiError(err, 'Simulation request failed'));
    }
  }
);

// ─── HolidayEvent ─────────────────────────────────────────────────────────────
const holidayEventSliceDef = createCrudSlice('holidayEvent', '/pricing/holiday-events');
export const holidayEventActions = holidayEventSliceDef.actions;
export const {
  fetchList: fetchHolidayEvents,
  fetchDetail: fetchHolidayEventDetail,
  add: addHolidayEvent,
  update: updateHolidayEvent,
  remove: removeHolidayEvent,
} = holidayEventSliceDef.thunks;
export const holidayEventReducer = holidayEventSliceDef.slice.reducer;

// ─── DynamicPriceLog ──────────────────────────────────────────────────────────
const dynamicPriceLogSliceDef = createCrudSlice('dynamicPriceLog', '/pricing/dynamic-price-logs');
export const dynamicPriceLogActions = dynamicPriceLogSliceDef.actions;
export const {
  fetchList: fetchDynamicPriceLogs,
  fetchDetail: fetchDynamicPriceLogDetail,
} = dynamicPriceLogSliceDef.thunks;
export const dynamicPriceLogReducer = dynamicPriceLogSliceDef.slice.reducer;


