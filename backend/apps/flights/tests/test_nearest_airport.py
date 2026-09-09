from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from apps.flights.models import Country, Airport


class NearestAirportAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.country = Country.objects.create(name="India", iso_code="IND")

        # Indira Gandhi International Airport (DEL)
        self.airport_del = Airport.objects.create(
            iata_code="DEL",
            airport_name="Indira Gandhi International Airport",
            city="New Delhi",
            country=self.country,
            latitude=Decimal("28.556160"),
            longitude=Decimal("77.100000"),
        )

        # Chhatrapati Shivaji Maharaj International Airport (BOM)
        self.airport_bom = Airport.objects.create(
            iata_code="BOM",
            airport_name="Chhatrapati Shivaji Maharaj International Airport",
            city="Mumbai",
            country=self.country,
            latitude=Decimal("19.089600"),
            longitude=Decimal("72.865600"),
        )

        # Kempegowda International Airport (BLR)
        self.airport_blr = Airport.objects.create(
            iata_code="BLR",
            airport_name="Kempegowda International Airport",
            city="Bengaluru",
            country=self.country,
            latitude=Decimal("13.197900"),
            longitude=Decimal("77.706300"),
        )

    def test_nearest_airport_delhi_coordinates(self):
        """Passing coordinates in central Delhi should resolve to DEL airport."""
        # Connaught Place, New Delhi (~28.6315, 77.2167)
        response = self.client.get("/api/flights/v2/airports/nearest/?lat=28.6315&lng=77.2167")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Note: If standardized renderer envelopes data, response.data has 'iata_code' directly in test client
        data = response.data
        if "data" in data and isinstance(data["data"], dict):
            data = data["data"]
        self.assertEqual(data["iata_code"], "DEL")
        self.assertEqual(data["city"], "New Delhi")
        self.assertIn("distance_km", data)
        self.assertLess(data["distance_km"], 30.0)

    def test_nearest_airport_mumbai_coordinates(self):
        """Passing coordinates in Mumbai should resolve to BOM airport."""
        # Bandra, Mumbai (~19.0596, 72.8295)
        response = self.client.get("/api/flights/v2/airports/nearest/?lat=19.0596&lng=72.8295")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        if "data" in data and isinstance(data["data"], dict):
            data = data["data"]
        self.assertEqual(data["iata_code"], "BOM")
        self.assertEqual(data["city"], "Mumbai")
        self.assertLess(data["distance_km"], 20.0)

    def test_nearest_airport_unauthenticated_access(self):
        """Nearest airport endpoint should be accessible without authentication."""
        response = self.client.get("/api/flights/v2/airports/nearest/?lat=13.0000&lng=77.5000")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        if "data" in data and isinstance(data["data"], dict):
            data = data["data"]
        self.assertEqual(data["iata_code"], "BLR")

    def test_missing_coordinates(self):
        """Missing lat or lng parameter should return 400 Bad Request."""
        res1 = self.client.get("/api/flights/v2/airports/nearest/?lat=28.6315")
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        res2 = self.client.get("/api/flights/v2/airports/nearest/?lng=77.2167")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_coordinates(self):
        """Non-numeric or out-of-range coordinates should return 400 Bad Request."""
        res_invalid = self.client.get("/api/flights/v2/airports/nearest/?lat=abc&lng=77.2167")
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)

        res_out_of_bounds = self.client.get("/api/flights/v2/airports/nearest/?lat=95.0&lng=77.2167")
        self.assertEqual(res_out_of_bounds.status_code, status.HTTP_400_BAD_REQUEST)
