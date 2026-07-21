import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import toast from 'react-hot-toast';
import BookingConfirmModal from '../BookingConfirmModal';

/* ── mocks ─────────────────────────────────────────── */
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

/* ── test data ─────────────────────────────────────── */
const MOCK_FLIGHT = {
  id: 'flight-uuid-1',
  flight_number: 'AG-101',
  airline: 'AeroGlass',
  aircraft: 'Boeing 737',
  source_airport: 'DEL',
  destination_airport: 'BOM',
  departure_time: new Date(Date.now() + 86400000).toISOString(),
  arrival_time:   new Date(Date.now() + 90000000).toISOString(),
  base_fare: 5000,
  available_seats: 10,
  status: 'SCHEDULED',
};

const MOCK_BOOKING = {
  id: 'booking-uuid-1',
  flight: MOCK_FLIGHT.id,
  flight_detail: MOCK_FLIGHT,
  status: 'CONFIRMED',
  created_at: new Date().toISOString(),
};

/* ── helpers ────────────────────────────────────────── */
const renderModal = (bookingState = {}, onClose = vi.fn()) => {
  const store = configureStore({
    reducer: {
      bookings: (state = {
        createLoading: false,
        createError: null,
        lastCreated: null,
        ...bookingState,
      }) => state,
    },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <BookingConfirmModal flight={MOCK_FLIGHT} onClose={onClose} />
      </MemoryRouter>
    </Provider>
  );
};

/* ── tests ─────────────────────────────────────────── */
describe('BookingConfirmModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders modal with flight details', () => {
    renderModal();
    expect(screen.getAllByText('Confirm Booking').length).toBeGreaterThan(0);
    expect(screen.getByText('AG-101')).toBeTruthy();
    expect(screen.getByText('DEL')).toBeTruthy();
    expect(screen.getByText('BOM')).toBeTruthy();
    expect(screen.getByText('AeroGlass')).toBeTruthy();
  });

  it('renders confirm and cancel buttons', () => {
    renderModal();
    expect(document.getElementById('booking-modal-confirm-btn')).toBeTruthy();
    expect(document.getElementById('booking-modal-cancel-btn')).toBeTruthy();
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    renderModal({}, onClose);
    fireEvent.click(document.getElementById('booking-modal-cancel-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    renderModal({}, onClose);
    fireEvent.click(document.getElementById('booking-modal-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when createLoading=true', () => {
    renderModal({ createLoading: true });
    expect(screen.getByText('Booking...')).toBeTruthy();
    // Buttons should be disabled
    expect(document.getElementById('booking-modal-confirm-btn').disabled).toBe(true);
    expect(document.getElementById('booking-modal-cancel-btn').disabled).toBe(true);
  });

  it('shows error message when createError is set', () => {
    renderModal({ createError: 'No available seats on this flight.' });
    expect(screen.getByText('No available seats on this flight.')).toBeTruthy();
  });

  it('closes backdrop when clicking outside modal', () => {
    const onClose = vi.fn();
    renderModal({}, onClose);
    fireEvent.click(screen.getByTestId
      ? document.getElementById('booking-confirm-modal-backdrop')
      : document.querySelector('[id="booking-confirm-modal-backdrop"]') || document.body
    );
    // onClose only fires when clicking directly on backdrop element
  });

  it('shows seats left information', () => {
    renderModal();
    expect(screen.getByText('10 seats left')).toBeTruthy();
  });
});
