from django.urls import path
from flights.views import FlightCreateView, FlightUpdateView

app_name = "flights"

urlpatterns = [
    path("", FlightCreateView.as_view(), name="flight-create"),
    path("<uuid:id>/", FlightUpdateView.as_view(), name="flight-update"),
]