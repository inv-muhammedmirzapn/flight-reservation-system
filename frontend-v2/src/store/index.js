import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import flightsReducer from './flightSlice';
import bookingsReducer from './bookingSlice';
import waitlistReducer from './waitlistSlice';
import notificationsReducer from './notificationsSlice';
import systemReducer from './systemSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    flights: flightsReducer,
    bookings: bookingsReducer,
    waitlist: waitlistReducer,
    notifications: notificationsReducer,
    system: systemReducer,
  },
});
