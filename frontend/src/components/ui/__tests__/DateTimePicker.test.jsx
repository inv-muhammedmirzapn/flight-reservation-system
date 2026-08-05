import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DateTimePicker from '../DateTimePicker';

describe('DateTimePicker Component', () => {
  it('renders label and value', () => {
    render(
      <DateTimePicker
        id="test-datetime"
        label="Test DateTime"
        placeholder="Select Date & Time"
        value="2026-07-15T10:30:00"
        onChange={() => {}}
      />
    );

    expect(screen.getByText('Test DateTime')).toBeInTheDocument();
    expect(screen.getByText('2026-07-15 10:30:00')).toBeInTheDocument();
  });

  it('opens calendar and time popup on trigger click', () => {
    render(
      <DateTimePicker
        id="test-datetime"
        label="Test DateTime"
        value=""
        onChange={() => {}}
      />
    );

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('datetime-trigger'));
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
  });

  it('calls onChange when selecting a day', () => {
    const handleChange = vi.fn();
    render(
      <DateTimePicker
        id="test-datetime"
        name="test_datetime_name"
        label="Test DateTime"
        value="2026-07-15T10:30"
        onChange={handleChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('datetime-trigger'));

    // Select the day '20' in July 2026
    const dayBtn = screen.getByRole('button', { name: '20' });
    fireEvent.click(dayBtn);

    expect(handleChange).toHaveBeenCalledTimes(1);
    const event = handleChange.mock.calls[0][0];
    expect(event.target.id).toBe('test-datetime');
    expect(event.target.name).toBe('test_datetime_name');
    expect(event.target.value).toBe('2026-07-20T10:30');
  });

  it('calls onChange when changing the time input', () => {
    const handleChange = vi.fn();
    render(
      <DateTimePicker
        id="test-datetime"
        label="Test DateTime"
        value="2026-07-15T10:30"
        onChange={handleChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('datetime-trigger'));

    // Locate time inputs by ID and change them
    const hourInput = document.getElementById('test-datetime-h');
    const minInput = document.getElementById('test-datetime-m');
    
    // Changing hour to 15
    fireEvent.change(hourInput, { target: { value: '15' } });
    fireEvent.blur(hourInput);
    
    // Changing min to 45
    fireEvent.change(minInput, { target: { value: '45' } });
    fireEvent.blur(minInput);

    // onChange should be called for each blur/commit
    expect(handleChange).toHaveBeenCalled();
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCall.target.value).toBe('2026-07-15T15:45');
  });

  it('calls onChange with empty string when cleared', () => {
    const handleChange = vi.fn();
    render(
      <DateTimePicker
        id="test-datetime"
        label="Test DateTime"
        value="2026-07-15T10:30"
        onChange={handleChange}
      />
    );

    const clearBtn = screen.getByLabelText(/clear/i);
    fireEvent.click(clearBtn);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0].target.value).toBe('');
  });
});
