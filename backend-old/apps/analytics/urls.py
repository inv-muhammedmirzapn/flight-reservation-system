from django.urls import path
from .views import (
    AnalyticsSummaryView,
    MonthlyRevenueView,
    PopularRoutesView,
    FlightOccupancyView,
    PeakBookingHoursView,
)

app_name = "analytics"

urlpatterns = [
    path("summary/", AnalyticsSummaryView.as_view(), name="analytics-summary"),
    path("monthly-revenue/", MonthlyRevenueView.as_view(), name="analytics-monthly-revenue"),
    path("popular-routes/", PopularRoutesView.as_view(), name="analytics-popular-routes"),
    path("flight-occupancy/", FlightOccupancyView.as_view(), name="analytics-flight-occupancy"),
    path("peak-booking-hours/", PeakBookingHoursView.as_view(), name="analytics-peak-booking-hours"),
]