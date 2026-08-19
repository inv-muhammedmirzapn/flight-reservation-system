import { API_BASE_URL, fetchWithAuth, getResponseData } from '@/services/apiClient';

export const authAPI = {
  register: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    const data = await getResponseData(response);
    if (!response.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
    return data;
  },

  login: async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'include',  // allows server to set HttpOnly cookies on the response
    });
    const data = await getResponseData(response);
    if (!response.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
    return data;
  },

  logout: async () => {
    // No body needed — the backend reads the refresh_token HttpOnly cookie automatically,
    // blacklists it, and deletes both cookies from the response.
    try {
      return await fetchWithAuth('/auth/logout/', {
        method: 'POST',
      });
    } catch (err) {
      console.warn("Logout endpoint error:", err);
      return null;
    }
  },

  googleLogin: async (token) => {
    const response = await fetch(`${API_BASE_URL}/auth/google-login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include',  // allows server to set HttpOnly cookies on the response
    });
    const data = await getResponseData(response);
    if (!response.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
    return data;
  },

  getProfile: async () => {
    //console.log("Auth Service :", API_BASE_URL);
    return fetchWithAuth('/auth/profile/');
  },

  forgotPassword: async (email) => {
    const response = await fetch(`${API_BASE_URL}/auth/password/forgot/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await getResponseData(response);
    if (!response.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
    return data;
  },

  resetPassword: async (email, otp, new_password) => {
    const response = await fetch(`${API_BASE_URL}/auth/password/reset/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, new_password }),
    });
    const data = await getResponseData(response);
    if (!response.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
    return data;
  }
};
