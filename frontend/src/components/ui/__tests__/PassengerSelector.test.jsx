import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PassengerSelector from '../PassengerSelector';

describe('PassengerSelector Component', () => {
  it('renders label and current summary', () => {
    render(
      <PassengerSelector
        label="Passengers"
        adults={1}
        setAdults={() => {}}
        childrenCount={0}
        setChildrenCount={() => {}}
        infants={0}
        setInfants={() => {}}
      />
    );
    
    expect(screen.getByText('Passengers')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1 Adult')).toBeInTheDocument();
  });

  it('opens popup on trigger click', () => {
    render(
      <PassengerSelector
        label="Passengers"
        adults={2}
        setAdults={() => {}}
        childrenCount={1}
        setChildrenCount={() => {}}
        infants={0}
        setInfants={() => {}}
      />
    );
    
    expect(screen.queryByText(/ADULTS/i)).not.toBeInTheDocument();
    
    // Click on input trigger
    fireEvent.click(screen.getByDisplayValue('2 Adults, 1 Child'));
    
    expect(screen.getByText(/ADULTS/i)).toBeInTheDocument();
    expect(screen.getByText(/CHILDREN/i)).toBeInTheDocument();
    expect(screen.getByText(/INFANTS/i)).toBeInTheDocument();
  });

  it('calls corresponding setters when passenger options are clicked', () => {
    const setAdults = vi.fn();
    const setChildren = vi.fn();
    const setInfants = vi.fn();

    render(
      <PassengerSelector
        label="Passengers"
        adults={1}
        setAdults={setAdults}
        childrenCount={0}
        setChildrenCount={setChildren}
        infants={0}
        setInfants={setInfants}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByDisplayValue('1 Adult'));

    // Find and click adult '5' button
    const adultButton = screen.getAllByRole('button', { name: '5' })[0];
    fireEvent.click(adultButton);
    expect(setAdults).toHaveBeenCalledWith(5);

    // Find and click child '3' button
    const childButton = screen.getAllByRole('button', { name: '3' })[1];
    fireEvent.click(childButton);
    expect(setChildren).toHaveBeenCalledWith(3);

    // Find and click infant '2' button
    const infantButton = screen.getAllByRole('button', { name: '2' })[2];
    fireEvent.click(infantButton);
    expect(setInfants).toHaveBeenCalledWith(2);
  });
});
