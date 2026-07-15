import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DatePicker from '../DatePicker';

describe('DatePicker Component', () => {
  it('renders label and value or placeholder', () => {
    render(<DatePicker label="Test Date" placeholder="Select a date" value="" onChange={() => {}} />);
    
    expect(screen.getByText('Test Date')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Select a date')).toBeInTheDocument();
  });

  it('opens calendar on input click', () => {
    render(<DatePicker label="Test Date" placeholder="Select a date" value="" onChange={() => {}} />);
    
    // Calendar should not be visible initially
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();

    // Click input to open calendar
    fireEvent.click(screen.getByPlaceholderText('Select a date'));

    // Calendar grid should now be visible
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('calls onChange with selected date when a day is clicked', () => {
    const handleChange = vi.fn();
    
    // We render the component with a pre-set active month to make the test deterministic
    // Let's pass an initial value like "2026-07-15"
    render(<DatePicker label="Test Date" placeholder="Select a date" value="2026-07-15" onChange={handleChange} />);
    
    // Open calendar
    fireEvent.click(screen.getByDisplayValue('2026-07-15'));
    
    // Select the day '20' in the current month (July 2026)
    const dayButton = screen.getByRole('button', { name: '20' });
    fireEvent.click(dayButton);
    
    expect(handleChange).toHaveBeenCalledWith('2026-07-20');
  });

  it('clears selected date when clear button is clicked', () => {
    const handleChange = vi.fn();
    render(<DatePicker label="Test Date" placeholder="Select a date" value="2026-07-15" onChange={handleChange} />);
    
    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);
    
    expect(handleChange).toHaveBeenCalledWith('');
  });
});
