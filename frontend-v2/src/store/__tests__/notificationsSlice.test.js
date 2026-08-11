import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import notificationsReducer, {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/store/notificationsSlice';
import * as notificationsService from '@/services/notifications-service/notificationsService';

vi.mock('@/services/notifications-service/notificationsService');

const makeStore = () =>
  configureStore({ reducer: { notifications: notificationsReducer } });

const MOCK_NOTIFICATION = {
  id: 1,
  title: 'Flight Delayed',
  message: 'Flight AG-101 has been delayed.',
  notification_type: 'FLIGHT_DELAYED',
  is_read: false,
  created_at: new Date().toISOString(),
};

describe('notificationsSlice', () => {
  let store;

  beforeEach(() => {
    store = makeStore();
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = store.getState().notifications;
    expect(state.list).toEqual([]);
    expect(state.listLoading).toBe(false);
    expect(state.listError).toBeNull();
    expect(state.unreadCount).toBe(0);
  });

  describe('fetchNotifications', () => {
    it('sets listLoading=true while pending', () => {
      notificationsService.notificationsAPI.list = vi.fn(() => new Promise(() => {}));
      store.dispatch(fetchNotifications());
      expect(store.getState().notifications.listLoading).toBe(true);
    });

    it('populates list and unreadCount on success', async () => {
      notificationsService.notificationsAPI.list = vi.fn().mockResolvedValue([MOCK_NOTIFICATION]);
      await store.dispatch(fetchNotifications());

      const state = store.getState().notifications;
      expect(state.listLoading).toBe(false);
      expect(state.list).toHaveLength(1);
      expect(state.list[0]).toEqual(MOCK_NOTIFICATION);
      expect(state.unreadCount).toBe(1);
    });
  });

  describe('markNotificationRead', () => {
    beforeEach(async () => {
      notificationsService.notificationsAPI.list = vi.fn().mockResolvedValue([MOCK_NOTIFICATION]);
      await store.dispatch(fetchNotifications());
    });

    it('updates notification status in list and updates unreadCount', async () => {
      const updated = { ...MOCK_NOTIFICATION, is_read: true };
      notificationsService.notificationsAPI.read = vi.fn().mockResolvedValue(updated);
      await store.dispatch(markNotificationRead(1));

      const state = store.getState().notifications;
      expect(state.list[0].is_read).toBe(true);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe('markAllNotificationsRead', () => {
    beforeEach(async () => {
      notificationsService.notificationsAPI.list = vi.fn().mockResolvedValue([MOCK_NOTIFICATION]);
      await store.dispatch(fetchNotifications());
    });

    it('updates all notifications to read and resets unreadCount', async () => {
      notificationsService.notificationsAPI.markAllRead = vi.fn().mockResolvedValue({ message: 'Success' });
      await store.dispatch(markAllNotificationsRead());

      const state = store.getState().notifications;
      expect(state.list[0].is_read).toBe(true);
      expect(state.unreadCount).toBe(0);
    });
  });
});
