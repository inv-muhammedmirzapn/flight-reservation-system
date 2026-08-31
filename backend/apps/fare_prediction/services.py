import logging
from datetime import timedelta
from django.utils import timezone
from apps.flights.models import FlightInstance, Fare, SeatStatus
from apps.bookings.models import Booking, BookingStatus


logger = logging.getLogger(__name__)


class FarePredictionService:
    @staticmethod
    def predict_fare(flight_instance_id: int, cabin_class:str ="ECONOMY") -> dict:

        try:
            fi=FlightInstance.objects.select_related("flight","flight__airline","aircraft").get(id=flight_instance_id)
        
        except FlightInstance.DoesNotExist:
            raise ValueError(f"FlightInstance with id={flight_instance_id} not found.")


        # get the fare information
        fare = Fare.objects.filter(flight_instance=fi,cabin_class=cabin_class).first()
        # Get current price
        current_price = float(fare.price) if fare else 0.0
        # Get currency
        currency = fare.currency if fare else "INR"
        
        now = timezone.now()
        departure = fi.scheduled_departure

        # ── Already-departed guard ──────────────────────────────────────────
        # If the flight has already left, forward-looking scoring is meaningless.
        # Instead, return a historical summary of final occupancy & bookings.
        if departure < now:
            fare = Fare.objects.filter(flight_instance=fi, cabin_class=cabin_class).first()
            current_price = float(fare.price) if fare else 0.0
            currency = fare.currency if fare else "INR"

            total_seats = fi.seats.filter(seat_class=cabin_class).count()
            booked_seats = fi.seats.filter(
                seat_class=cabin_class, status=SeatStatus.BOOKED
            ).count()
            occupancy_pct = (booked_seats / total_seats * 100) if total_seats > 0 else 0

            total_bookings = Booking.objects.filter(
                flight=fi, status=BookingStatus.CONFIRMED
            ).count()

            days_ago = (now.date() - departure.date()).days

            logger.info(
                "FarePrediction | flight=%s cabin=%s direction=DEPARTED days_ago=%s",
                flight_instance_id, cabin_class, days_ago
            )

            return {
                "flight_instance_id": flight_instance_id,
                "cabin_class": cabin_class,
                "direction": "DEPARTED",
                "confidence": 100,
                "current_price": current_price,
                "currency": currency,
                "occupancy_pct": round(occupancy_pct, 1),
                "days_until_departure": -days_ago,   # negative = departed N days ago
                "factors": [
                    f"This flight departed {days_ago} day{'s' if days_ago != 1 else ''} ago.",
                    f"Final cabin occupancy was {occupancy_pct:.0f}% ({booked_seats}/{total_seats} seats).",
                    f"Total confirmed bookings: {total_bookings}.",
                ],
                "advice": (
                    "This flight has already departed. "
                    "No fare prediction is available — booking is no longer possible."
                ),
            }
        # ────────────────────────────────────────────────────────────────────

        # compute number of days until departure
        days_until_departure = max(0, (departure.date() - now.date()).days)
        # Calculate occupancy rate for the cabin class
        total_seats = fi.seats.filter(seat_class=cabin_class).count()
        booked_seats = fi.seats.filter(
            seat_class=cabin_class,
            status=SeatStatus.BOOKED
        ).count()
        occupancy_pct = (booked_seats / total_seats * 100) if total_seats > 0 else 0


        # Check if the departure is on a weekend
        is_weekend = departure.weekday() in [4, 5, 6]  # Fri, Sat, Sun
        
        # Calculate booking velocity over the last 48 hours
        cutoff_48h = now - timedelta(hours=48)
        booking_velocity = Booking.objects.filter(
            flight=fi,
            status=BookingStatus.CONFIRMED,
            created_at__gte=cutoff_48h
        ).count()


        # 4. Score each signal
        score = 0
        factors = []

        if days_until_departure <= 3:
            score += 3
            factors.append("Departure is within 3 days — strong last-minute surge expected.")
        elif days_until_departure <= 7:
            score += 2
            factors.append("Departure is within a week — prices typically rise.")
        elif days_until_departure <= 14:
            score += 1
            factors.append("Departure is within 2 weeks — mild upward pressure.")


        if occupancy_pct >= 85:
            score += 3
            factors.append(f"Flight is {occupancy_pct:.0f}% full — very limited seats available.")
        elif occupancy_pct >= 70:
            score += 2
            factors.append(f"Flight is {occupancy_pct:.0f}% full — high demand detected.")
        elif occupancy_pct >= 50:
            score += 1
            factors.append(f"Flight is {occupancy_pct:.0f}% full — moderate demand.")
        elif occupancy_pct < 30:
            score -= 2
            factors.append(f"Flight is only {occupancy_pct:.0f}% full — low demand may soften prices.")


        if is_weekend:
            score += 1
            factors.append("Weekend departure — historically higher passenger demand.")
        if booking_velocity >= 10:
            score += 2
            factors.append("Booking rate has spiked significantly in the last 48 hours.")
        elif booking_velocity >= 5:
            score += 1
            factors.append("Booking activity has increased over the last 48 hours.")
            
        # 5. Determine direction
        if score >= 3:
            direction = "INCREASE"
        elif score <= -1:
            direction = "DECREASE"
        else:
            direction = "STABLE"

        # 6. Confidence: 50% base + 10% per point of score magnitude, never exceed 95%.
        # abs() is correct here — confidence measures certainty in the direction (INCREASE or DECREASE),
        # so a strong negative score (e.g. very low occupancy) should still yield high confidence.
        confidence = min(95, 50 + abs(score) * 10)

        # 7. Advice text
        if direction == "INCREASE":
            advice = "We recommend booking now to secure the current price."
        elif direction == "DECREASE":
            advice = "Prices may drop — you could wait a few days before booking."
        else:
            advice = "Prices are expected to remain stable in the near term."


        logger.info(
            "FarePrediction | flight=%s cabin=%s direction=%s confidence=%s score=%s",
            flight_instance_id, cabin_class, direction, confidence, score
        )

        return {
            "flight_instance_id": flight_instance_id,
            "cabin_class": cabin_class,
            "direction": direction,
            "confidence": confidence,
            "current_price": current_price,
            "currency": currency,
            "occupancy_pct": round(occupancy_pct, 1),
            "days_until_departure": days_until_departure,
            "factors": factors,
            "advice": advice,
        }

        
        

    