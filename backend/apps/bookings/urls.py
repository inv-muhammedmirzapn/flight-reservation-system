from django.urls import path, include
from rest_framework.routers import DefaultRouter, SimpleRouter
from .views import BookingViewSet, PassengerViewSet, AdminBookingViewSet, SeatHoldViewSet

# User-facing booking router
router = DefaultRouter()
router.register(r'', BookingViewSet, basename='booking')

# Seat holds router — SimpleRouter avoids the ^$ root view collision with the main router
holds_router = SimpleRouter()
holds_router.register(r'holds', SeatHoldViewSet, basename='seat-hold')

# Admin-only booking router
admin_router = DefaultRouter()
admin_router.register(r'bookings', AdminBookingViewSet, basename='admin-booking')

app_name = 'bookings'

urlpatterns = [
    path('passengers/', PassengerViewSet.as_view({'get': 'list'}), name='passenger-list'),
    path('passengers/<int:pk>/', PassengerViewSet.as_view({'get': 'retrieve'}), name='passenger-detail'),
    path('', include(holds_router.urls)),
    path('', include(router.urls)),
    # Admin-only routes: /api/bookings/admin/bookings/
    path('admin/', include(admin_router.urls)),
]