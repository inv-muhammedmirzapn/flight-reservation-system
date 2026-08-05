import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';
import AnalyticsDashboard from '../AnalyticsDashboard';

// ─── Mock analytics service ────────────────────────────────────────────────
vi.mock('@/services/analytics-service', () => ({
  fetchAnalyticsSummary:    vi.fn(),
  fetchMonthlyRevenue:      vi.fn(),
  fetchPopularRoutes:       vi.fn(),
  fetchFlightOccupancy:     vi.fn(),
  fetchPeakBookingHours:    vi.fn(),
  fetchAirlinePerformance:  vi.fn(),
  fetchAircraftUtilization: vi.fn(),
}));

// Mock AnalyticsFilterBar so it doesn't try to fetch master-data lists
vi.mock('../components/AnalyticsFilterBar', () => ({
  default: ({ onFilterChange }) => (
    <div data-testid="filter-bar">
      <button onClick={() => onFilterChange({})}>Reset Filters</button>
    </div>
  ),
}));

import {
  fetchAnalyticsSummary,
  fetchMonthlyRevenue,
  fetchPopularRoutes,
  fetchFlightOccupancy,
  fetchPeakBookingHours,
  fetchAirlinePerformance,
  fetchAircraftUtilization,
} from '@/services/analytics-service';

// ─── Mock ResizeObserver (required by Recharts in jsdom) ──────────────────
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ─── Fixtures ─────────────────────────────────────────────────────────────
const SUMMARY = {
  total_revenue: '500000.00',
  total_bookings: 120,
  confirmed_bookings: 100,
  cancelled_bookings: 20,
  cancellation_rate: '16.67',
  avg_occupancy: 67.5,
};
const MONTHLY  = [{ month: '2026-06', revenue: '250000' }, { month: '2026-07', revenue: '250000' }];
const ROUTES   = [{ route: 'JFK → LAX', bookings: 40 }, { route: 'LAX → JFK', bookings: 30 }];
const OCCUPANCY = [
  { flight_number: 'FL001', route: 'JFK → LAX', booked_seats: 90, total_seats: 100, occupancy_rate: 90.0 },
  { flight_number: 'FL002', route: 'LAX → JFK', booked_seats: 45, total_seats: 100, occupancy_rate: 45.0 },
];
const PEAK_HOURS = Array.from({ length: 24 }, (_, i) => ({ hour: i, bookings: i === 10 ? 20 : 5 }));
const AIRLINE_PERF = [
  { airline_id: 1, airline_name: 'IndiGo', iata_code: '6E', total_revenue: 300000, total_bookings: 80, cancellation_rate: 10.0, avg_occupancy: 72.5 },
  { airline_id: 2, airline_name: 'Air India', iata_code: 'AI', total_revenue: 200000, total_bookings: 40, cancellation_rate: 15.0, avg_occupancy: 60.0 },
];
const AIRCRAFT_UTIL = [
  { aircraft_id: 1, registration: 'VT-INA', aircraft_model: 'Airbus A320', manufacturer: 'Airbus', airline_name: 'IndiGo', total_flights: 120, avg_occupancy: 75.0, economy_fill_rate: 78.0, business_fill_rate: 60.0, first_fill_rate: 0.0 },
];

function mockSuccess() {
  fetchAnalyticsSummary.mockResolvedValue(SUMMARY);
  fetchMonthlyRevenue.mockResolvedValue(MONTHLY);
  fetchPopularRoutes.mockResolvedValue(ROUTES);
  fetchFlightOccupancy.mockResolvedValue(OCCUPANCY);
  fetchPeakBookingHours.mockResolvedValue(PEAK_HOURS);
  fetchAirlinePerformance.mockResolvedValue(AIRLINE_PERF);
  fetchAircraftUtilization.mockResolvedValue(AIRCRAFT_UTIL);
}

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSuccess();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the page heading', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() =>
      expect(screen.getByText('Booking Analytics Dashboard')).toBeInTheDocument()
    );
  });

  it('renders all 5 KPI card labels after data loads', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(screen.getByText('Total Revenue')).toBeInTheDocument());
    expect(screen.getByText('Total Bookings')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('Cancellation Rate')).toBeInTheDocument();
  });

  it('displays correct total bookings count', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(screen.getByText('120')).toBeInTheDocument());
  });

  it('displays correct confirmed and cancelled counts', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument());
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('displays cancellation rate from API', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(screen.getByText('16.67%')).toBeInTheDocument());
  });


  it('calls all 7 API endpoints on mount', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(fetchAnalyticsSummary).toHaveBeenCalledTimes(1));
    expect(fetchMonthlyRevenue).toHaveBeenCalledWith(12, expect.any(Object));
    expect(fetchPopularRoutes).toHaveBeenCalledWith(10, expect.any(Object));
    expect(fetchFlightOccupancy).toHaveBeenCalledWith(10, expect.any(Object));
    expect(fetchPeakBookingHours).toHaveBeenCalledWith(expect.any(Object));
    expect(fetchAirlinePerformance).toHaveBeenCalledWith(10, expect.any(Object));
    expect(fetchAircraftUtilization).toHaveBeenCalledWith(10, expect.any(Object));
  });

  it('auto-refreshes after 30 seconds without user interaction', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(fetchAnalyticsSummary).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(fetchAnalyticsSummary).toHaveBeenCalledTimes(2);
  });

  it('shows error message and Retry button when API fails', async () => {
    fetchAnalyticsSummary.mockRejectedValue(new Error('Network error'));
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(screen.getByText(/Network error/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders all 6 chart section headings', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(screen.getByText(/Monthly Revenue/i)).toBeInTheDocument());
    expect(screen.getByText(/Popular Routes/i)).toBeInTheDocument();
    expect(screen.getByText(/Peak Booking Hours/i)).toBeInTheDocument();
    expect(screen.getByText(/Flight Occupancy/i)).toBeInTheDocument();
    expect(screen.getByText(/Airline Performance/i)).toBeInTheDocument();
    expect(screen.getByText(/Aircraft Utilization/i)).toBeInTheDocument();
  });

  it('renders the filter bar', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(screen.getByTestId('filter-bar')).toBeInTheDocument());
  });
});
