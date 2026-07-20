import { fetchWithAuth } from '@/services/apiClient';

export const fetchAnalyticsSummary = () =>
  fetchWithAuth('/analytics/summary/');

export const fetchMonthlyRevenue = (months = 12) =>
  fetchWithAuth(`/analytics/monthly-revenue/?months=${months}`);

export const fetchPopularRoutes = (top = 10) =>
  fetchWithAuth(`/analytics/popular-routes/?top=${top}`);

export const fetchFlightOccupancy = (top = 10) =>
  fetchWithAuth(`/analytics/flight-occupancy/?top=${top}`);

export const fetchPeakBookingHours = () =>
  fetchWithAuth('/analytics/peak-booking-hours/');
