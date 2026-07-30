import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "@/store";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/layout/Navbar";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import LandingPage from "@/pages/landing/LandingPage";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import FlightsPage from "@/pages/flights/FlightsPage";
import FlightDetailPage from "@/pages/flights/FlightDetailPage";
import BookingConfirmationPage from "@/pages/bookings/BookingConfirmationPage";
import MyBookingsPage from "@/pages/bookings/MyBookingsPage";
import TicketDetailPage from "@/pages/bookings/TicketDetailPage";
import TicketCancellationPage from "@/pages/bookings/TicketCancellationPage";
import UserProfilePage from "@/pages/profile/UserProfilePage";

export default function App() {
  return (
    <Provider store={store}>
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            fontWeight: "600",
            borderRadius: "16px",
            padding: "12px 18px",
            color: "#0f172a",
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(226, 232, 240, 0.8)",
            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
          },
          success: {
            duration: 3500,
            style: {
              background: "#f0fdf4",
              color: "#064e3b",
              border: "1px solid #a7f3d0",
            },
            iconTheme: {
              primary: "#10b981",
              secondary: "#ffffff",
            },
          },
          error: {
            duration: 4000,
            style: {
              background: "#fff1f2",
              color: "#881337",
              border: "1px solid #fecdd3",
            },
            iconTheme: {
              primary: "#f43f5e",
              secondary: "#ffffff",
            },
          },
          loading: {
            style: {
              background: "#0f172a",
              color: "#f8fafc",
              border: "1px solid #334155",
            },
            iconTheme: {
              primary: "#fbbf24",
              secondary: "#0f172a",
            },
          },
        }}
      />
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
          {/* Global Header */}
          <Navbar />

          {/* Main Routing Container */}
          <main className="flex-1 flex flex-col">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/flights" element={<FlightsPage />} />
              <Route path="/flights/:id" element={<FlightDetailPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Routes (Authentication Required) */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <UserProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bookings"
                element={
                  <ProtectedRoute>
                    <MyBookingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/booking-confirmation/:id"
                element={
                  <ProtectedRoute>
                    <BookingConfirmationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/booking-confirmation/waitlist/:id"
                element={
                  <ProtectedRoute>
                    <BookingConfirmationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bookings/ticket/:id"
                element={
                  <ProtectedRoute>
                    <TicketDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bookings/ticket/waitlist/:id"
                element={
                  <ProtectedRoute>
                    <TicketDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bookings/cancel/:id"
                element={
                  <ProtectedRoute>
                    <TicketCancellationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bookings/cancel/waitlist/:id"
                element={
                  <ProtectedRoute>
                    <TicketCancellationPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </Provider>
  );
}
