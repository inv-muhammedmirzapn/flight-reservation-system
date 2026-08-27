from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.pricing.views import (
    DynamicPricingConfigViewSet,
    HolidayEventViewSet,
    DynamicPriceLogViewSet,
)

app_name = "apps/pricing"

router = DefaultRouter()
router.register(r"dynamic-pricing-config", DynamicPricingConfigViewSet, basename="dynamic-pricing-config")
router.register(r"holiday-events", HolidayEventViewSet, basename="holiday-event")
router.register(r"dynamic-price-logs", DynamicPriceLogViewSet, basename="dynamic-price-log")

urlpatterns = [
    path("", include(router.urls)),
]