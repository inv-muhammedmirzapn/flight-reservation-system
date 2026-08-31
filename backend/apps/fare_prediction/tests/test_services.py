"""
Tests for fare_prediction.services.FarePredictionService and FarePredictionView.

Strategy
--------
We mock `timezone.now()` to a **fixed Monday (2024-01-01 12:00 UTC)** so that
`days_until_departure` and the weekend-day check are fully deterministic:

    now  = Mon 2024-01-01
    +1   = Tue 2024-01-02  (weekday, not weekend)
    +2   = Wed 2024-01-03  (weekday, not weekend)
    +3   = Thu 2024-01-04  (weekday, not weekend)
    +4   = Fri 2024-01-05  *** WEEKEND ***
    +7   = Mon 2024-01-08  (weekday, not weekend)
    +12  = Sat 2024-01-13  *** WEEKEND ***
    +9   = Wed 2024-01-10  (weekday, not weekend)
    +30  = Wed 2024-01-31  (weekday, not weekend)

Covered scenarios
-----------------
- Invalid flight instance → ValueError
- Direction: INCREASE / STABLE / DECREASE
- Confidence formula (abs)
- Every occupancy bucket (0%, <30%, 30-50%, 50-70%, 70-85%, 85%+)
- Every days-until-departure bucket (<=3, <=7, <=14, >14)
- Weekend flag (Fri → +1, Mon → no bonus)
- Booking velocity (>=10, >=5, <5)
- No fare record (price → 0.0, currency → INR)
- API view: 200, 400 (bad cabin_class), 404, 500, case-insensitive cabin_class
"""
from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch, MagicMock, call

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.fare_prediction.services import FarePredictionService

# ─── Fixed clock ──────────────────────────────────────────────────────────────
# Monday 2024-01-01 12:00 UTC — all departure times are offset from this.
FIXED_NOW = datetime(2024, 1, 1, 12, 0, 0, tzinfo=dt_timezone.utc)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _departure(days_ahead: int) -> datetime:
    """Return FIXED_NOW + days_ahead (always deterministic weekday)."""
    return FIXED_NOW + timedelta(days=days_ahead)


def _make_fi(days_ahead: int, total_seats: int, booked_seats: int) -> MagicMock:
    """Build a mock FlightInstance with a controlled departure and seat counts."""
    fi = MagicMock()
    fi.id = 1
    fi.scheduled_departure = _departure(days_ahead)

    def seats_filter(**kwargs):
        q = MagicMock()
        if kwargs.get("status") == "BOOKED":
            q.count.return_value = booked_seats
        else:
            q.count.return_value = total_seats
        return q

    fi.seats = MagicMock()
    fi.seats.filter.side_effect = seats_filter
    return fi


# ─── Base test mixin ──────────────────────────────────────────────────────────

class FarePredictionServiceTest(TestCase):
    """Unit tests for FarePredictionService.predict_fare()."""

    def _run(
        self,
        *,
        days_ahead: int = 30,
        total_seats: int = 100,
        booked_seats: int = 40,
        booking_velocity: int = 0,
        fare_price: float = 5000.0,
        cabin_class: str = "ECONOMY",
    ) -> dict:
        """
        Run predict_fare with all DB calls mocked.
        timezone.now() is fixed to FIXED_NOW (Monday 2024-01-01).
        """
        fi = _make_fi(days_ahead, total_seats, booked_seats)
        fare_mock = MagicMock()
        fare_mock.price = fare_price
        fare_mock.currency = "INR"

        with (
            patch("apps.fare_prediction.services.timezone") as tz_mock,
            patch("apps.fare_prediction.services.FlightInstance.objects") as fi_mgr,
            patch("apps.fare_prediction.services.Fare.objects") as fare_mgr,
            patch("apps.fare_prediction.services.Booking.objects") as booking_mgr,
        ):
            tz_mock.now.return_value = FIXED_NOW
            fi_mgr.select_related.return_value.get.return_value = fi
            fare_mgr.filter.return_value.first.return_value = fare_mock
            booking_mgr.filter.return_value.count.return_value = booking_velocity

            return FarePredictionService.predict_fare(
                flight_instance_id=1,
                cabin_class=cabin_class,
            )

    # ── Response shape ────────────────────────────────────────────────────────

    def test_response_has_all_required_keys(self):
        result = self._run()
        expected = {
            "flight_instance_id", "cabin_class", "direction",
            "confidence", "current_price", "currency",
            "occupancy_pct", "days_until_departure", "factors", "advice",
        }
        self.assertEqual(set(result.keys()), expected)

    def test_cabin_class_echoed_in_response(self):
        result = self._run(cabin_class="BUSINESS")
        self.assertEqual(result["cabin_class"], "BUSINESS")

    def test_current_price_and_currency_returned(self):
        result = self._run(fare_price=3500.0)
        self.assertAlmostEqual(result["current_price"], 3500.0)
        self.assertEqual(result["currency"], "INR")

    # ── Invalid flight instance ───────────────────────────────────────────────

    def test_raises_value_error_for_missing_flight_instance(self):
        from apps.flights.models import FlightInstance
        with (
            patch("apps.fare_prediction.services.timezone") as tz_mock,
            patch("apps.fare_prediction.services.FlightInstance.objects") as fi_mgr,
        ):
            tz_mock.now.return_value = FIXED_NOW
            fi_mgr.select_related.return_value.get.side_effect = FlightInstance.DoesNotExist
            with self.assertRaises(ValueError) as ctx:
                FarePredictionService.predict_fare(flight_instance_id=9999)
            self.assertIn("9999", str(ctx.exception))

    # ── Direction: INCREASE ───────────────────────────────────────────────────

    def test_direction_increase_within_3_days(self):
        # +2 days = Wed Jan 3 (not weekend): days<=3 (+3), occ=40% (0) → score=3 → INCREASE
        result = self._run(days_ahead=2, booked_seats=40)
        self.assertEqual(result["direction"], "INCREASE")
        self.assertEqual(result["days_until_departure"], 2)

    def test_direction_increase_within_7_days_plus_occupancy(self):
        # +3 days = Thu Jan 4 (not weekend): days<=7 (+2), occ=55% (+1) → score=3 → INCREASE
        result = self._run(days_ahead=3, booked_seats=55)
        self.assertEqual(result["direction"], "INCREASE")

    def test_direction_increase_velocity_spike(self):
        # +30 days = Wed Jan 31 (not weekend): occ=40% (0), velocity>=10 (+2), days>14 (0) → score=2
        # Need +1 more: use occ>=50% (+1) → score=3 → INCREASE
        result = self._run(days_ahead=30, booked_seats=60, booking_velocity=10)
        self.assertEqual(result["direction"], "INCREASE")

    # ── Direction: STABLE ─────────────────────────────────────────────────────

    def test_direction_stable_score_0(self):
        # +30 days (not weekend, not <14 days), occ=40% (neutral) → score=0 → STABLE
        result = self._run(days_ahead=30, booked_seats=40)
        self.assertEqual(result["direction"], "STABLE")

    def test_direction_stable_score_2(self):
        # +9 days = Wed Jan 10 (not weekend): days<=14 (+1), occ=60% (+1) → score=2 → STABLE
        result = self._run(days_ahead=9, booked_seats=60)
        self.assertEqual(result["direction"], "STABLE")

    # ── Direction: DECREASE ───────────────────────────────────────────────────

    def test_direction_decrease_low_occupancy(self):
        # +30 days (not weekend), occ<30% (-2) → score=-2 → DECREASE
        result = self._run(days_ahead=30, booked_seats=10)
        self.assertEqual(result["direction"], "DECREASE")

    # ── Confidence ───────────────────────────────────────────────────────────

    def test_confidence_stable_score_0_is_50(self):
        result = self._run(days_ahead=30, booked_seats=40)
        self.assertEqual(result["confidence"], 50)

    def test_confidence_increase_score_3_is_80(self):
        # +2 days (Wed Jan 3, not weekend): score=3 → 50 + abs(3)*10 = 80
        result = self._run(days_ahead=2, booked_seats=40)
        self.assertEqual(result["confidence"], 80)

    def test_confidence_decrease_score_minus2_is_70(self):
        # +30 days (not weekend), occ<30%: score=-2 → 50 + abs(-2)*10 = 70
        result = self._run(days_ahead=30, booked_seats=10)
        self.assertEqual(result["confidence"], 70)

    def test_confidence_capped_at_95(self):
        # +4 days = Fri Jan 5 (WEEKEND): days<=7(+2) + occ>=85%(+3) + weekend(+1) + velocity>=10(+2) = 8
        # 50 + abs(8)*10 = 130 → capped at 95
        result = self._run(days_ahead=4, booked_seats=90, booking_velocity=10)
        self.assertEqual(result["confidence"], 95)

    # ── Occupancy scoring ─────────────────────────────────────────────────────

    def test_occupancy_zero_no_seats_gives_score_minus1(self):
        # total_seats=0 → occupancy=0% → score-=2, but days>14(0) → score=-2 → DECREASE
        result = self._run(days_ahead=30, total_seats=0, booked_seats=0)
        self.assertEqual(result["direction"], "DECREASE")
        self.assertEqual(result["occupancy_pct"], 0.0)

    def test_occupancy_85_plus_adds_3(self):
        # +30 days (not weekend), occ=86% (+3) → score=3 → INCREASE
        result = self._run(days_ahead=30, booked_seats=86)
        self.assertEqual(result["direction"], "INCREASE")
        self.assertEqual(result["confidence"], 80)

    def test_occupancy_70_to_84_adds_2(self):
        # +30 days (not weekend), occ=75% (+2) → score=2 → STABLE, conf=70
        result = self._run(days_ahead=30, booked_seats=75)
        self.assertEqual(result["direction"], "STABLE")
        self.assertEqual(result["confidence"], 70)

    def test_occupancy_50_to_69_adds_1(self):
        # +30 days (not weekend), occ=60% (+1) → score=1 → STABLE, conf=60
        result = self._run(days_ahead=30, booked_seats=60)
        self.assertEqual(result["direction"], "STABLE")
        self.assertEqual(result["confidence"], 60)

    def test_occupancy_30_to_49_adds_0(self):
        # +30 days (not weekend), occ=40% (no signal) → score=0 → STABLE, conf=50
        result = self._run(days_ahead=30, booked_seats=40)
        self.assertEqual(result["direction"], "STABLE")
        self.assertEqual(result["confidence"], 50)

    def test_occupancy_under_30_subtracts_2(self):
        # +30 days (not weekend), occ=10% (-2) → score=-2 → DECREASE
        result = self._run(days_ahead=30, booked_seats=10)
        self.assertEqual(result["direction"], "DECREASE")
        self.assertTrue(any("low demand" in f for f in result["factors"]))

    # ── Days-until-departure ──────────────────────────────────────────────────

    def test_days_3_or_less_adds_3_and_mentions_3_days(self):
        # +2 days = Wed Jan 3 (not weekend): score=3 → INCREASE
        result = self._run(days_ahead=2, booked_seats=40)
        self.assertIn("3 days", result["factors"][0])
        self.assertEqual(result["days_until_departure"], 2)

    def test_days_4_to_7_adds_2_and_mentions_week(self):
        # +7 days = Mon Jan 8 (not weekend): days<=7(+2), occ=40%(0) → score=2 → STABLE
        result = self._run(days_ahead=7, booked_seats=40)
        self.assertEqual(result["direction"], "STABLE")
        self.assertTrue(any("week" in f for f in result["factors"]))

    def test_days_8_to_14_adds_1_and_mentions_2_weeks(self):
        # +9 days = Wed Jan 10 (not weekend): days<=14(+1), occ=40%(0) → score=1 → STABLE
        result = self._run(days_ahead=9, booked_seats=40)
        self.assertEqual(result["direction"], "STABLE")
        self.assertTrue(any("2 weeks" in f for f in result["factors"]))

    def test_days_more_than_14_adds_0_no_days_factor(self):
        # +30 days = Wed Jan 31 (not weekend): no days signal, occ=40%(0) → score=0
        result = self._run(days_ahead=30, booked_seats=40)
        self.assertEqual(result["days_until_departure"], 30)
        days_factors = [f for f in result["factors"] if "days" in f.lower() or "week" in f.lower()]
        self.assertEqual(len(days_factors), 0)

    # ── Weekend flag ──────────────────────────────────────────────────────────

    def test_friday_departure_adds_weekend_bonus(self):
        # +4 days = Fri Jan 5 (WEEKEND): days<=7(+2) + occ=40%(0) + weekend(+1) = score=3 → INCREASE
        result = self._run(days_ahead=4, booked_seats=40)
        self.assertTrue(any("Weekend" in f for f in result["factors"]))
        self.assertEqual(result["direction"], "INCREASE")

    def test_monday_departure_no_weekend_bonus(self):
        # +7 days = Mon Jan 8 (not weekend): no weekend factor
        result = self._run(days_ahead=7, booked_seats=40)
        self.assertFalse(any("Weekend" in f for f in result["factors"]))

    # ── Booking velocity ──────────────────────────────────────────────────────

    def test_velocity_10_plus_adds_2(self):
        # +30 days (not weekend), occ=40%(0), velocity=10(+2) → score=2 → STABLE, conf=70
        result = self._run(days_ahead=30, booked_seats=40, booking_velocity=10)
        self.assertEqual(result["direction"], "STABLE")
        self.assertEqual(result["confidence"], 70)
        self.assertTrue(any("spiked" in f for f in result["factors"]))

    def test_velocity_5_to_9_adds_1(self):
        # +30 days (not weekend), occ=40%(0), velocity=7(+1) → score=1 → STABLE, conf=60
        result = self._run(days_ahead=30, booked_seats=40, booking_velocity=7)
        self.assertEqual(result["direction"], "STABLE")
        self.assertEqual(result["confidence"], 60)
        self.assertTrue(any("increased" in f for f in result["factors"]))

    def test_velocity_below_5_adds_0(self):
        # +30 days (not weekend), occ=40%(0), velocity=3(0) → score=0
        result = self._run(days_ahead=30, booked_seats=40, booking_velocity=3)
        booking_factors = [f for f in result["factors"] if "booking" in f.lower() or "rate" in f.lower()]
        self.assertEqual(len(booking_factors), 0)

    # ── Advice text ───────────────────────────────────────────────────────────

    def test_advice_increase(self):
        result = self._run(days_ahead=2, booked_seats=40)
        self.assertIn("booking now", result["advice"])

    def test_advice_decrease(self):
        result = self._run(days_ahead=30, booked_seats=10)
        self.assertIn("wait", result["advice"])

    def test_advice_stable(self):
        result = self._run(days_ahead=30, booked_seats=40)
        self.assertIn("stable", result["advice"])

    # ── No fare record ────────────────────────────────────────────────────────

    def test_no_fare_defaults_to_zero_price_inr(self):
        fi = _make_fi(30, 100, 40)
        with (
            patch("apps.fare_prediction.services.timezone") as tz_mock,
            patch("apps.fare_prediction.services.FlightInstance.objects") as fi_mgr,
            patch("apps.fare_prediction.services.Fare.objects") as fare_mgr,
            patch("apps.fare_prediction.services.Booking.objects") as booking_mgr,
        ):
            tz_mock.now.return_value = FIXED_NOW
            fi_mgr.select_related.return_value.get.return_value = fi
            fare_mgr.filter.return_value.first.return_value = None
            booking_mgr.filter.return_value.count.return_value = 0
            result = FarePredictionService.predict_fare(flight_instance_id=1)

        self.assertEqual(result["current_price"], 0.0)
        self.assertEqual(result["currency"], "INR")


# ─── API View Tests ────────────────────────────────────────────────────────────

class FarePredictionViewTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/fare-prediction/1/"

    def _mock_result(self, direction="INCREASE", confidence=80):
        return {
            "flight_instance_id": 1,
            "cabin_class": "ECONOMY",
            "direction": direction,
            "confidence": confidence,
            "current_price": 5000.0,
            "currency": "INR",
            "occupancy_pct": 60.0,
            "days_until_departure": 5,
            "factors": ["Departure is within a week — prices typically rise."],
            "advice": "We recommend booking now to secure the current price.",
        }

    def test_200_ok(self):
        with patch(
            "apps.fare_prediction.views.FarePredictionService.predict_fare",
            return_value=self._mock_result(),
        ):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("direction", response.data)
        self.assertIn("confidence", response.data)

    def test_200_with_explicit_cabin_class(self):
        with patch(
            "apps.fare_prediction.views.FarePredictionService.predict_fare",
            return_value=self._mock_result(),
        ):
            response = self.client.get(self.url + "?cabin_class=BUSINESS")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_400_invalid_cabin_class(self):
        response = self.client.get(self.url + "?cabin_class=PREMIUM")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_404_flight_instance_not_found(self):
        with patch(
            "apps.fare_prediction.views.FarePredictionService.predict_fare",
            side_effect=ValueError("FlightInstance with id=1 not found."),
        ):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("error", response.data)

    def test_500_unexpected_error(self):
        with patch(
            "apps.fare_prediction.views.FarePredictionService.predict_fare",
            side_effect=RuntimeError("DB connection lost"),
        ):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn("error", response.data)

    def test_cabin_class_is_case_insensitive(self):
        """Query param 'economy' must be normalised to 'ECONOMY'."""
        with patch(
            "apps.fare_prediction.views.FarePredictionService.predict_fare",
            return_value=self._mock_result(),
        ):
            response = self.client.get(self.url + "?cabin_class=economy")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
