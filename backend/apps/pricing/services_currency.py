from decimal import Decimal, ROUND_HALF_UP

COUNTRY_CURRENCY_MAP = {
    # India
    "INDIA": "INR",
    "IND": "INR",
    "IN": "INR",
    # United States
    "UNITED STATES": "USD",
    "UNITED STATES OF AMERICA": "USD",
    "USA": "USD",
    "US": "USD",
    # United Kingdom
    "UNITED KINGDOM": "GBP",
    "UK": "GBP",
    "GREAT BRITAIN": "GBP",
    "ENGLAND": "GBP",
    "GB": "GBP",
    # Eurozone
    "GERMANY": "EUR",
    "DEUTSCHLAND": "EUR",
    "DE": "EUR",
    "FRANCE": "EUR",
    "FR": "EUR",
    "ITALY": "EUR",
    "IT": "EUR",
    "SPAIN": "EUR",
    "ES": "EUR",
    "NETHERLANDS": "EUR",
    "HOLLAND": "EUR",
    "NL": "EUR",
    "BELGIUM": "EUR",
    "BE": "EUR",
    "AUSTRIA": "EUR",
    "AT": "EUR",
    "IRELAND": "EUR",
    "IE": "EUR",
    "FINLAND": "EUR",
    "FI": "EUR",
    "PORTUGAL": "EUR",
    "PT": "EUR",
    "GREECE": "EUR",
    "GR": "EUR",
    # Middle East
    "UNITED ARAB EMIRATES": "AED",
    "UAE": "AED",
    "DUBAI": "AED",
    "ABU DHABI": "AED",
    "SAUDI ARABIA": "SAR",
    "KSA": "SAR",
    "QATAR": "QAR",
    "OMAN": "OMR",
    "BAHRAIN": "BHD",
    "KUWAIT": "KWD",
    # Americas & Oceania & Asia
    "CANADA": "CAD",
    "CA": "CAD",
    "AUSTRALIA": "AUD",
    "AUS": "AUD",
    "AU": "AUD",
    "SINGAPORE": "SGD",
    "SG": "SGD",
    "JAPAN": "JPY",
    "JP": "JPY",
    "SWITZERLAND": "CHF",
    "CH": "CHF",
    "NEW ZEALAND": "NZD",
    "NZ": "NZD",
    "CHINA": "CNY",
    "CN": "CNY",
}

# FX rates relative to USD (1 USD = rate in currency)
USD_RATES = {
    "USD": Decimal("1.0"),
    "INR": Decimal("83.50"),
    "EUR": Decimal("0.92"),
    "GBP": Decimal("0.78"),
    "AED": Decimal("3.67"),
    "SAR": Decimal("3.75"),
    "QAR": Decimal("3.64"),
    "CAD": Decimal("1.37"),
    "AUD": Decimal("1.52"),
    "SGD": Decimal("1.35"),
    "JPY": Decimal("155.00"),
    "CHF": Decimal("0.90"),
    "NZD": Decimal("1.65"),
    "CNY": Decimal("7.23"),
    "OMR": Decimal("0.38"),
    "BHD": Decimal("0.38"),
    "KWD": Decimal("0.31"),
}


class CurrencyService:
    @staticmethod
    def get_user_currency(user=None, request=None, default_currency="INR") -> str:
        """
        Determines target currency based on user profile country.
        Accepts either a User model instance or a HttpRequest instance.
        If user country is missing, blank, or unmapped, returns default_currency ('INR').
        """
        if user is None and request is not None:
            user = getattr(request, "user", None)

        if not user or not hasattr(user, "is_authenticated") or not user.is_authenticated:
            return default_currency

        profile = getattr(user, "profile", None)
        if not profile or not profile.country:
            return default_currency

        country_clean = str(profile.country).strip().upper()
        return COUNTRY_CURRENCY_MAP.get(country_clean, default_currency)

    @staticmethod
    def convert_amount(amount, from_currency: str, to_currency: str) -> Decimal:
        """
        Converts amount from from_currency to to_currency using USD exchange rate table.
        Returns rounded Decimal with 2 decimal places.
        """
        if amount is None:
            return Decimal("0.00")

        try:
            amt = Decimal(str(amount))
        except Exception:
            return Decimal("0.00")

        from_curr = (from_currency or "USD").strip().upper()
        to_curr = (to_currency or "USD").strip().upper()

        if from_curr == to_curr:
            return amt.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        from_rate = USD_RATES.get(from_curr, USD_RATES["USD"])
        to_rate = USD_RATES.get(to_curr, USD_RATES["USD"])

        # Convert to USD first, then to target currency
        usd_amount = amt / from_rate
        converted = usd_amount * to_rate

        return converted.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
