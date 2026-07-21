import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi } from 'vitest';
import MyBookingsPage from '../MyBookingsPage';

vi.mock('@/store/bookingSlice', () => ({
  fetchMyBookings: () => ({ type: 'fetchMyBookings' }),
  cancelBooking: () => ({ type: 'cancelBooking' }),
}));

vi.mock('@/store/waitlistSlice', () => ({
  fetchWaitlistEntries: () => ({ type: 'fetchWaitlistEntries' }),
  cancelWaitlistEntry: () => ({ type: 'cancelWaitlistEntry' }),
}));

describe('MyBookingsPage Component - Flight Status Integration', () => {
  const setupStore = (flightStatus = 'DELAYED') => {
    return configureStore({
      reducer: {
        bookings: (state = {
          list: [
            {
              id: 'b1',
              status: 'CONFIRMED',
              total_price: 5000,
              created_at: new Date().toISOString(),
              flight_detail: {
                id: 'f1',
                flight_number: 'AG-101',
                airline: 'Indigo',
                aircraft: 'A320',
                source_airport: 'DEL',
                destination_airport: 'BOM',
                departure_time: new Date(Date.now() + 86400000).toISOString(),
                arrival_time: new Date(Date.now() + 90000000).toISOString(),
                base_fare: 5000,
                status: flightStatus,
              }
            }
          ],
          listLoading: false,
          error: null,
        }) => state,
        waitlist: (state = {
          list: [],
          listLoading: false,
          error: null,
        }) => state,
      }
    });
  };

  it('renders DELAYED flight status badge in booking list item', () => {
    const store = setupStore('DELAYED');
    render(
      <Provider store={store}>
        <MemoryRouter>
          <MyBookingsPage />
        </MemoryRouter>
      </Provider>
    );

    // List item displays the DELAYED badge
    const badges = screen.getAllByText(/DELAYED/i);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows flight status warning banner in BookingDetailCard when flight is delayed', () => {
    const store = setupStore('DELAYED');
    render(
      <Provider store={store}>
        <MemoryRouter>
          <MyBookingsPage />
        </MemoryRouter>
      </Provider>
    );

    // Click list item to select booking
    const bookingItem = screen.getAllByText('AG-101')[0];
    fireEvent.click(bookingItem);

    // Check warning alert banner is shown
    expect(screen.getByText(/Flight Status: DELAYED/i)).toBeInTheDocument();
    expect(screen.getByText(/This flight is delayed/i)).toBeInTheDocument();
  });

  it('disables cancellation and displays reason when flight is cancelled', () => {
    const store = setupStore('CANCELLED');
    render(
      <Provider store={store}>
        <MemoryRouter>
          <MyBookingsPage />
        </MemoryRouter>
      </Provider>
    );

    // Select the booking
    const bookingItem = screen.getAllByText('AG-101')[0];
    fireEvent.click(bookingItem);

    // Warning alert banner shows CANCELLED
    expect(screen.getByText(/Flight Status: CANCELLED/i)).toBeInTheDocument();
    expect(screen.getByText(/This flight has been cancelled/i)).toBeInTheDocument();

    // Cancellation button should be replaced with explanatory disabled indicator
    expect(screen.getByText(/Cancellation unavailable: Flight has been cancelled/i)).toBeInTheDocument();
    expect(screen.queryByText('Cancel Reservation')).not.toBeInTheDocument();
  });
});
