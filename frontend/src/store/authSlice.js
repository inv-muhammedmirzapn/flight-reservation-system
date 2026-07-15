import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI } from '../services/api';

const decodeToken = (token) => {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch (e) {
    console.error("Token decoding error", e);
    return null;
  }
};

export const fetchProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const profile = await authAPI.getProfile();
      return profile;
    } catch (error) {
      let message = 'Could not load user profile';
      try {
        const errObj = JSON.parse(error.message);
        message = errObj.detail || message;
      } catch (_) {}
      return rejectWithValue(message);
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { dispatch, rejectWithValue }) => {
    try {
      const data = await authAPI.login(credentials);
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      
      // Load profile info immediately
      const profile = await dispatch(fetchProfile()).unwrap();
      return { token: data.access, profile };
    } catch (error) {
      let message = 'Login failed';
      try {
        const errObj = JSON.parse(error.message);
        message = errObj.detail || errObj.non_field_errors?.[0] || message;
      } catch (_) {}
      return rejectWithValue(message);
    }
  }
);

const initialToken = localStorage.getItem('access_token');
const decoded = decodeToken(initialToken);

const initialState = {
  token: initialToken,
  decodedToken: decoded,
  profile: null,
  isAuthenticated: !!initialToken,
  isAdmin: decoded?.is_superuser || false,
  loading: !!initialToken,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      state.token = null;
      state.decodedToken = null;
      state.profile = null;
      state.isAuthenticated = false;
      state.isAdmin = false;
      state.error = null;
    },
    clearAuthError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.decodedToken = decodeToken(action.payload.token);
        state.profile = action.payload.profile;
        state.isAuthenticated = true;
        state.isAdmin = state.decodedToken?.is_superuser || action.payload.profile?.role === 'ADMIN';
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch Profile
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
        state.isAdmin = state.decodedToken?.is_superuser || action.payload.role === 'ADMIN';
      })
      .addCase(fetchProfile.rejected, (state) => {
        state.loading = false;
        // Don't force logout immediately on profile fail, but clear profile state
        state.profile = null;
      });
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
