import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi } from 'vitest';
import UserFlightsList from '../UserFlightsList';
import { fetchFlights } from '@/store/flightSlice';

// Build today's date string in local time (not UTC) to match what the filter computes
const now = new Date();
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

vi.mock('@/store/flightSlice', () => {
  const makeThunkMock = (type) => {
    return vi.fn((arg) => {
      const promise = Promise.resolve({ payload: { count: 3, results: [] } });
      promise.unwrap = () => Promise.resolve({ count: 3, results: [] });
      promise.type = type;
      promise.payload = arg;
      const thunkFn = (dispatch) => promise;
      thunkFn.type = type;
      thunkFn.payload = arg;
      return thunkFn;
    });
  };

  return {
    fetchFlights: makeThunkMock('fetchFlights'),
    clearFlightsList: vi.fn(() => ({ type: 'clearFlightsList' })),
  };
});

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
      flights: (state = { list: preloadedFlights, count: preloadedFlights.length, totalPages: 1, loading: false, error: null }) => state,
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
  it('renders all flights initially', () => {
    renderComponent();
    expect(screen.getByText('AG-101')).toBeInTheDocument();
    expect(screen.getByText('AG-102')).toBeInTheDocument();
    expect(screen.getByText('AG-103')).toBeInTheDocument();
    expect(screen.getByText('3 flights found')).toBeInTheDocument();
  });

  it('sorts flights chronologically by departure time on the client-side', () => {
    // Provide unsorted flights (AG-103 departs at 14:00, AG-101 departs at 12:00, AG-102 departs at 13:00)
    const unsortedFlights = [sampleFlights[2], sampleFlights[0], sampleFlights[1]];
    renderComponent(['/flights'], unsortedFlights);

    // Verify they are rendered in chronological order: AG-101 (12:00), AG-102 (13:00), AG-103 (14:00)
    const flightElements = screen.getAllByText(/AG-10/);
    expect(flightElements[0]).toHaveTextContent('AG-101');
    expect(flightElements[1]).toHaveTextContent('AG-102');
    expect(flightElements[2]).toHaveTextContent('AG-103');
  });

  it('dispatches fetchFlights with correct query parameters from the URL', () => {
    vi.clearAllMocks();
    renderComponent(['/flights?stops=0&adults=2&children=1&minFare=6000&maxFare=10000']);
    expect(fetchFlights).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          stops: '0',
          min_fare: 6000,
          max_fare: 10000,
          ordering: 'departure_time'
        })
      })
    );
  });

  it('dispatches fetchFlights when filter options are interacted with', () => {
    vi.clearAllMocks();
    renderComponent();
    // Click "Non-stop" checkbox
    const nonstopCheckbox = screen.getByLabelText('Non-stop');
    fireEvent.click(nonstopCheckbox);

    // It should dispatch fetchFlights with stops: '0' and ordering: 'departure_time'
    expect(fetchFlights).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          stops: '0',
          ordering: 'departure_time'
        })
      })
    );
  });

  it('does not dispatch fetchFlights on slider change, but dispatches immediately on mouse release', () => {
    vi.clearAllMocks();

    renderComponent();

    // Find the Min Price input slider
    const minPriceSlider = screen.getByLabelText('Min Price');
    
    // Simulate dragging the slider
    fireEvent.change(minPriceSlider, { target: { value: '4000' } });

    // Since the change event alone doesn't commit, fetchFlights should NOT have been called with 4000 yet
    expect(fetchFlights).not.toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          min_fare: 4000
        })
      })
    );

    // Simulate mouse release
    fireEvent.mouseUp(minPriceSlider);

    // Now it should have been called immediately with the committed value
    expect(fetchFlights).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          min_fare: 4000
        })
      })
    );
  });

  it('renders a "Waiting List" badge if a flight has 0 available seats', () => {
    const waitlistedFlight = {
      ...sampleFlights[0],
      id: 99,
      flight_number: 'AG-999',
      available_seats: 0
    };
    renderComponent(['/flights'], [waitlistedFlight]);
    expect(screen.getByText('Waiting List')).toBeInTheDocument();
  });
});
