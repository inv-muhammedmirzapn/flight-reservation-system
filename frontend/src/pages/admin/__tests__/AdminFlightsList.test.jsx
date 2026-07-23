import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminFlightsList from '../AdminFlightsList';

const mockDispatch = vi.fn().mockImplementation(() => Promise.resolve({ meta: { requestStatus: 'fulfilled' } }));

vi.mock('react-redux', async () => {
  const actual = await vi.importActual('react-redux');
  return {
    ...actual,
    useDispatch: () => mockDispatch,
    useSelector: (fn) => fn({
      flights: {
        list: [
          {
            id: '123',
            flight_number: 'AG-101',
            airline: 'Passenger Gold',
            aircraft: 'Boeing 787',
            source_airport: 'COK',
            destination_airport: 'DEL',
            departure_time: '2026-07-14T10:00:00Z',
            arrival_time: '2026-07-14T13:00:00Z',
            base_fare: 5000,
            available_seats: 10,
            total_seats: 180,
            status: 'SCHEDULED'
          }
        ],
        loading: false,
        actionLoading: false,
        validationErrors: null,
        error: null
      }
    })
  };
});

describe('AdminFlightsList Component', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('renders flights list with details', () => {
    render(
      <MemoryRouter>
        <AdminFlightsList />
      </MemoryRouter>
    );

    expect(screen.getByText('AG-101')).toBeInTheDocument();
    expect(screen.getByText('Passenger Gold')).toBeInTheDocument();
  });

  it('asks for confirmation and dispatches deleteFlight when delete is clicked', () => {
    render(
      <MemoryRouter>
        <AdminFlightsList />
      </MemoryRouter>
    );

    // Click the delete action button to open dialog
    const deleteBtn = screen.getByTitle('Delete');
    fireEvent.click(deleteBtn);

    // Verify dialog is open
    expect(screen.getByText('Delete Flight?')).toBeInTheDocument();
    expect(screen.getByText(/You are about to permanently delete/)).toBeInTheDocument();

    // Click confirm inside dialog
    const confirmBtn = screen.getByText('Yes, Delete Flight');
    fireEvent.click(confirmBtn);

    expect(mockDispatch).toHaveBeenCalled();
  });

  it('does not dispatch deleteFlight if user cancels confirmation', () => {
    render(
      <MemoryRouter>
        <AdminFlightsList />
      </MemoryRouter>
    );

    // Click the delete action button to open dialog
    const deleteBtn = screen.getByTitle('Delete');
    fireEvent.click(deleteBtn);

    // Verify dialog is open
    expect(screen.getByText('Delete Flight?')).toBeInTheDocument();

    // Click cancel inside dialog
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    // Verify dialog is closed
    expect(screen.queryByText('Delete Flight?')).not.toBeInTheDocument();
    
    // We should not dispatch any delete thunk/action
    const dispatchedActions = mockDispatch.mock.calls.map(call => {
      return typeof call[0] === 'function' ? call[0].name : (call[0] && call[0].type);
    });
    
    const hasDeleteAction = dispatchedActions.some(nameOrType => 
      nameOrType && (nameOrType.includes('deleteFlight') || nameOrType.includes('delete'))
    );
    expect(hasDeleteAction).toBe(false);
  });
});
