import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi } from 'vitest';
import UserFlightsList from '../UserFlightsList';

// Mock components that might be problematic or that we want to simplify, if any.
// In our case, DatePicker and DateSwitcher are simple and don't need mocking.

// Build today's date string in local time (not UTC) to match what the filter now computes
const now = new Date();
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const sampleFlights = [
  {
    id: 1,
    flight_number: 'AG-101',
    airline: 'Passenger Gold',
    aircraft: 'Boeing 787',
    source_airport: 'COK',
    destination_airport: 'DEL',
    // Use noon local time — safely "today" in every timezone
    departure_time: new Date(`${todayStr}T12:00:00`).toISOString(),
    arrival_time: new Date(`${todayStr}T15:00:00`).toISOString(),
    base_fare: 5000,
    available_seats: 10,
    total_seats: 180,
    status: 'SCHEDULED',
    stops: [],
  },
  {
    id: 2,
    flight_number: 'AG-102',
    airline: 'Passenger Silver',
    aircraft: 'Airbus A320',
    source_airport: 'COK',
    destination_airport: 'DEL',
    departure_time: new Date(`${todayStr}T13:00:00`).toISOString(),
    arrival_time: new Date(`${todayStr}T17:30:00`).toISOString(),
    base_fare: 7500,
    available_seats: 2,
    total_seats: 150,
    status: 'SCHEDULED',
    stops: [{ stop_number: 1, stop_location: 'BLR', stop_arrival: new Date(`${todayStr}T14:30:00`).toISOString(), stop_layover: '1h', stop_departure: new Date(`${todayStr}T15:30:00`).toISOString() }],
  },
  {
    id: 3,
    flight_number: 'AG-103',
    airline: 'Passenger Deluxe',
    aircraft: 'Boeing 777',
    source_airport: 'COK',
    destination_airport: 'DEL',
    departure_time: new Date(`${todayStr}T14:00:00`).toISOString(),
    arrival_time: new Date(`${todayStr}T19:00:00`).toISOString(),
    base_fare: 12000,
    available_seats: 15,
    total_seats: 200,
    status: 'SCHEDULED',
    stops: [
      { stop_number: 1, stop_location: 'BLR' },
      { stop_number: 2, stop_location: 'BOM' }
    ],
  }
];

const renderComponent = (initialEntries = ['/flights'], preloadedFlights = sampleFlights) => {
  const store = configureStore({
    reducer: {
      flights: (state = { list: preloadedFlights, loading: false, error: null }) => state,
      auth: (state = { user: null }) => state
    }
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={initialEntries}>
        <UserFlightsList />
      </MemoryRouter>
    </Provider>
  );
};

describe('UserFlightsList Component', () => {
  it('renders all flights initially when no filters are set', () => {
    renderComponent();
    expect(screen.getByText('AG-101')).toBeInTheDocument();
    expect(screen.getByText('AG-102')).toBeInTheDocument();
    expect(screen.getByText('AG-103')).toBeInTheDocument();
    expect(screen.getByText('3 flights found')).toBeInTheDocument();
  });

  it('filters flights by search parameters in URL query parameters', () => {
    // Search for non-stop only by setting stops in URL
    renderComponent(['/flights?stops=0']);
    expect(screen.getByText('AG-101')).toBeInTheDocument();
    expect(screen.queryByText('AG-102')).not.toBeInTheDocument();
    expect(screen.queryByText('AG-103')).not.toBeInTheDocument();
    expect(screen.getByText('1 flight found')).toBeInTheDocument();
  });

  it('filters flights when the stops checkbox is clicked', () => {
    renderComponent();
    // Initially all 3 display. Click "Non-stop" checkbox
    const nonstopCheckbox = screen.getByLabelText('Non-stop');
    fireEvent.click(nonstopCheckbox);

    // After clicking Non-stop, only AG-101 should match
    expect(screen.getByText('AG-101')).toBeInTheDocument();
    expect(screen.queryByText('AG-102')).not.toBeInTheDocument();
  });

  it('filters flights by passenger selector seat constraints', () => {
    // 3 passengers total (2 adults, 1 child) -> should filter out AG-102 (2 seats available)
    renderComponent(['/flights?adults=2&children=1']);
    expect(screen.getByText('AG-101')).toBeInTheDocument();
    expect(screen.queryByText('AG-102')).not.toBeInTheDocument(); // excluded: total passengers (3) > available seats (2)
    expect(screen.getByText('AG-103')).toBeInTheDocument();
  });

  it('filters flights by dual min/max fare bounds', () => {
    renderComponent(['/flights?minFare=6000&maxFare=10000']);
    expect(screen.queryByText('AG-101')).not.toBeInTheDocument(); // 5000 is too low
    expect(screen.getByText('AG-102')).toBeInTheDocument(); // 7500 matches
    expect(screen.queryByText('AG-103')).not.toBeInTheDocument(); // 12000 is too high
  });
});
