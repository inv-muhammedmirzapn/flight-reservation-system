import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminFlightForm from '../AdminFlightForm';

const mockUnwrap = vi.fn().mockResolvedValue({});
const mockDispatch = vi.fn().mockImplementation(() => {
  const promise = Promise.resolve({ meta: { requestStatus: 'fulfilled' } });
  promise.unwrap = mockUnwrap;
  return promise;
});

let mockParams = {};
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => mockParams,
  };
});

const mockFlightDetail = {
  id: '123',
  flight_number: 'AG-101',
  airline: 'AeroGlass Gold',
  aircraft: 'Boeing 787',
  source_airport: 'COK',
  destination_airport: 'DEL',
  departure_time: '2026-07-20T10:00:00Z',
  arrival_time: '2026-07-20T13:00:00Z',
  base_fare: 5000,
  available_seats: 180,
  total_seats: 180,
  status: 'SCHEDULED'
};

vi.mock('react-redux', async () => {
  const actual = await vi.importActual('react-redux');
  return {
    ...actual,
    useDispatch: () => mockDispatch,
    useSelector: (fn) => fn({
      flights: {
        detail: mockFlightDetail,
        detailLoading: false,
        actionLoading: false,
        validationErrors: null,
        error: null
      }
    })
  };
});

describe('AdminFlightForm Component', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockParams = {};
  });

  it('renders Add Flight Route title when not editing', () => {
    render(
      <MemoryRouter>
        <AdminFlightForm />
      </MemoryRouter>
    );

    expect(screen.getByText('Add Flight Route')).toBeInTheDocument();
    expect(screen.getByText('Save Flight Route')).toBeInTheDocument();
  });

  it('shows validation errors for required fields on empty submit', async () => {
    render(
      <MemoryRouter>
        <AdminFlightForm />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Save Flight Route'));

    expect(await screen.findByText('Flight number is required.')).toBeInTheDocument();
    expect(screen.getByText('Airline is required.')).toBeInTheDocument();
    expect(screen.getByText('Aircraft is required.')).toBeInTheDocument();
    expect(screen.getByText('Source airport is required.')).toBeInTheDocument();
    expect(screen.getByText('Destination airport is required.')).toBeInTheDocument();
    expect(screen.getByText('Base fare is required.')).toBeInTheDocument();
    expect(screen.getByText('Total seats is required.')).toBeInTheDocument();
    expect(screen.getByText('Available seats is required.')).toBeInTheDocument();
  });

  it('validates that source and destination airports cannot be identical', async () => {
    render(
      <MemoryRouter>
        <AdminFlightForm />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Source Airport/i), { target: { value: 'COK' } });
    fireEvent.change(screen.getByLabelText(/Destination Airport/i), { target: { value: 'COK' } });
    fireEvent.click(screen.getByText('Save Flight Route'));

    expect(await screen.findByText('Source and destination airports cannot be identical.')).toBeInTheDocument();
  });

  it('populates fields and renders Edit Flight Route when id is passed', async () => {
    mockParams = { id: '123' };

    render(
      <MemoryRouter>
        <AdminFlightForm />
      </MemoryRouter>
    );

    expect(screen.getByText('Edit Flight Route')).toBeInTheDocument();
    
    const flightNumberInput = screen.getByLabelText(/Flight Number/i);
    expect(flightNumberInput).toBeDisabled();
    expect(flightNumberInput.value).toBe('AG-101');
    expect(screen.getByLabelText(/Airline/i).value).toBe('AeroGlass Gold');
    expect(screen.getByLabelText(/Aircraft Model/i).value).toBe('Boeing 787');
  });

  it('dispatches updateFlight when editing and submitting valid data', async () => {
    mockParams = { id: '123' };

    render(
      <MemoryRouter>
        <AdminFlightForm />
      </MemoryRouter>
    );

    // Inputs are populated from mockFlightDetail
    fireEvent.click(screen.getByText('Save Flight Route'));

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalled();
    });
  });
});
