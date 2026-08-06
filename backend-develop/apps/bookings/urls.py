from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookingViewSet, PassengerViewSet, AdminBookingViewSet

# User-facing booking router
router = DefaultRouter()
router.register(r'', BookingViewSet, basename='booking')

# Admin-only booking router
admin_router = DefaultRouter()
admin_router.register(r'bookings', AdminBookingViewSet, basename='admin-booking')

app_name = 'bookings'

urlpatterns = [
    path('passengers/', PassengerViewSet.as_view({'get': 'list'}), name='passenger-list'),
    path('passengers/<int:pk>/', PassengerViewSet.as_view({'get': 'retrieve'}), name='passenger-detail'),
    path('', include(router.urls)),
    # Admin-only routes: /api/admin/bookings/
    path('admin/', include(admin_router.urls)),
]