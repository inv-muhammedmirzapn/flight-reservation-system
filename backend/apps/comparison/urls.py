from django.urls import path
from .views import FlightCompareView

urlpatterns = [
    path('compare/', FlightCompareView.as_view(), name='flight-compare'),
]
