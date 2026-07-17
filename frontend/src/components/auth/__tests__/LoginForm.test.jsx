import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginForm } from '../LoginForm';
import toast from 'react-hot-toast';
import { loginUser, googleLoginUser } from '@/store/authSlice';

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
  googleLoginUser: vi.fn(),
  logout: vi.fn(),
}));

// Mock google oauth
const mockGoogleLoginFn = vi.fn();
vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: () => mockGoogleLoginFn,
}));

let mockAuthState = { loading: false, error: null, isAuthenticated: false, profile: null };
const mockDispatch = vi.fn();

vi.mock('react-redux', async () => {
  const actual = await vi.importActual('react-redux');
  return {
    ...actual,
    useDispatch: () => mockDispatch,
    useSelector: (fn) => fn({ auth: mockAuthState }),
  };
});

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = { loading: false, error: null, isAuthenticated: false, profile: null };
    mockDispatch.mockClear();
    mockGoogleLoginFn.mockClear();
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

  it('renders login form elements correctly', () => {
    renderComponent();
    expect(screen.getByText('auth.welcomeBack')).toBeInTheDocument();
    expect(screen.getByText('auth.signInSubtitle')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.usernameOrEmail')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auth.signIn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auth.continueWithGoogle/i })).toBeInTheDocument();
  });

  it('shows error if submitting empty fields', () => {
    renderComponent();
    
    const submitBtn = screen.getByRole('button', { name: /auth.signIn/i });
    fireEvent.submit(submitBtn.closest('form'));

    expect(toast.error).toHaveBeenCalledWith('Please enter both username and password.');
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('dispatches loginUser on valid form submission', async () => {
    renderComponent();

    mockDispatch.mockResolvedValueOnce({
      meta: { requestStatus: 'fulfilled' },
      payload: { profile: { first_name: 'John' } },
    });

    const usernameInput = screen.getByLabelText('auth.usernameOrEmail');
    const passwordInput = screen.getByLabelText('auth.password');
    const submitBtn = screen.getByRole('button', { name: /auth.signIn/i });

    fireEvent.change(usernameInput, { target: { name: 'username', value: 'john@example.com' } });
    fireEvent.change(passwordInput, { target: { name: 'password', value: 'secret' } });
    fireEvent.submit(submitBtn.closest('form'));

    await waitFor(() => {
      expect(loginUser).toHaveBeenCalledWith({
        credentials: { username: 'john@example.com', password: 'secret' },
        requireCustomer: true,
      });
      expect(mockDispatch).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Welcome back, John!');
      expect(mockNavigate).toHaveBeenCalledWith('/flights');
    });
  });

  it('shows error toast if login fails', async () => {
    renderComponent();

    mockDispatch.mockResolvedValueOnce({
      meta: { requestStatus: 'rejected' },
      payload: 'Invalid credentials',
    });

    const usernameInput = screen.getByLabelText('auth.usernameOrEmail');
    const passwordInput = screen.getByLabelText('auth.password');
    const submitBtn = screen.getByRole('button', { name: /auth.signIn/i });

    fireEvent.change(usernameInput, { target: { name: 'username', value: 'john@example.com' } });
    fireEvent.change(passwordInput, { target: { name: 'password', value: 'wrongpass' } });
    fireEvent.submit(submitBtn.closest('form'));

    await waitFor(() => {
      expect(loginUser).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('calls googleLogin on google button click', () => {
    renderComponent();
    
    const googleBtn = screen.getByRole('button', { name: /auth.continueWithGoogle/i });
    fireEvent.click(googleBtn);
    
    expect(mockGoogleLoginFn).toHaveBeenCalled();
  });

  it('shows loading state on button when loading is true in state', () => {
    mockAuthState = { loading: true, error: null, isAuthenticated: false, profile: null };
    
    renderComponent();

    const submitBtn = screen.getByRole('button', { name: /auth.signingIn/i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText('auth.signingIn')).toBeInTheDocument();
  });
});
