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

  requestEmailOTP: async (newEmail) => {
    return fetchWithAuth('/auth/email/request-otp/', {
      method: 'POST',
      body: JSON.stringify({ new_email: newEmail }),
    });
  },

  verifyEmailOTP: async (newEmail, otp) => {
    return fetchWithAuth('/auth/email/verify-otp/', {
      method: 'POST',
      body: JSON.stringify({ new_email: newEmail, otp }),
    });
  },
};
