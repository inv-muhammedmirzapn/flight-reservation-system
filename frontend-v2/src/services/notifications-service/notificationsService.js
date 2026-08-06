import { fetchWithAuth } from '@/services/apiClient';

export const notificationsAPI = {
  list: async () => {
    return fetchWithAuth('/notifications/');
  },

  read: async (id) => {
    return fetchWithAuth(`/notifications/${id}/read/`, {
      method: 'PATCH',
    });
  },

  markAllRead: async () => {
    return fetchWithAuth('/notifications/mark-all-read/', {
      method: 'POST',
    });
  },
};
