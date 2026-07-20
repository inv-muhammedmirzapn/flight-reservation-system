import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import flightsReducer from './flightSlice';
import bookingsReducer from './bookingSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    flights: flightsReducer,
    bookings: bookingsReducer,
  },
});
