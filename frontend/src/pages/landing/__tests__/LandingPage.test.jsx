import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LandingPage from '../LandingPage';

const mockNavigate = vi.fn();
let mockAuthState = { isAuthenticated: false, isAdmin: false };

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-redux', () => ({
  useSelector: (fn) => fn({ auth: mockAuthState }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

vi.mock('@/components/ui/DatePicker', () => ({
  default: () => <div data-testid="date-picker" />
}));

vi.mock('@/components/ui/PassengerSelector', () => ({
  default: () => <div data-testid="passenger-selector" />
}));

describe('LandingPage Redirect Behavior', () => {
  beforeEach(() => {
    mockAuthState = { isAuthenticated: false, isAdmin: false };
    mockNavigate.mockClear();
  });

  it('renders landing page when user is not authenticated', () => {
    mockAuthState = { isAuthenticated: false, isAdmin: false };
    render(<LandingPage />);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders landing page when normal user is authenticated', () => {
    mockAuthState = { isAuthenticated: true, isAdmin: false };
    render(<LandingPage />);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('redirects to admin flights page when admin is authenticated', () => {
    mockAuthState = { isAuthenticated: true, isAdmin: true };
    render(<LandingPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/flights', { replace: true });
  });
});
