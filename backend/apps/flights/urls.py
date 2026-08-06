from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FlightListCreateView, FlightDetailView,
    CountryViewSet, AirportViewSet, AirlineViewSet,
    AircraftModelViewSet, AircraftViewSet,
    FlightRouteViewSet, FlightInstanceViewSet,
    SeatViewSet, FareViewSet,
    FoodItemViewSet, FlightMealViewSet,
    SeatPriceTemplateViewSet,
)
from .views_calendar import FlightFaresCalendarView, FlightFareBoundsView
from .views_meals import FlightMealsView

app_name = "apps/flights"

# ─── New entity router ──────────────────────────────────────────────────────────
router = DefaultRouter()
router.register(r"v2/countries", CountryViewSet, basename="country")
router.register(r"v2/airports", AirportViewSet, basename="airport")
router.register(r"v2/airlines", AirlineViewSet, basename="airline")
router.register(r"v2/aircraft-models", AircraftModelViewSet, basename="aircraft-model")
router.register(r"v2/aircraft", AircraftViewSet, basename="aircraft")
router.register(r"v2/flight-routes", FlightRouteViewSet, basename="flight-route")
router.register(r"v2/flight-instances", FlightInstanceViewSet, basename="flight-instance")
router.register(r"v2/seats", SeatViewSet, basename="seat")
router.register(r"v2/fares", FareViewSet, basename="fare")
router.register(r"v2/food-items", FoodItemViewSet, basename="food-item")
router.register(r"v2/flight-meals", FlightMealViewSet, basename="flight-meal")
router.register(r"v2/seat-price-templates", SeatPriceTemplateViewSet, basename="seat-price-template")

urlpatterns = [
    # ── Legacy endpoints (unchanged) ─────────────────────────────────────────
    path("", FlightListCreateView.as_view(), name="flight-list-create"),
    path("calendar/", FlightFaresCalendarView.as_view(), name="flight-calendar"),
    path("bounds/", FlightFareBoundsView.as_view(), name="flight-bounds"),
    path("<int:instance_id>/meals/", FlightMealsView.as_view(), name="flight-meals"),
    path("<int:id>/", FlightDetailView.as_view(), name="flight-detail"),


    # ── New entity endpoints ─────────────────────────────────────────────────
    path("", include(router.urls)),
]