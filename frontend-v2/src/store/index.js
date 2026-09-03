import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import flightsReducer from './flightSlice';
import bookingsReducer from './bookingSlice';
import waitlistReducer from './waitlistSlice';
import notificationsReducer from './notificationsSlice';
import systemReducer from './systemSlice';
import comparisonReducer from './comparisonSlice';


// Admin entity reducers
import {
  countryReducer,
  airportReducer,
  airlineReducer,
  aircraftModelReducer,
  aircraftReducer,
  flightRouteReducer,
  flightInstanceReducer,
  seatReducer,
  seatPriceTemplateReducer,
  fareReducer,
  foodItemReducer,
  flightMealReducer,
  routeFareClassReducer,
  dynamicPricingConfigReducer,
  holidayEventReducer,
  dynamicPriceLogReducer,
} from '@/admin/_core/store/adminSlices';

export const store = configureStore({
  reducer: {
    // Passenger app
    auth: authReducer,
    flights: flightsReducer,
    bookings: bookingsReducer,
    waitlist: waitlistReducer,
    notifications: notificationsReducer,
    system: systemReducer,
    comparison: comparisonReducer,  

    // Admin panel entities
    country: countryReducer,
    airport: airportReducer,
    airline: airlineReducer,
    aircraftModel: aircraftModelReducer,
    aircraft: aircraftReducer,
    flightRoute: flightRouteReducer,
    flightInstance: flightInstanceReducer,
    seat: seatReducer,
    seatPriceTemplate: seatPriceTemplateReducer,
    fare: fareReducer,
    foodItem: foodItemReducer,
    flightMeal: flightMealReducer,
    routeFareClass: routeFareClassReducer,
    dynamicPricingConfig: dynamicPricingConfigReducer,
    holidayEvent: holidayEventReducer,
    dynamicPriceLog: dynamicPriceLogReducer,
  },
});

