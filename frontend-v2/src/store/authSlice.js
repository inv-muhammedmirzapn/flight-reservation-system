import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI } from '@/services/auth-service/authService';
import { parseApiError } from '@/utils/errorUtils';

/**
 * Auth slice — cookie-based token edition.
 *
 * Tokens (access_token, refresh_token) are now stored as HttpOnly cookies set
 * by the backend. JavaScript can never read them. The browser attaches them
 * automatically on every credentialed request (credentials: 'include').
 *
 * Authentication state is derived from:
 *  - Login / Google Login success → isAuthenticated = true
 *  - fetchProfile success        → profile populated, isInitializing = false
 *  - fetchProfile failure (401)  → not authenticated, isInitializing = false
 *  - Logout                      → cookies deleted by server, state reset
 *
 * No localStorage is used anywhere in this file.
 */

// ---------------------------------------------------------------------------
// Async thunks
// ---------------------------------------------------------------------------

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { dispatch }) => {
    // No token argument needed — the backend reads the refresh_token cookie
    // automatically and blacklists it, then deletes both cookies from the response.
    try {
      await authAPI.logout();
    } catch (_err) {
      // Even if the server call fails (already expired, network error), we
      // still clear local auth state so the user is redirected to login.
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
      // The response body no longer contains access/refresh tokens (they are in
      // HttpOnly cookies). We get profile info directly: id, username, email, role, is_superuser.
      const data = rawData?.data || rawData;

      const isAdmin = data.is_superuser === true || data.role === 'ADMIN';

      if (requireAdmin && !isAdmin) {
        return rejectWithValue('Access Denied: Administrator privileges required.');
      }
      if (requireCustomer && isAdmin) {
        return rejectWithValue('Invalid username or password');
      }

      const profile = {
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role,
      };
      return { profile, isAdmin };
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
      const data = rawData?.data || rawData;

      const isAdmin = data.is_superuser === true || data.role === 'ADMIN';
      if (requireCustomer && isAdmin) {
        return rejectWithValue('Invalid username or password');
      }

      const profile = {
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role,
      };
      return { profile, isAdmin };
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

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState = {
  // token and decodedToken are removed — we never hold the JWT in JS memory.
  // All token transmission is handled transparently by browser cookies.
  token: null,
  decodedToken: null,
  profile: null,
  isAuthenticated: false,
  isAdmin: false,
  loading: false,
  // isInitializing: true means the app hasn't yet confirmed auth status via fetchProfile.
  // Navbar dispatches fetchProfile on mount, which resolves this.
  isInitializing: true,
  error: null,
};

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      // Tokens live in HttpOnly cookies — only the server can delete them.
      // The logoutUser thunk calls authAPI.logout() first, which instructs the
      // server to delete the cookies. This reducer just clears the Redux state.
      state.token = null;
      state.decodedToken = null;
      state.profile = null;
      state.isAuthenticated = false;
      state.isAdmin = false;
      state.isInitializing = false;
      state.error = null;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
    updateProfileSuccess: (state, action) => {
      state.profile = action.payload;
      
      if (action.payload) {
        state.isAdmin = action.payload.role === 'ADMIN' || action.payload.is_superuser === true || action.payload.is_staff === true;
      }
    },
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
        state.profile = action.payload.profile;
        state.isAuthenticated = true;
        state.isAdmin = action.payload.isAdmin;
        state.isInitializing = false;
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
        state.profile = action.payload.profile;
        state.isAuthenticated = true;
        state.isAdmin = action.payload.isAdmin;
        state.isInitializing = false;
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
      // Fetch Profile — used on app mount to restore session from cookie
      .addCase(fetchProfile.pending, (state) => {
        state.isInitializing = true;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.isInitializing = false;
        state.profile = action.payload;
        state.isAuthenticated = true;
        state.isAdmin = action.payload?.role === 'ADMIN' || action.payload?.is_superuser === true || action.payload?.is_staff === true;
      })
      .addCase(fetchProfile.rejected, (state) => {
        state.isInitializing = false;
        state.isAuthenticated = false;
        state.profile = null;
        state.isAdmin = false;
      });
  },
});

export const { logout, clearAuthError, updateProfileSuccess } = authSlice.actions;
export default authSlice.reducer;
