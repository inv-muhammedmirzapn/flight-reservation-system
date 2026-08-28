"""
Backward-compatibility wrapper for currency service.
All core currency services have been migrated to `apps.pricing.services_currency`.
"""
from apps.pricing.services_currency import (
    COUNTRY_CURRENCY_MAP,
    USD_RATES,
    CurrencyService,
)

__all__ = [
    "COUNTRY_CURRENCY_MAP",
    "USD_RATES",
    "CurrencyService",
]
