/**
 * Admin pages integration tests — AdminCrudPage + adminSlices
 *
 * Tests cover:
 *  - AdminCrudPage renders title, "Add" button, and empty state
 *  - AdminCrudPage shows items from Redux state
 *  - Modal opens on "Add" button click
 *  - adminSlices exports the expected thunks
 *  - Navbar no longer contains "Flights (Legacy)" link
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock react-hot-toast so it doesn't break jsdom ────────────────────────────
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

// ── Mock fetchWithAuth so no real network calls are made ──────────────────────
vi.mock('@/services/apiClient', () => ({
  fetchWithAuth: vi.fn().mockResolvedValue({ results: [], count: 0 }),
}));

// ── Minimal store factory ─────────────────────────────────────────────────────
function makeStore(extraReducers = {}) {
  return configureStore({
    reducer: {
      auth: (s = { isAuthenticated: true, isAdmin: true, profile: null }) => s,
      notifications: (s = { unreadCount: 0 }) => s,
      ...extraReducers,
    },
  });
}

// ── adminSlices smoke test ────────────────────────────────────────────────────
describe('adminSlices — exports', () => {
  it('exports all expected thunks without throwing', async () => {
    const mod = await import('@/store/adminSlices');

    // country slice
    expect(typeof mod.fetchCountries).toBe('function');
    expect(typeof mod.addCountry).toBe('function');
    expect(typeof mod.updateCountry).toBe('function');
    expect(typeof mod.removeCountry).toBe('function');

    // airport slice
    expect(typeof mod.fetchAirports).toBe('function');
    expect(typeof mod.addAirport).toBe('function');

    // airline
    expect(typeof mod.fetchAirlines).toBe('function');

    // aircraft model
    expect(typeof mod.fetchAircraftModels).toBe('function');

    // aircraft
    expect(typeof mod.fetchAircraft).toBe('function');

    // food items
    expect(typeof mod.fetchFoodItems).toBe('function');

    // flight routes
    expect(typeof mod.fetchFlightRoutes).toBe('function');

    // instances
    expect(typeof mod.fetchFlightInstances).toBe('function');

    // generate seats
    expect(typeof mod.generateSeats).toBe('function');

    // fares
    expect(typeof mod.fetchFares).toBe('function');

    // meals
    expect(typeof mod.fetchFlightMeals).toBe('function');
  });
});

// ── AdminCrudPage render tests ────────────────────────────────────────────────
describe('AdminCrudPage', () => {
  let AdminCrudPage;
  const COLUMNS = [
    { key: 'name', label: 'Name' },
    { key: 'iso_code', label: 'ISO Code' },
  ];
  const FIELDS = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'iso_code', label: 'ISO Code', type: 'text', required: true },
  ];
  const EMPTY_FORM = { name: '', iso_code: '' };

  // Fake thunks that return dispatchable plain action objects
  const noop = (ret = { results: [], count: 0 }) =>
    Object.assign((..._) => ({ type: 'noop', payload: ret }), { pending: 'noop/pending', fulfilled: 'noop/fulfilled', rejected: 'noop/rejected' });

  const fakeThunks = {
    fetchList: noop(),
    add: noop(),
    update: noop(),
    remove: noop(),
  };

  const countryReducer = (state = { items: [], count: 0, loading: false, error: null, validationErrors: null, actionLoading: false, selected: null }, action) => {
    if (action.type === '__TEST/SET_ITEMS') return { ...state, items: action.payload, count: action.payload.length };
    return state;
  };

  beforeEach(async () => {
    const mod = await import('@/admin/_core/AdminCrudPage');
    AdminCrudPage = mod.default;
  });

  const Wrapper = ({ store, children }) => (
    <Provider store={store}>
      <MemoryRouter>{children}</MemoryRouter>
    </Provider>
  );

  it('renders the page title', () => {
    const store = makeStore({ country: countryReducer });
    render(
      <Wrapper store={store}>
        <AdminCrudPage
          config={{
            title: 'Countries',
            entityName: 'country',
            columns: COLUMNS,
            fields: FIELDS,
            emptyForm: EMPTY_FORM,
            thunks: fakeThunks,
          }}
        />
      </Wrapper>
    );
    expect(screen.getByText('Countries')).toBeInTheDocument();
  });

  it('renders an "Add New" button', () => {
    const store = makeStore({ country: countryReducer });
    render(
      <Wrapper store={store}>
        <AdminCrudPage
          config={{
            title: 'Countries',
            entityName: 'country',
            columns: COLUMNS,
            fields: FIELDS,
            emptyForm: EMPTY_FORM,
            thunks: fakeThunks,
          }}
        />
      </Wrapper>
    );
    expect(screen.getByRole('button', { name: /add new/i })).toBeInTheDocument();
  });

  it('opens the add modal when the Add New button is clicked', async () => {
    const store = makeStore({ country: countryReducer });
    render(
      <Wrapper store={store}>
        <AdminCrudPage
          config={{
            title: 'Countries',
            entityName: 'country',
            columns: COLUMNS,
            fields: FIELDS,
            emptyForm: EMPTY_FORM,
            thunks: fakeThunks,
          }}
        />
      </Wrapper>
    );
    fireEvent.click(screen.getByRole('button', { name: /add new/i }));
    // Modal title appears
    expect(await screen.findByText(/add countries/i)).toBeInTheDocument();
  });

  it('shows existing items in the table', () => {
    const store = makeStore({ country: countryReducer });
    store.dispatch({ type: '__TEST/SET_ITEMS', payload: [{ id: 1, name: 'India', iso_code: 'IND' }] });
    render(
      <Wrapper store={store}>
        <AdminCrudPage
          config={{
            title: 'Countries',
            entityName: 'country',
            columns: COLUMNS,
            fields: FIELDS,
            emptyForm: EMPTY_FORM,
            thunks: fakeThunks,
          }}
        />
      </Wrapper>
    );
    expect(screen.getByText('India')).toBeInTheDocument();
    expect(screen.getByText('IND')).toBeInTheDocument();
  });
});

// ── Navbar — no legacy link ───────────────────────────────────────────────────
vi.mock('@/store/notificationsSlice', () => ({
  fetchNotifications: () => ({ type: 'fetchNotifications' }),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/admin/analytics' }),
  };
});

describe('Navbar — admin mode', () => {
  it('does NOT contain a "Flights (Legacy)" link', async () => {
    const { Navbar } = await import('@/components/layout/Navbar');
    // const store = makeStore();
    // Patch auth state to admin
    const adminStore = configureStore({
      reducer: {
        auth: () => ({ isAuthenticated: true, isAdmin: true, profile: { first_name: 'Admin', username: 'admin' } }),
        notifications: () => ({ unreadCount: 0 }),
      },
    });
    render(
      <Provider store={adminStore}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </Provider>
    );
    expect(screen.queryByText(/flights \(legacy\)/i)).toBeNull();
  });

  it('contains the Analytics link for admins', async () => {
    const { Navbar } = await import('@/components/layout/Navbar');
    const adminStore = configureStore({
      reducer: {
        auth: () => ({ isAuthenticated: true, isAdmin: true, profile: { first_name: 'Admin', username: 'admin' } }),
        notifications: () => ({ unreadCount: 0 }),
      },
    });
    render(
      <Provider store={adminStore}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </Provider>
    );
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });
});
