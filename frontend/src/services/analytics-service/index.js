import { fetchWithAuth } from '@/services/apiClient';

/**
 * Keys: startDate, endDate, airlineId, aircraftId, top, months
 * Any undefined/null/empty values are omitted.
 */
function buildParams(extras = {}) {
  const map = {
    startDate:  'start_date',
    endDate:    'end_date',
    airlineId:  'airline_id',
    aircraftId: 'aircraft_id',
    top:        'top',
    months:     'months',
  };
  const qs = new URLSearchParams();
  for (const [jsKey, apiKey] of Object.entries(map)) {
    const val = extras[jsKey];
    if (val !== undefined && val !== null && val !== '') {
      qs.append(apiKey, val);
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const fetchAnalyticsSummary = (filters = {}) =>
  fetchWithAuth(`/analytics/summary/${buildParams(filters)}`);

export const fetchMonthlyRevenue = (months = 12, filters = {}) =>
  fetchWithAuth(`/analytics/monthly-revenue/${buildParams({ months, ...filters })}`);

export const fetchPopularRoutes = (top = 10, filters = {}) =>
  fetchWithAuth(`/analytics/popular-routes/${buildParams({ top, ...filters })}`);

export const fetchFlightOccupancy = (top = 10, filters = {}) =>
  fetchWithAuth(`/analytics/flight-occupancy/${buildParams({ top, ...filters })}`);

export const fetchPeakBookingHours = (filters = {}) =>
  fetchWithAuth(`/analytics/peak-booking-hours/${buildParams(filters)}`);

export const fetchAirlinePerformance = (top = 10, filters = {}) =>
  fetchWithAuth(`/analytics/airline-performance/${buildParams({ top, ...filters })}`);

export const fetchAircraftUtilization = (top = 10, filters = {}) =>
  fetchWithAuth(`/analytics/aircraft-utilization/${buildParams({ top, ...filters })}`);
