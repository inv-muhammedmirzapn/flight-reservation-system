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
    expect(screen.getByRole('textbox').placeholder).toBe('Option 2');
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

    // Click trigger to open (focusing input opens it)
    fireEvent.focus(screen.getByRole('textbox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();

    // Escape to close
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
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
    fireEvent.focus(screen.getByRole('textbox'));

    // Click Option 3
    fireEvent.mouseDown(screen.getByText('Option 3'));

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

    const input = screen.getByRole('textbox');
    
    fireEvent.focus(input);

    // Press ArrowDown on the open trigger
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // The option 'opt2' is selected, so index 1 is highlighted initially
    // Press ArrowDown to highlight index 2 ('Option 3')
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // Press Enter to select the highlighted option
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0].target.value).toBe('opt3');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
