import { fetchWithAuth } from '@/services/apiClient';

export const profileAPI = {
  getProfile: async () => {
    return fetchWithAuth('/auth/profile/');
  },

  updateProfile: async (profileData) => {
    return fetchWithAuth('/auth/profile/', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  },

  changePassword: async (passwordData) => {
    return fetchWithAuth('/auth/change-password/', {
      method: 'POST',
      body: JSON.stringify(passwordData),
    });
  },
};
