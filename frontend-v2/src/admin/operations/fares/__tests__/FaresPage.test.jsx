import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import FaresPage from '../FaresPage';

// Mock AdminCrudPage so we don't need to render its full complex tree
vi.mock('@/admin/_core/AdminCrudPage', () => ({
  default: ({ config = {}, banner: _banner, saveAndNextUrl: _saveAndNextUrl }) => (
    <div data-testid="admin-crud-page">
      <div data-testid="title">{config.title}</div>
      <div data-testid="breadcrumb">
        {config.breadcrumb ? JSON.stringify(config.breadcrumb) : 'none'}
      </div>
    </div>
  ),
}));

describe('FaresPage URL Parameter Integration', () => {
  let store;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        flightInstance: () => ({ items: [], loading: false, error: null }),
      },
    });
  });

  it('passes null breadcrumb when no instance param is in URL', () => {
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/operations/fares']}>
          <Routes>
            <Route path="/admin/operations/fares" element={<FaresPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByTestId('title')).toHaveTextContent('Fares');
    expect(screen.getByTestId('breadcrumb')).toHaveTextContent('none');
  });

  it('passes instance-specific breadcrumb when instance param is in URL', () => {
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/operations/fares?instance=123']}>
          <Routes>
            <Route path="/admin/operations/fares" element={<FaresPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    const breadcrumbData = screen.getByTestId('breadcrumb').textContent;
    expect(breadcrumbData).not.toBe('none');
    
    const breadcrumbParsed = JSON.parse(breadcrumbData);
    expect(breadcrumbParsed).toHaveLength(2);
    expect(breadcrumbParsed[1].label).toBe('Fares (Instance #123)');
  });
});
