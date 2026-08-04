import { API_BASE_URL, fetchWithAuth, getResponseData, extractErrorMessage } from '@/services/apiClient';

const processAuthResponse = async (response) => {
  const data = await getResponseData(response);
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data;
};

export const authAPI = {
  register: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return processAuthResponse(response);
  },

  login: async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return processAuthResponse(response);
  },

  googleLogin: async (token) => {
    const response = await fetch(`${API_BASE_URL}/auth/google-login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return processAuthResponse(response);
  },

  getProfile: async () => {
    return fetchWithAuth('/auth/profile/');
  },

  forgotPassword: async (email) => {
    const response = await fetch(`${API_BASE_URL}/auth/password/forgot/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return processAuthResponse(response);
  },

  resetPassword: async (email, otp, new_password) => {
    const response = await fetch(`${API_BASE_URL}/auth/password/reset/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, new_password }),
    });
    return processAuthResponse(response);
  }
};
