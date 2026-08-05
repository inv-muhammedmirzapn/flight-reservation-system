"""
Tests for M7 Analytics APIs.
Covers all 5 endpoints: summary, monthly-revenue, popular-routes,
flight-occupancy, and peak-booking-hours.
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.flights.models import Country, Airport, Airline, AircraftModel, Aircraft, FlightRoute, FlightLeg, FlightInstance, Seat, SeatStatus
from apps.bookings.models import Booking, BookingStatus

User = get_user_model()


def make_flight(flight_number, src="JFK", dst="LAX", fare=200.00,
                total=100, available=80):
    country, _ = Country.objects.get_or_create(name="USA", iso_code="USA")
    src_airport, _ = Airport.objects.get_or_create(iata_code=src, airport_name=f"{src} Airport", city=src, country=country)
    dst_airport, _ = Airport.objects.get_or_create(iata_code=dst, airport_name=f"{dst} Airport", city=dst, country=country)
    airline, _ = Airline.objects.get_or_create(iata_airline_code="TA", airline_name="TestAir")
    ac_model, _ = AircraftModel.objects.get_or_create(manufacturer="Boeing", model_name="737")
    aircraft, _ = Aircraft.objects.get_or_create(registration=f"N{flight_number}", airline=airline, aircraft_model=ac_model)
    route, _ = FlightRoute.objects.get_or_create(flight_no=flight_number, airline=airline)
    FlightLeg.objects.get_or_create(flight=route, leg_order=1, departure_airport=src_airport, arrival_airport=dst_airport)
    
    fi = FlightInstance.objects.create(
        flight=route, 
        date=timezone.now().date(),
        aircraft=aircraft,
        scheduled_departure=timezone.now() + timezone.timedelta(hours=2),
        scheduled_arrival=timezone.now() + timezone.timedelta(hours=7)
    )
    
    booked_count = total - available
    seats = []
    for i in range(total):
        status = SeatStatus.BOOKED if i < booked_count else SeatStatus.AVAILABLE
        seats.append(Seat(flight_instance=fi, seat_number=str(i), seat_class="ECONOMY", status=status))
    Seat.objects.bulk_create(seats)
    
    # Store fare on the instance for test usage
    fi._test_fare = fare
    return fi


class AnalyticsBaseTestCase(APITestCase):
    """
    Base class: creates one admin user, one regular user, two flights,
    and a mix of confirmed/cancelled bookings.
    """

    def setUp(self):
        # Admin user
        self.admin = User.objects.create_superuser(
            username="admin_test", email="admin@test.com", password="admin123"
        )
        # Regular user
        self.user = User.objects.create_user(
            username="regular_test", email="user@test.com", password="user123"
        )

        # Flights
        self.flight1 = make_flight("TA001", src="JFK", dst="LAX",
                                   fare=300.00, total=100, available=70)
        self.flight2 = make_flight("TA002", src="BOM", dst="DEL",
                                   fare=150.00, total=50, available=45)

        # Confirmed bookings
        for _ in range(3):
            Booking.objects.create(
                user=self.user, flight=self.flight1,
                status=BookingStatus.CONFIRMED,
                total_price=self.flight1._test_fare
            )
        for _ in range(2):
            Booking.objects.create(
                user=self.user, flight=self.flight2,
                status=BookingStatus.CONFIRMED,
                total_price=self.flight2._test_fare
            )

        # Cancelled booking
        Booking.objects.create(
            user=self.user, flight=self.flight1,
            status=BookingStatus.CANCELLED,
            total_price=self.flight1._test_fare
        )

    def admin_auth(self):
        token = RefreshToken.for_user(self.admin)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}"
        )

    def user_auth(self):
        token = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}"
        )


# ─────────────────────────────────────────────
# 1. Summary endpoint
# ─────────────────────────────────────────────
class SummaryViewTests(AnalyticsBaseTestCase):

    URL = "/api/analytics/summary/"

    def test_admin_gets_summary(self):
        self.admin_auth()
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        # 5 confirmed + 1 cancelled = 6 total
        self.assertEqual(data["total_bookings"], 6)
        self.assertEqual(data["confirmed_bookings"], 5)
        self.assertEqual(data["cancelled_bookings"], 1)
        # cancellation_rate = 1/6 * 100
        self.assertAlmostEqual(data["cancellation_rate"], 16.67, places=1)
        # revenue = 3*300 + 2*150 = 900 + 300 = 1200
        self.assertAlmostEqual(data["total_revenue"], 1200.0, places=1)

    def test_regular_user_is_forbidden(self):
        self.user_auth()
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_is_forbidden(self):
        self.client.credentials()
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_summary_fields_present(self):
        self.admin_auth()
        res = self.client.get(self.URL)
        expected_keys = {
            "total_bookings", "confirmed_bookings",
            "cancelled_bookings", "cancellation_rate", "total_revenue"
        }
        self.assertTrue(expected_keys.issubset(res.data.keys()))


# ─────────────────────────────────────────────
# 2. Monthly Revenue endpoint
# ─────────────────────────────────────────────
class MonthlyRevenueViewTests(AnalyticsBaseTestCase):

    URL = "/api/analytics/monthly-revenue/"

    def test_returns_list(self):
        self.admin_auth()
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)

    def test_current_month_has_revenue(self):
        self.admin_auth()
        res = self.client.get(self.URL)
        current_month = timezone.now().strftime("%Y-%m")
        months = [item["month"] for item in res.data]
        self.assertIn(current_month, months)
        this_month = next(i for i in res.data if i["month"] == current_month)
        self.assertAlmostEqual(this_month["revenue"], 1200.0, places=1)

    def test_months_param_accepted(self):
        self.admin_auth()
        res = self.client.get(self.URL, {"months": 6})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_invalid_months_defaults_to_12(self):
        self.admin_auth()
        res = self.client.get(self.URL, {"months": "abc"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_forbidden_for_regular_user(self):
        self.user_auth()
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


# ─────────────────────────────────────────────
# 3. Popular Routes endpoint
# ─────────────────────────────────────────────
class PopularRoutesViewTests(AnalyticsBaseTestCase):

    URL = "/api/analytics/popular-routes/"

    def test_returns_list(self):
        self.admin_auth()
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)

    def test_top_route_is_jfk_lax(self):
        self.admin_auth()
        res = self.client.get(self.URL)
        # JFK→LAX has 3 confirmed, BOM→DEL has 2
        self.assertGreater(len(res.data), 0)
        top = res.data[0]
        self.assertEqual(top["source"], "JFK")
        self.assertEqual(top["destination"], "LAX")
        self.assertEqual(top["bookings"], 3)

    def test_route_label_format(self):
        self.admin_auth()
        res = self.client.get(self.URL)
        for item in res.data:
            self.assertIn("→", item["route"])

    def test_top_param_limits_results(self):
        self.admin_auth()
        res = self.client.get(self.URL, {"top": 1})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(res.data), 1)

    def test_forbidden_for_regular_user(self):
        self.user_auth()
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


# ─────────────────────────────────────────────
# 4. Flight Occupancy endpoint
# ─────────────────────────────────────────────
class FlightOccupancyViewTests(AnalyticsBaseTestCase):

    URL = "/api/analytics/flight-occupancy/"

    def test_returns_list(self):
        self.admin_auth()
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)

    def test_occupancy_fields(self):
        self.admin_auth()
        res = self.client.get(self.URL)
        for item in res.data:
            self.assertIn("flight_number", item)
            self.assertIn("occupancy_rate", item)
            self.assertIn("booked_seats", item)
            self.assertIn("total_seats", item)
            self.assertGreaterEqual(item["occupancy_rate"], 0)
            self.assertLessEqual(item["occupancy_rate"], 100)

    def test_top_param(self):
        self.admin_auth()
        res = self.client.get(self.URL, {"top": 1})
        self.assertLessEqual(len(res.data), 1)

    def test_forbidden_for_regular_user(self):
        self.user_auth()
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


# ─────────────────────────────────────────────
# 5. Peak Booking Hours endpoint
# ─────────────────────────────────────────────
class PeakBookingHoursViewTests(AnalyticsBaseTestCase):

    URL = "/api/analytics/peak-booking-hours/"

    def test_returns_24_hours(self):
        self.admin_auth()
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 24)

    def test_hours_are_0_to_23(self):
        self.admin_auth()
        res = self.client.get(self.URL)
        hours = [item["hour"] for item in res.data]
        self.assertEqual(hours, list(range(24)))

    def test_total_bookings_match(self):
        self.admin_auth()
        res = self.client.get(self.URL)
        total = sum(item["bookings"] for item in res.data)
        # 6 total bookings (5 confirmed + 1 cancelled)
        self.assertEqual(total, 6)

    def test_forbidden_for_regular_user(self):
        self.user_auth()
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_is_forbidden(self):
        self.client.credentials()
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
