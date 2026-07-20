import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';
import AnalyticsDashboard from '../AnalyticsDashboard';

// ─── Mock analytics service ────────────────────────────────────────────────
vi.mock('@/services/analytics-service', () => ({
  fetchAnalyticsSummary: vi.fn(),
  fetchMonthlyRevenue: vi.fn(),
  fetchPopularRoutes: vi.fn(),
  fetchFlightOccupancy: vi.fn(),
  fetchPeakBookingHours: vi.fn(),
}));

import {
  fetchAnalyticsSummary,
  fetchMonthlyRevenue,
  fetchPopularRoutes,
  fetchFlightOccupancy,
  fetchPeakBookingHours,
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
};
const MONTHLY  = [{ month: '2026-06', revenue: '250000' }, { month: '2026-07', revenue: '250000' }];
const ROUTES   = [{ route: 'JFK → LAX', bookings: 40 }, { route: 'LAX → JFK', bookings: 30 }];
const OCCUPANCY = [
  { flight_number: 'FL001', route: 'JFK → LAX', booked_seats: 90, total_seats: 100, occupancy_rate: 90.0 },
  { flight_number: 'FL002', route: 'LAX → JFK', booked_seats: 45, total_seats: 100, occupancy_rate: 45.0 },
];
const PEAK_HOURS = Array.from({ length: 24 }, (_, i) => ({ hour: i, bookings: i === 10 ? 20 : 5 }));

function mockSuccess() {
  fetchAnalyticsSummary.mockResolvedValue(SUMMARY);
  fetchMonthlyRevenue.mockResolvedValue(MONTHLY);
  fetchPopularRoutes.mockResolvedValue(ROUTES);
  fetchFlightOccupancy.mockResolvedValue(OCCUPANCY);
  fetchPeakBookingHours.mockResolvedValue(PEAK_HOURS);
}

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  it('renders all 6 KPI card labels after data loads', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(screen.getByText('Total Revenue')).toBeInTheDocument());
    expect(screen.getByText('Total Bookings')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('Cancellation Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Occupancy')).toBeInTheDocument();
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

  it('displays average occupancy computed from occupancy data', async () => {
    render(<AnalyticsDashboard />);
    // avg of [90, 45] = 67.5%
    await waitFor(() => expect(screen.getByText('67.5%')).toBeInTheDocument());
  });

  it('calls all 5 API endpoints on mount', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(fetchAnalyticsSummary).toHaveBeenCalledTimes(1));
    expect(fetchMonthlyRevenue).toHaveBeenCalledWith(12);
    expect(fetchPopularRoutes).toHaveBeenCalledWith(10);
    expect(fetchFlightOccupancy).toHaveBeenCalledWith(10);
    expect(fetchPeakBookingHours).toHaveBeenCalledTimes(1);
  });

  it('auto-refreshes after 30 seconds without user interaction', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(fetchAnalyticsSummary).toHaveBeenCalledTimes(1));

    // Advance the auto-refresh timer by 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    // Should have been called a second time (silent refresh)
    expect(fetchAnalyticsSummary).toHaveBeenCalledTimes(2);
  });

  it('does NOT render a standalone Refresh button', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(screen.getByText('Booking Analytics Dashboard')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^refresh$/i })).not.toBeInTheDocument();
  });

  it('shows "LIVE" updated timestamp pill after successful load', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(screen.getByText(/LIVE · Updated/i)).toBeInTheDocument());
  });

  it('shows error message and Retry button when API fails', async () => {
    fetchAnalyticsSummary.mockRejectedValue(new Error('Network error'));
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(screen.getByText(/Network error/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders all 4 chart section headings', async () => {
    render(<AnalyticsDashboard />);
    await waitFor(() => expect(screen.getByText(/Monthly Revenue/i)).toBeInTheDocument());
    expect(screen.getByText(/Popular Routes/i)).toBeInTheDocument();
    expect(screen.getByText(/Peak Booking Hours/i)).toBeInTheDocument();
    expect(screen.getByText(/Flight Occupancy/i)).toBeInTheDocument();
  });
});
