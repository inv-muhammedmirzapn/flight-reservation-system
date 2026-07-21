import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Navbar } from '../layout/Navbar';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/' }),
  };
});

vi.mock('@/store/notificationsSlice', () => ({
  fetchNotifications: () => ({ type: 'fetchNotifications' }),
}));

describe('Navbar - Notifications Integration', () => {
  const setupStore = (isAuthenticated = true, unreadCount = 0) => {
    return configureStore({
      reducer: {
        auth: (state = {
          isAuthenticated,
          isAdmin: false,
          profile: { first_name: 'John', username: 'john' }
        }) => state,
        notifications: (state = {
          list: [],
          listLoading: false,
          listError: null,
          unreadCount,
        }) => state,
      }
    });
  };

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('does not render notifications bell when user is not authenticated', () => {
    const store = setupStore(false, 0);
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.queryByRole('button', { name: /profile menu/i })).not.toBeInTheDocument();
    expect(document.querySelector('#nav-notifications-bell')).not.toBeInTheDocument();
  });

  it('renders notifications bell when user is authenticated', () => {
    const store = setupStore(true, 0);
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </Provider>
    );

    expect(document.querySelector('#nav-notifications-bell')).toBeInTheDocument();
  });

  it('displays the unread notification badge when count is greater than 0', () => {
    const store = setupStore(true, 5);
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('navigates to notifications page when bell is clicked', () => {
    const store = setupStore(true, 3);
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </Provider>
    );

    const bellBtn = document.querySelector('#nav-notifications-bell');
    fireEvent.click(bellBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/notifications');
  });

  it('renders notifications option inside profile dropdown', () => {
    const store = setupStore(true, 3);
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </Provider>
    );

    // Click profile avatar to open dropdown
    const avatarBtn = screen.getByRole('button', { name: /profile menu/i });
    fireEvent.click(avatarBtn);

    const dropdownNotifBtn = document.querySelector('#nav-view-notifications');
    expect(dropdownNotifBtn).toBeInTheDocument();
    expect(dropdownNotifBtn).toHaveTextContent(/notifications/i);
    expect(dropdownNotifBtn).toHaveTextContent('3');

    // Click notifications option in dropdown
    fireEvent.click(dropdownNotifBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/notifications');
  });
});
