/**
 * Unit tests for crudSliceFactory
 *
 * Tests cover:
 *  - Initial state shape
 *  - fetchList fulfilled/rejected state transitions
 *  - add fulfilled/rejected (optimistic prepend + count)
 *  - update fulfilled (in-place item replacement)
 *  - remove fulfilled (item removal + count decrement)
 *  - clearErrors / clearSelected / clearList reducers
 */
import { configureStore } from '@reduxjs/toolkit';
import { createCrudSlice } from '../crudSliceFactory';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeStore(slice) {
  return configureStore({ reducer: { test: slice.reducer } });
}

function buildSlice(name = 'country', path = '/flights/v2/countries') {
  const { slice, thunks } = createCrudSlice(name, path);
  return { slice, thunks, store: makeStore(slice) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('createCrudSlice — initial state', () => {
  it('starts with the correct default shape', () => {
    const { store } = buildSlice();
    const state = store.getState().test;

    expect(state.items).toEqual([]);
    expect(state.count).toBe(0);
    expect(state.loading).toBe(false);
    expect(state.actionLoading).toBe(false);
    expect(state.detailLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.validationErrors).toBeNull();
    expect(state.selected).toBeNull();
  });
});

describe('createCrudSlice — reducers', () => {
  it('clearErrors resets error and validationErrors', () => {
    const { slice, store } = buildSlice();
    // Manually patch state by dispatching rejected
    store.dispatch({ type: 'country/fetchList/rejected', payload: 'bad' });
    store.dispatch(slice.actions.clearErrors());
    const state = store.getState().test;
    expect(state.error).toBeNull();
    expect(state.validationErrors).toBeNull();
  });

  it('clearSelected resets selected to null', () => {
    const { slice, store } = buildSlice();
    store.dispatch({ type: 'country/fetchDetail/fulfilled', payload: { id: 1, name: 'India' } });
    store.dispatch(slice.actions.clearSelected());
    expect(store.getState().test.selected).toBeNull();
  });

  it('clearList resets items and count', () => {
    const { slice, store } = buildSlice();
    // simulate a list load
    store.dispatch({
      type: 'country/fetchList/fulfilled',
      payload: { results: [{ id: 1 }], count: 1 }
    });
    store.dispatch(slice.actions.clearList());
    const state = store.getState().test;
    expect(state.items).toEqual([]);
    expect(state.count).toBe(0);
  });
});

describe('createCrudSlice — fetchList', () => {
  it('sets loading=true on pending', () => {
    const { store } = buildSlice();
    store.dispatch({ type: 'country/fetchList/pending' });
    expect(store.getState().test.loading).toBe(true);
  });

  it('populates items from paginated response', () => {
    const { store } = buildSlice();
    store.dispatch({
      type: 'country/fetchList/fulfilled',
      payload: { results: [{ id: 1, name: 'India' }, { id: 2, name: 'Japan' }], count: 2, next: null, previous: null }
    });
    const state = store.getState().test;
    expect(state.loading).toBe(false);
    expect(state.items).toHaveLength(2);
    expect(state.count).toBe(2);
    expect(state.items[0].name).toBe('India');
  });

  it('populates items from a plain array response', () => {
    const { store } = buildSlice();
    store.dispatch({
      type: 'country/fetchList/fulfilled',
      payload: [{ id: 1 }, { id: 2 }, { id: 3 }]
    });
    const state = store.getState().test;
    expect(state.items).toHaveLength(3);
    expect(state.count).toBe(3);
  });

  it('sets error on rejected', () => {
    const { store } = buildSlice();
    store.dispatch({ type: 'country/fetchList/rejected', payload: 'Network error' });
    const state = store.getState().test;
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Network error');
  });
});

describe('createCrudSlice — fetchDetail', () => {
  it('sets selected on fulfilled', () => {
    const { store } = buildSlice();
    const payload = { id: 42, name: 'Germany', iso_code: 'DEU' };
    store.dispatch({ type: 'country/fetchDetail/fulfilled', payload });
    const state = store.getState().test;
    expect(state.detailLoading).toBe(false);
    expect(state.selected).toEqual(payload);
  });

  it('sets error on rejected', () => {
    const { store } = buildSlice();
    store.dispatch({ type: 'country/fetchDetail/rejected', payload: '404' });
    expect(store.getState().test.error).toBe('404');
  });
});

describe('createCrudSlice — add', () => {
  it('prepends the new item and increments count', () => {
    const { store } = buildSlice();
    // Seed some items
    store.dispatch({ type: 'country/fetchList/fulfilled', payload: { results: [{ id: 1 }], count: 1 } });
    store.dispatch({ type: 'country/add/fulfilled', payload: { id: 2, name: 'Brazil' } });
    const state = store.getState().test;
    expect(state.items[0]).toEqual({ id: 2, name: 'Brazil' });
    expect(state.count).toBe(2);
  });

  it('stores validationErrors on rejected', () => {
    const { store } = buildSlice();
    const errors = { iso_code: ['This field is required.'] };
    store.dispatch({ type: 'country/add/rejected', payload: errors });
    const state = store.getState().test;
    expect(state.actionLoading).toBe(false);
    expect(state.validationErrors).toEqual(errors);
  });
});

describe('createCrudSlice — update', () => {
  it('replaces the existing item in-place', () => {
    const { store } = buildSlice();
    store.dispatch({
      type: 'country/fetchList/fulfilled',
      payload: { results: [{ id: 1, name: 'India' }, { id: 2, name: 'Japan' }], count: 2 }
    });
    store.dispatch({ type: 'country/update/fulfilled', payload: { id: 1, name: 'India (Updated)' } });
    const state = store.getState().test;
    const updated = state.items.find(i => i.id === 1);
    expect(updated.name).toBe('India (Updated)');
    expect(state.count).toBe(2); // count unchanged
  });
});

describe('createCrudSlice — remove', () => {
  it('removes the item by id and decrements count', () => {
    const { store } = buildSlice();
    store.dispatch({
      type: 'country/fetchList/fulfilled',
      payload: { results: [{ id: 1 }, { id: 2 }, { id: 3 }], count: 3 }
    });
    store.dispatch({ type: 'country/remove/fulfilled', payload: 2 });
    const state = store.getState().test;
    expect(state.items).toHaveLength(2);
    expect(state.items.map(i => i.id)).not.toContain(2);
    expect(state.count).toBe(2);
  });

  it('does not go below 0 on count', () => {
    const { store } = buildSlice();
    store.dispatch({ type: 'country/remove/fulfilled', payload: 99 });
    expect(store.getState().test.count).toBe(0);
  });
});
