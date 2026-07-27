import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi, afterEach } from 'vitest';
import toast from 'react-hot-toast';
import UserFlightDetail from '../UserFlightDetail';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  }
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '1' }),
  };
});

describe('UserFlightDetail Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (isAuthenticated = false) => {
    const store = configureStore({
      reducer: {
        flights: (state = { 
          detail: { 
            id: 1, 
            flight_number: 'AG-101', 
            base_fare: 5000, 
            departure_time: new Date(Date.now() + 86400000).toISOString(), 
            arrival_time: new Date(Date.now() + 90000000).toISOString(),
            available_seats: 10,
            status: 'SCHEDULED'
          }, 
          detailLoading: false, 
          error: null 
        }) => state,
        auth: (state = { isAuthenticated, user: isAuthenticated ? { id: 1 } : null }) => state,
        bookings: (state = {
          createLoading: false,
          createError: null,
          lastCreated: null,
        }) => state,
      }
    });

    return render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/flights/1']}>
          <UserFlightDetail />
        </MemoryRouter>
      </Provider>
    );
  };

  it('redirects to /login and shows toast if not logged in when clicking Book Now', () => {
    renderComponent(false);
    const bookNowBtn = screen.getByText(/Book Now/i);
    fireEvent.click(bookNowBtn);

    expect(toast.error).toHaveBeenCalledWith('Please Login to book flights.');
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('does not redirect to /login if user is logged in', () => {
    renderComponent(true);
    const bookNowBtn = screen.getByText(/Book Now/i);
    fireEvent.click(bookNowBtn);

    expect(mockNavigate).not.toHaveBeenCalledWith('/login');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
