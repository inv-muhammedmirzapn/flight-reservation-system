import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import flightsReducer from './flightSlice';
import bookingsReducer from './bookingSlice';
import waitlistReducer from './waitlistSlice';
import notificationsReducer from './notificationsSlice';

// New admin entity reducers
import {
  countryReducer,
  airportReducer,
  airlineReducer,
  aircraftModelReducer,
  aircraftReducer,
  flightRouteReducer,
  flightInstanceReducer,
  seatReducer,
  fareReducer,
  foodItemReducer,
  flightMealReducer,
  seatPriceTemplateReducer,
} from '@/admin/_core/store/adminSlices';

export const store = configureStore({
  reducer: {
    // Legacy
    auth: authReducer,
    flights: flightsReducer,
    bookings: bookingsReducer,
    waitlist: waitlistReducer,
    notifications: notificationsReducer,
    // New admin entities
    country: countryReducer,
    airport: airportReducer,
    airline: airlineReducer,
    aircraftModel: aircraftModelReducer,
    aircraft: aircraftReducer,
    flightRoute: flightRouteReducer,
    flightInstance: flightInstanceReducer,
    seat: seatReducer,
    fare: fareReducer,
    foodItem: foodItemReducer,
    flightMeal: flightMealReducer,
    seatPriceTemplate: seatPriceTemplateReducer,
  },
});

