import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtectedRoute } from '../ProtectedRoute';

let mockAuthState = { isAuthenticated: false, isAdmin: false };

vi.mock('react-redux', () => ({
  useSelector: (fn) => fn({ auth: mockAuthState }),
}));

vi.mock('react-router-dom', () => ({
  Navigate: vi.fn(({ to }) => <div data-testid="navigate" data-to={to} />),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockAuthState = { isAuthenticated: false, isAdmin: false };
    vi.clearAllMocks();
  });

  it('renders children when guest accesses a guestOnly route', () => {
    mockAuthState = { isAuthenticated: false, isAdmin: false };
    render(
      <ProtectedRoute guestOnly>
        <div data-testid="child">Guest Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('redirects to /flights when authenticated user accesses a guestOnly route', () => {
    mockAuthState = { isAuthenticated: true, isAdmin: false };
    render(
      <ProtectedRoute guestOnly>
        <div data-testid="child">Guest Content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    const navigateEl = screen.getByTestId('navigate');
    expect(navigateEl).toBeInTheDocument();
    expect(navigateEl.getAttribute('data-to')).toBe('/flights');
  });

  it('redirects to /admin/flights when authenticated admin accesses a guestOnly route', () => {
    mockAuthState = { isAuthenticated: true, isAdmin: true };
    render(
      <ProtectedRoute guestOnly>
        <div data-testid="child">Guest Content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    const navigateEl = screen.getByTestId('navigate');
    expect(navigateEl).toBeInTheDocument();
    expect(navigateEl.getAttribute('data-to')).toBe('/admin/overview');
  });

  it('renders children when authenticated user accesses a non-guestOnly route', () => {
    mockAuthState = { isAuthenticated: true, isAdmin: false };
    render(
      <ProtectedRoute>
        <div data-testid="child">User Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('redirects to / when unauthenticated user accesses a protected route', () => {
    mockAuthState = { isAuthenticated: false, isAdmin: false };
    render(
      <ProtectedRoute>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    const navigateEl = screen.getByTestId('navigate');
    expect(navigateEl).toBeInTheDocument();
    expect(navigateEl.getAttribute('data-to')).toBe('/');
  });
});
