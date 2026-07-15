import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminFlightsList from '../AdminFlightsList';

const mockDispatch = vi.fn();

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
            airline: 'AeroGlass Gold',
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
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('renders flights list with details', () => {
    render(
      <MemoryRouter>
        <AdminFlightsList />
      </MemoryRouter>
    );

    expect(screen.getByText('AG-101')).toBeInTheDocument();
    expect(screen.getByText('AeroGlass Gold')).toBeInTheDocument();
  });

  it('asks for confirmation and dispatches deleteFlight when delete is clicked', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <AdminFlightsList />
      </MemoryRouter>
    );

    const deleteBtn = screen.getByTitle('Delete');
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete flight AG-101?');
    expect(mockDispatch).toHaveBeenCalled();
  });

  it('does not dispatch deleteFlight if user cancels confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <MemoryRouter>
        <AdminFlightsList />
      </MemoryRouter>
    );

    const deleteBtn = screen.getByTitle('Delete');
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete flight AG-101?');
    
    // We should not dispatch any delete thunk/action
    const dispatchedActions = mockDispatch.mock.calls.map(call => {
      // In Redux Toolkit, thunks are functions, so call[0] is either a function or an action object
      return typeof call[0] === 'function' ? call[0].name : (call[0] && call[0].type);
    });
    
    const hasDeleteAction = dispatchedActions.some(nameOrType => 
      nameOrType && (nameOrType.includes('deleteFlight') || nameOrType.includes('delete'))
    );
    expect(hasDeleteAction).toBe(false);
  });
});
