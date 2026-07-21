import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi } from 'vitest';
import NotificationsPage from '../NotificationsPage';

vi.mock('@/store/notificationsSlice', () => {
  const makeThunkMock = (type, payloadCreator = (arg) => arg) => {
    return (arg) => {
      const payload = payloadCreator(arg);
      const promise = Promise.resolve({ payload });
      promise.unwrap = () => Promise.resolve(payload);
      promise.type = type;
      promise.payload = payload;

      const thunkFn = (dispatch) => promise;
      thunkFn.type = type;
      thunkFn.payload = payload;
      return thunkFn;
    };
  };

  return {
    fetchNotifications: makeThunkMock('fetchNotifications'),
    markNotificationRead: makeThunkMock('markNotificationRead'),
    markAllNotificationsRead: makeThunkMock('markAllNotificationsRead'),
  };
});

describe('NotificationsPage Component', () => {
  const setupStore = (notificationsList = [], loading = false) => {
    return configureStore({
      reducer: {
        notifications: (state = {
          list: notificationsList,
          listLoading: loading,
          listError: null,
          unreadCount: notificationsList.filter(n => !n.is_read).length,
        }) => state,
      }
    });
  };

  const mockNotifications = [
    {
      id: 1,
      title: 'Flight Delayed',
      message: 'Flight AG-101 is delayed.',
      notification_type: 'FLIGHT_DELAYED',
      is_read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      title: 'Flight Boarding',
      message: 'Flight AG-102 is boarding now.',
      notification_type: 'FLIGHT_BOARDING',
      is_read: true,
      created_at: new Date().toISOString(),
    }
  ];

  it('renders loading state when loading', () => {
    const store = setupStore([], true);
    render(
      <Provider store={store}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders empty state when there are no notifications', () => {
    const store = setupStore([]);
    render(
      <Provider store={store}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
  });

  it('renders notifications list correctly with read and unread items', () => {
    const store = setupStore(mockNotifications);
    render(
      <Provider store={store}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Flight Delayed')).toBeInTheDocument();
    expect(screen.getByText('Flight Boarding')).toBeInTheDocument();
    expect(screen.getByText('Flight AG-101 is delayed.')).toBeInTheDocument();
    expect(screen.getByText('Flight AG-102 is boarding now.')).toBeInTheDocument();
  });

  it('triggers markNotificationRead when clicking on mark read button', () => {
    const store = setupStore(mockNotifications);
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    render(
      <Provider store={store}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </Provider>
    );

    const markReadBtn = screen.getByTestId('mark-read-1');
    fireEvent.click(markReadBtn);

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'markNotificationRead',
      payload: 1,
    }));
  });

  it('triggers markAllNotificationsRead when clicking mark all read button', () => {
    const store = setupStore(mockNotifications);
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    render(
      <Provider store={store}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </Provider>
    );

    const markAllBtn = screen.getByText(/mark all as read/i);
    fireEvent.click(markAllBtn);

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'markAllNotificationsRead',
    }));
  });
});
