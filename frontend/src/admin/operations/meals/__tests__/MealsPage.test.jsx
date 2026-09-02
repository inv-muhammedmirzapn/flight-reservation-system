import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MealsPage from '../MealsPage';

describe('MealsPage URL Parameter Integration', () => {
  let store;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        airline: () => ({ items: [], loading: false, error: null }),
        foodItem: () => ({ items: [], loading: false, error: null }),
        flightMeal: () => ({ items: [], loading: false, actionLoading: false, error: null }),
      },
    });
  });

  it('does not show airline breadcrumb when no airline param is in URL', () => {
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/operations/meals']}>
          <Routes>
            <Route path="/admin/operations/meals" element={<MealsPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.queryByText(/Meals \(Airline #/i)).not.toBeInTheDocument();
  });

  it('shows airline-specific breadcrumb when airline param is in URL', () => {
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/operations/meals?airline=456']}>
          <Routes>
            <Route path="/admin/operations/meals" element={<MealsPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Meals (Airline #456)')).toBeInTheDocument();
  });
});
