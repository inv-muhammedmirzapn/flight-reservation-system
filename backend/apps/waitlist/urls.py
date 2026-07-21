from django.urls import path
from .views import (
    WaitlistJoinView,
    WaitlistListView,
    WaitlistDetailView,
    WaitlistCancelView,
    WaitlistFlightCountView,
)

urlpatterns = [
    path("join/", WaitlistJoinView.as_view(), name="waitlist-join"),
    path("", WaitlistListView.as_view(), name="waitlist-list"),
    path("<uuid:pk>/", WaitlistDetailView.as_view(), name="waitlist-detail"),
    path("<uuid:pk>/cancel/", WaitlistCancelView.as_view(), name="waitlist-cancel"),
    path(
        "flight/<uuid:flight_id>/",
        WaitlistFlightCountView.as_view(),
        name="waitlist-flight-count",
    ),
]