"""
Backward-compatibility wrapper for pricing services.
All core dynamic pricing services have been migrated to `apps.pricing.services`.
"""
from apps.pricing.services import (
    PricingStrategy,
    FlatPricingStrategy,
    DynamicPricingStrategy,
    generate_fares_for_instance,
    update_route_fare_price,
    reevaluate_route_fares_dynamically,
)

__all__ = [
    "PricingStrategy",
    "FlatPricingStrategy",
    "DynamicPricingStrategy",
    "generate_fares_for_instance",
    "update_route_fare_price",
    "reevaluate_route_fares_dynamically",
]
