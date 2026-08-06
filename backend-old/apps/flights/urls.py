from django.urls import path
from .views import FlightListCreateView, FlightDetailView, FlightUpdateView, FlightBulkImportView, FlightStatsView

app_name = "apps/flights"

urlpatterns = [
    path("", FlightListCreateView.as_view(), name="flight-list-create"),
    path("stats/", FlightStatsView.as_view(), name="flight-stats"),
    path("bulk-import/", FlightBulkImportView.as_view(), name="flight-bulk-import"),
    path("<uuid:id>/", FlightDetailView.as_view(), name="flight-detail"),
    path("<uuid:id>/update/", FlightUpdateView.as_view(), name="flight-update"),
]