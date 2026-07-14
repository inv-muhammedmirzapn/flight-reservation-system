import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DateSwitcher from '../DateSwitcher';

describe('DateSwitcher Component', () => {
  it('renders previous, current, and next dates relative to the active date', () => {
    // July 15, 2026
    const activeDate = '2026-07-15';
    render(<DateSwitcher activeDate={activeDate} onDateChange={() => {}} />);

    // Active/current date should be present
    expect(screen.getByText('15 Jul 2026')).toBeInTheDocument();
    // Previous date (July 14) should be present
    expect(screen.getByText('14 Jul')).toBeInTheDocument();
    // Next date (July 16) should be present
    expect(screen.getByText('16 Jul')).toBeInTheDocument();
  });

  it('calls onDateChange with previous date when clicking previous card', () => {
    const handleDateChange = vi.fn();
    render(<DateSwitcher activeDate="2026-07-15" onDateChange={handleDateChange} />);

    const prevCard = screen.getByText('14 Jul').closest('button');
    expect(prevCard).toBeInTheDocument();
    fireEvent.click(prevCard);

    expect(handleDateChange).toHaveBeenCalledWith('2026-07-14');
  });

  it('calls onDateChange with next date when clicking next card', () => {
    const handleDateChange = vi.fn();
    render(<DateSwitcher activeDate="2026-07-15" onDateChange={handleDateChange} />);

    const nextCard = screen.getByText('16 Jul').closest('button');
    expect(nextCard).toBeInTheDocument();
    fireEvent.click(nextCard);

    expect(handleDateChange).toHaveBeenCalledWith('2026-07-16');
  });
});
