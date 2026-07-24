import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import router from '../index';
import { ProtectedRoute } from '../guards/ProtectedRoute';

// Mock lazy-loaded components to avoid actual rendering during configuration inspection
vi.mock('@/pages/landing/LandingPage', () => ({ default: () => null }));
vi.mock('@/pages/auth/login/LoginPage', () => ({ default: () => null }));
vi.mock('@/pages/auth/login/AdminLoginPage', () => ({ default: () => null }));
vi.mock('@/pages/auth/sign-up/RegisterPage', () => ({ default: () => null }));
vi.mock('@/pages/auth/login/ForgotPasswordPage', () => ({ default: () => null }));
vi.mock('@/pages/auth/login/ResetPasswordPage', () => ({ default: () => null }));
vi.mock('@/pages/user/UserFlightsList', () => ({ default: () => null }));
vi.mock('@/pages/user/UserFlightDetail', () => ({ default: () => null }));
vi.mock('@/pages/user/MyBookingsPage', () => ({ default: () => null }));
vi.mock('@/pages/user/BookingConfirmationPage', () => ({ default: () => null }));
vi.mock('@/pages/user-profile/ProfilePage', () => ({ default: () => null }));
vi.mock('@/pages/user/NotificationsPage', () => ({ default: () => null }));
vi.mock('@/pages/admin/AdminFlightsList', () => ({ default: () => null }));
vi.mock('@/pages/admin/AdminFlightForm', () => ({ default: () => null }));
vi.mock('@/pages/admin/AdminFlightDetail', () => ({ default: () => null }));
vi.mock('@/pages/admin/AnalyticsDashboard', () => ({ default: () => null }));

describe('Router Configuration', () => {
  it('should not wrap the landing page (index route) with ProtectedRoute guestOnly', () => {
    // router.routes[0] is the root layout route.
    // router.routes[0].children is the children routes.
    const rootRoute = router.routes[0];
    const indexRoute = rootRoute.children.find(r => r.index === true);

    expect(indexRoute).toBeDefined();
    
    // We check if the element is wrapped in ProtectedRoute.
    // In React, elements have a `type` property. If it's wrapped in ProtectedRoute, the type will be ProtectedRoute.
    const element = indexRoute.element;
    expect(element.type).not.toBe(ProtectedRoute);
  });
});
