import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flightsAPI } from '../flightService';
import * as apiClient from '@/services/apiClient';

vi.mock('@/services/apiClient', () => ({
  API_BASE_URL: '/api',
  fetchWithAuth: vi.fn(),
  getResponseData: vi.fn(),
}));

describe('flightsAPI.getNearestAirport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls fetchWithAuth with correct endpoint and coordinates', async () => {
    const mockAirport = {
      id: 1,
      iata_code: 'DEL',
      airport_name: 'Indira Gandhi International Airport',
      city: 'New Delhi',
      distance_km: 8.42,
    };
    apiClient.fetchWithAuth.mockResolvedValueOnce(mockAirport);

    const lat = 28.6139;
    const lng = 77.209;
    const result = await flightsAPI.getNearestAirport(lat, lng);

    expect(apiClient.fetchWithAuth).toHaveBeenCalledTimes(1);
    expect(apiClient.fetchWithAuth).toHaveBeenCalledWith(
      `/flights/v2/airports/nearest/?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
      {}
    );
    expect(result).toEqual(mockAirport);
  });

  it('passes custom options (e.g. AbortSignal) to fetchWithAuth', async () => {
    apiClient.fetchWithAuth.mockResolvedValueOnce({});
    const controller = new AbortController();
    const options = { signal: controller.signal };

    await flightsAPI.getNearestAirport(12.9716, 77.5946, options);

    expect(apiClient.fetchWithAuth).toHaveBeenCalledWith(
      '/flights/v2/airports/nearest/?lat=12.9716&lng=77.5946',
      options
    );
  });
});
