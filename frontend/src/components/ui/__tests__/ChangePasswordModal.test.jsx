import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChangePasswordModal from '../ChangePasswordModal';

describe('ChangePasswordModal Validation', () => {
  it('displays "Passwords do not match." when confirm password is typed but new password is empty', async () => {
    render(<ChangePasswordModal isOpen={true} onClose={vi.fn()} />);

    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');

    // Type a value into confirm password field
    fireEvent.change(confirmPasswordInput, { target: { value: 'somepassword' } });
    fireEvent.blur(confirmPasswordInput);

    // Should display "Passwords do not match."
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(screen.queryByText('Passwords match ✓')).not.toBeInTheDocument();
  });
});
