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
        flightInstance: () => ({ items: [], loading: false, error: null }),
        foodItem: () => ({ items: [], loading: false, error: null }),
        flightRoute: () => ({ items: [], loading: false, error: null }),
        flightMeal: () => ({ items: [], loading: false, actionLoading: false, error: null }),
      },
    });
  });

  it('does not show breadcrumb when no instance param is in URL', () => {
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/operations/meals']}>
          <Routes>
            <Route path="/admin/operations/meals" element={<MealsPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    // Meals (Instance #...) should not be in the document
    expect(screen.queryByText(/Meals \(Instance #/i)).not.toBeInTheDocument();
  });

  it('shows instance-specific breadcrumb when instance param is in URL', () => {
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/operations/meals?instance=456']}>
          <Routes>
            <Route path="/admin/operations/meals" element={<MealsPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    // Meals (Instance #456) should be in the document
    expect(screen.getByText('Meals (Instance #456)')).toBeInTheDocument();
  });
});
