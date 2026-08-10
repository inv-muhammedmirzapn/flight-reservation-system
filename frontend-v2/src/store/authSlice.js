import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI } from '@/services/auth-service/authService';
import { parseApiError } from '@/utils/errorUtils';

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


export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { dispatch }) => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      await authAPI.logout(refreshToken);
    }
    dispatch(logout());
  }
);

export const fetchProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const profile = await authAPI.getProfile();
      return profile;
    } catch (error) {
      return rejectWithValue(parseApiError(error, 'Could not load user profile'));
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ credentials, requireAdmin, requireCustomer }, { rejectWithValue }) => {
    try {
      const rawData = await authAPI.login(credentials);
      const data = (rawData && rawData.access) ? rawData : (rawData?.data || rawData);
      
      const decoded = data.access ? decodeToken(data.access) : null;
      const isAdmin = decoded?.is_superuser || data.role === 'ADMIN';
      
      if (requireAdmin && !isAdmin) {
        return rejectWithValue('Access Denied: Administrator privileges required.');
      }
      if (requireCustomer && isAdmin) {
        return rejectWithValue('Invalid username or password');
      }

      if (data.access) localStorage.setItem('access_token', data.access);
      if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
      
      const profile = {
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role
      };
      return { token: data.access, profile };
    } catch (error) {
      return rejectWithValue(parseApiError(error, 'Login failed'));
    }
  }
);

export const googleLoginUser = createAsyncThunk(
  'auth/googleLoginUser',
  async ({ token, requireCustomer }, { rejectWithValue }) => {
    try {
      const rawData = await authAPI.googleLogin(token);
      const data = (rawData && rawData.access) ? rawData : (rawData?.data || rawData);
      
      const decoded = data.access ? decodeToken(data.access) : null;
      const isAdmin = decoded?.is_superuser || data.role === 'ADMIN';
      if (requireCustomer && isAdmin) {
        return rejectWithValue('Invalid username or password');
      }

      if (data.access) localStorage.setItem('access_token', data.access);
      if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
      
      const profile = {
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role
      };
      return { token: data.access, profile };
    } catch (error) {
      return rejectWithValue(parseApiError(error, 'Google Login failed'));
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (userData, { rejectWithValue }) => {
    try {
      const data = await authAPI.register(userData);
      return data;
    } catch (error) {
      return rejectWithValue(parseApiError(error, 'Registration failed'));
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
  loading: false,
  isInitializing: !!initialToken,
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
    },
    updateProfileSuccess: (state, action) => {
      state.profile = action.payload;
      if (action.payload?.role) {
        state.isAdmin = state.decodedToken?.is_superuser || action.payload.role === 'ADMIN';
      }
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
      // Google Login
      .addCase(googleLoginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(googleLoginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.decodedToken = decodeToken(action.payload.token);
        state.profile = action.payload.profile;
        state.isAuthenticated = true;
        state.isAdmin = state.decodedToken?.is_superuser || action.payload.profile?.role === 'ADMIN';
      })
      .addCase(googleLoginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch Profile
      .addCase(fetchProfile.pending, (state) => {
        state.isInitializing = true;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.isInitializing = false;
        state.profile = action.payload;
        state.isAdmin = state.decodedToken?.is_superuser || action.payload.role === 'ADMIN';
      })
      .addCase(fetchProfile.rejected, (state) => {
        state.isInitializing = false;
        // Don't force logout immediately on profile fail, but clear profile state
        state.profile = null;
      });
  },
});

export const { logout, clearAuthError, updateProfileSuccess } = authSlice.actions;
export default authSlice.reducer;
