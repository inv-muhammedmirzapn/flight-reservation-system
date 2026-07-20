from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WaitlistViewSet

router = DefaultRouter()
router.register(r'', WaitlistViewSet, basename='waitlist')

app_name = 'waitlist'

urlpatterns = [
    path('', include(router.urls)),
]