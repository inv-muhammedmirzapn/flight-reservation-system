import datetime
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.flights.models import (
    Airline, FlightRoute, FlightInstance, Fare, AircraftModel, Aircraft, Seat
)
from apps.bookings.services import create_booking
from apps.bookings.ticket_pdf import generate_booking_pdf

User = get_user_model()

class PDFGenerationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="pdfpax@example.com", email="pdfpax@example.com", password="Password123!")
        
        self.airline = Airline.objects.create(airline_name="Test Airline", iata_airline_code="TA")
        self.ac_model = AircraftModel.objects.create(manufacturer="Boeing", model_name="737")
        self.aircraft = Aircraft.objects.create(registration="N12345", airline=self.airline, aircraft_model=self.ac_model, economy_capacity=150)
        self.route = FlightRoute.objects.create(
            airline=self.airline,
            flight_no="TA100",
            baggage_weight_allowed_per_person=Decimal("20.00"),
            handbag_weight_allowed_per_person=Decimal("7.00"),
            max_extra_baggage_kg_per_person=Decimal("15.00"),
            extra_baggage_price_per_kg=Decimal("10.00"),
            extra_baggage_currency="USD",
        )
        self.instance = FlightInstance.objects.create(
            flight=self.route,
            date=datetime.date(2026, 12, 1),
            aircraft=self.aircraft,
            scheduled_departure="2026-12-01T10:00:00Z",
            scheduled_arrival="2026-12-01T12:00:00Z",
        )
        Seat.objects.create(flight_instance=self.instance, seat_number="1A", seat_class="ECONOMY", status="AVAILABLE")

        self.fare = Fare.objects.create(
            flight_instance=self.instance,
            fare_code="TA_ECO",
            cabin_class="ECONOMY",
            price=Decimal("100.00"),
            currency="USD",
            meal_included=False,
            baggage_allowance=Decimal("20.00"),
        )
        
        passengers_data = [
            {"name": "Alice PDF", "age": 28, "gender": "F"},
        ]
        self.booking = create_booking(
            flight_id=self.instance.id,
            user=self.user,
            passengers_data=passengers_data,
            cabin_class="ECONOMY"
        )
        # Booking starts as PENDING until paid, but pdf is for confirmed
        self.booking.status = "CONFIRMED"
        self.booking.save()

    def test_generate_booking_pdf_function(self):
        """Test that the PDF generation function returns valid bytes."""
        pdf_bytes = generate_booking_pdf(self.booking)
        self.assertIsInstance(pdf_bytes, bytes)
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))

    def test_download_pdf_endpoint_success(self):
        """Test downloading PDF for a confirmed booking."""
        self.client.force_authenticate(user=self.user)
        url = f"/api/bookings/{self.booking.id}/download-pdf/"
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response.content.startswith(b"%PDF-"))
        self.assertIn("attachment", response['Content-Disposition'])

    def test_download_pdf_endpoint_unauthorized_user(self):
        """Test that another user cannot download the PDF."""
        other_user = User.objects.create_user(username="other@example.com", password="Password123!")
        self.client.force_authenticate(user=other_user)
        
        url = f"/api/bookings/{self.booking.id}/download-pdf/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_download_pdf_endpoint_unconfirmed_booking(self):
        """Test that PDF is not generated for unconfirmed bookings."""
        self.booking.status = "PENDING"
        self.booking.save()
        
        self.client.force_authenticate(user=self.user)
        url = f"/api/bookings/{self.booking.id}/download-pdf/"
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("only available for confirmed", str(response.content))
