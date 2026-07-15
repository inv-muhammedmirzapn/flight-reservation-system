import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Select } from '../Select';

describe('Select Component', () => {
  const options = [
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
    { value: 'opt3', label: 'Option 3' },
  ];

  it('renders label and selected option', () => {
    render(
      <Select
        id="test-select"
        label="Test Select"
        options={options}
        value="opt2"
        onChange={() => {}}
      />
    );

    expect(screen.getByText('Test Select')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('toggles dropdown options list on click', () => {
    render(
      <Select
        id="test-select"
        label="Test Select"
        options={options}
        value="opt2"
        onChange={() => {}}
      />
    );

    // Listbox should not be in document initially
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Click trigger to open
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();

    // Click trigger again to close
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('calls onChange with correct event structure when option is selected', () => {
    const handleChange = vi.fn();
    render(
      <Select
        id="test-select"
        name="test_select_name"
        label="Test Select"
        options={options}
        value="opt2"
        onChange={handleChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button'));

    // Click Option 3
    fireEvent.click(screen.getByText('Option 3'));

    expect(handleChange).toHaveBeenCalledTimes(1);
    const event = handleChange.mock.calls[0][0];
    expect(event.target.id).toBe('test-select');
    expect(event.target.name).toBe('test_select_name');
    expect(event.target.value).toBe('opt3');
  });

  it('supports keyboard navigation (ArrowDown, ArrowUp, Enter)', () => {
    const handleChange = vi.fn();
    render(
      <Select
        id="test-select"
        label="Test Select"
        options={options}
        value="opt2"
        onChange={handleChange}
      />
    );

    const button = screen.getByRole('button');

    // Press ArrowDown on the closed trigger to open it
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // The option 'opt2' is selected, so index 1 is highlighted initially
    // Press ArrowDown to highlight index 2 ('Option 3')
    fireEvent.keyDown(button, { key: 'ArrowDown' });

    // Press Enter to select the highlighted option
    fireEvent.keyDown(button, { key: 'Enter' });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0].target.value).toBe('opt3');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
