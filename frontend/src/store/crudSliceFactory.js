/**
 * createCrudSlice — generic CRUD slice factory.
 *
 * Takes an entity name + API base path and returns a fully-wired Redux slice
 * with fetchList, fetchDetail, add, update, remove thunks and standard
 * loading / error / items / selected state.
 *
 * Usage:
 *   const { slice, actions, thunks } = createCrudSlice('country', '/flights/v2/countries');
 *   export const { fetchList: fetchCountries, add: addCountry } = thunks;
 *   export default slice.reducer;
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/services/apiClient';

export function createCrudSlice(entityName, apiBasePath) {
  const upper = entityName.charAt(0).toUpperCase() + entityName.slice(1);

  // ─── Thunks ──────────────────────────────────────────────────────────────

  const fetchList = createAsyncThunk(
    `${entityName}/fetchList`,
    async (params = {}, { rejectWithValue }) => {
      try {
        const query = new URLSearchParams(params).toString();
        const url = query ? `${apiBasePath}/?${query}` : `${apiBasePath}/`;
        return await fetchWithAuth(url);
      } catch (err) {
        return rejectWithValue(_parseError(err, `Failed to fetch ${entityName} list`));
      }
    }
  );

  const fetchDetail = createAsyncThunk(
    `${entityName}/fetchDetail`,
    async (id, { rejectWithValue }) => {
      try {
        return await fetchWithAuth(`${apiBasePath}/${id}/`);
      } catch (err) {
        return rejectWithValue(_parseError(err, `Failed to fetch ${entityName} detail`));
      }
    }
  );

  const add = createAsyncThunk(
    `${entityName}/add`,
    async (data, { rejectWithValue }) => {
      try {
        const isFormData = data instanceof FormData;
        return await fetchWithAuth(`${apiBasePath}/`, {
          method: 'POST',
          body: isFormData ? data : JSON.stringify(data),
          headers: isFormData ? {} : { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        if (err.data && typeof err.data === 'object') {
          return rejectWithValue(err.data);
        }
        return rejectWithValue({ non_field_errors: [err.message || `Failed to create ${entityName}`] });
      }
    }
  );

  const update = createAsyncThunk(
    `${entityName}/update`,
    async ({ id, data }, { rejectWithValue }) => {
      try {
        const isFormData = data instanceof FormData;
        return await fetchWithAuth(`${apiBasePath}/${id}/`, {
          method: 'PUT',
          body: isFormData ? data : JSON.stringify(data),
          headers: isFormData ? {} : { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        if (err.data && typeof err.data === 'object') {
          return rejectWithValue(err.data);
        }
        return rejectWithValue({ non_field_errors: [err.message || `Failed to update ${entityName}`] });
      }
    }
  );

  const remove = createAsyncThunk(
    `${entityName}/remove`,
    async (id, { rejectWithValue }) => {
      try {
        await fetchWithAuth(`${apiBasePath}/${id}/`, { method: 'DELETE' });
        return id;
      } catch (err) {
        return rejectWithValue(_parseError(err, `Failed to delete ${entityName}`));
      }
    }
  );

  // ─── Custom action factory (for non-CRUD calls e.g. generate-seats) ──────
  const createCustomAction = (actionName, method, buildUrl, buildBody) =>
    createAsyncThunk(
      `${entityName}/${actionName}`,
      async (arg, { rejectWithValue }) => {
        try {
          const url = buildUrl(arg);
          const opts = method !== 'GET' ? { method, body: buildBody ? JSON.stringify(buildBody(arg)) : undefined } : {};
          return await fetchWithAuth(url, opts);
        } catch (err) {
          return rejectWithValue(_parseError(err, `Failed: ${actionName}`));
        }
      }
    );

  // ─── Slice ────────────────────────────────────────────────────────────────

  const initialState = {
    items: [],
    count: 0,
    next: null,
    previous: null,
    selected: null,
    loading: false,
    detailLoading: false,
    actionLoading: false,
    error: null,
    validationErrors: null,
  };

  const slice = createSlice({
    name: entityName,
    initialState,
    reducers: {
      clearErrors: (state) => {
        state.error = null;
        state.validationErrors = null;
      },
      clearSelected: (state) => {
        state.selected = null;
      },
      clearList: (state) => {
        state.items = [];
        state.count = 0;
      },
    },
    extraReducers: (builder) => {
      // fetchList
      _pending(builder, fetchList, 'loading');
      builder.addCase(fetchList.fulfilled, (state, action) => {
        state.loading = false;
        // Support both paginated { count, results } and plain arrays
        if (Array.isArray(action.payload)) {
          state.items = action.payload;
          state.count = action.payload.length;
        } else {
          state.items = action.payload.results ?? action.payload;
          state.count = action.payload.count ?? (state.items.length);
          state.next = action.payload.next ?? null;
          state.previous = action.payload.previous ?? null;
        }
      });
      _rejected(builder, fetchList, 'loading');

      // fetchDetail
      _pending(builder, fetchDetail, 'detailLoading');
      builder.addCase(fetchDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.selected = action.payload;
      });
      _rejected(builder, fetchDetail, 'detailLoading');

      // add
      _pending(builder, add, 'actionLoading');
      builder.addCase(add.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.items = [action.payload, ...state.items];
        state.count += 1;
      });
      builder.addCase(add.rejected, (state, action) => {
        state.actionLoading = false;
        state.validationErrors = action.payload;
      });

      // update
      _pending(builder, update, 'actionLoading');
      builder.addCase(update.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.selected = action.payload;
        const idx = state.items.findIndex((i) => i.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      });
      builder.addCase(update.rejected, (state, action) => {
        state.actionLoading = false;
        state.validationErrors = action.payload;
      });

      // remove
      _pending(builder, remove, 'actionLoading');
      builder.addCase(remove.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.items = state.items.filter((i) => i.id !== action.payload);
        state.count = Math.max(0, state.count - 1);
      });
      _rejected(builder, remove, 'actionLoading');
    },
  });

  return {
    slice,
    thunks: { fetchList, fetchDetail, add, update, remove, createCustomAction },
    actions: slice.actions,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _parseError(err, fallback) {
  try {
    const obj = JSON.parse(err.message);
    return obj.detail || obj;
  } catch (_) {
    return err.message || fallback;
  }
}

function _pending(builder, thunk, loadingKey) {
  builder.addCase(thunk.pending, (state) => {
    state[loadingKey] = true;
    state.error = null;
  });
}

function _rejected(builder, thunk, loadingKey) {
  builder.addCase(thunk.rejected, (state, action) => {
    state[loadingKey] = false;
    state.error = action.payload;
  });
}
