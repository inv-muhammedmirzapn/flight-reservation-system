import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminLoginForm } from '../AdminLoginForm';
import toast from 'react-hot-toast';
import { loginUser } from '@/store/authSlice';

// Mock the router navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

// Mock toast
vi.mock('react-hot-toast', () => {
  const toastMock = {
    success: vi.fn(),
    error: vi.fn(),
  };
  return {
    default: toastMock,
    __esModule: true,
  };
});

// Mock authSlice
vi.mock('@/store/authSlice', () => ({
  loginUser: vi.fn(),
  logout: vi.fn(),
}));

let mockAuthState = { loading: false, error: null };
const mockDispatch = vi.fn();

vi.mock('react-redux', async () => {
  const actual = await vi.importActual('react-redux');
  return {
    ...actual,
    useDispatch: () => mockDispatch,
    useSelector: (fn) => fn({ auth: mockAuthState }),
  };
});


describe('AdminLoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = { loading: false, error: null };
    mockDispatch.mockClear();
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <AdminLoginForm />
      </MemoryRouter>
    );

  it('renders login form elements correctly', () => {
    renderComponent();
    expect(screen.getByText('admin.auth.loginTitle')).toBeInTheDocument();
    expect(screen.getByText('admin.auth.loginSubtitle')).toBeInTheDocument();
    expect(screen.getByLabelText('admin.auth.usernameLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('admin.auth.passwordLabel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /admin.auth.accessWorkspace/i })).toBeInTheDocument();
  });

  it('shows error if submitting empty fields', () => {
    renderComponent();
    
    const submitBtn = screen.getByRole('button', { name: /admin.auth.accessWorkspace/i });
    fireEvent.submit(submitBtn.closest('form'));

    expect(toast.error).toHaveBeenCalledWith('Please enter both username and password.');
    expect(screen.getByText('Please enter both username and password.')).toBeInTheDocument();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('dispatches loginUser on valid form submission', async () => {
    renderComponent();

    mockDispatch.mockResolvedValueOnce({
      meta: { requestStatus: 'fulfilled' },
      payload: {},
    });

    const usernameInput = screen.getByLabelText('admin.auth.usernameLabel');
    const passwordInput = screen.getByLabelText('admin.auth.passwordLabel');
    const submitBtn = screen.getByRole('button', { name: /admin.auth.accessWorkspace/i });

    fireEvent.change(usernameInput, { target: { name: 'username', value: 'admin' } });
    fireEvent.change(passwordInput, { target: { name: 'password', value: 'secret' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(loginUser).toHaveBeenCalledWith({
        credentials: { username: 'admin', password: 'secret' },
        requireAdmin: true,
      });
      expect(mockDispatch).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Welcome back, Admin. Access granted.');
      expect(mockNavigate).toHaveBeenCalledWith('/admin/flights');
    });
  });

  it('shows error toast if login fails', async () => {
    renderComponent();

    mockDispatch.mockResolvedValueOnce({
      meta: { requestStatus: 'rejected' },
      payload: 'Invalid credentials',
    });

    const usernameInput = screen.getByLabelText('admin.auth.usernameLabel');
    const passwordInput = screen.getByLabelText('admin.auth.passwordLabel');
    const submitBtn = screen.getByRole('button', { name: /admin.auth.accessWorkspace/i });

    fireEvent.change(usernameInput, { target: { name: 'username', value: 'admin' } });
    fireEvent.change(passwordInput, { target: { name: 'password', value: 'wrongpass' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(loginUser).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('shows loading state on button when loading is true in state', () => {
    mockAuthState = { loading: true, error: null };
    
    renderComponent();

    const submitBtn = screen.getByRole('button', { name: /admin.auth.authenticating/i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText('admin.auth.authenticating')).toBeInTheDocument();
  });
});
