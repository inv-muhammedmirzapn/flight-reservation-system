import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import flightsReducer from './flightSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    flights: flightsReducer,
  },
});
