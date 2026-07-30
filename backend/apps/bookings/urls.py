from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookingViewSet, PassengerViewSet

router = DefaultRouter()
router.register(r'', BookingViewSet, basename='booking')

app_name = 'bookings'

urlpatterns = [
    path('passengers/', PassengerViewSet.as_view({'get': 'list'}), name='passenger-list'),
    path('passengers/<int:pk>/', PassengerViewSet.as_view({'get': 'retrieve'}), name='passenger-detail'),
    path('', include(router.urls)),
]