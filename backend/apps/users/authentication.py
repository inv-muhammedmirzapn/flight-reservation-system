from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class CookieJWTAuthentication(JWTAuthentication):
    """
    Custom DRF authentication class that reads the JWT access token from an
    HttpOnly cookie named 'access_token'.

    Falls back to the standard 'Authorization: Bearer <token>' header so that
    Swagger UI and programmatic API clients continue to work unchanged.
    """

    def authenticate(self, request):
        raw_token = request.COOKIES.get('access_token')

        if raw_token is not None:
            try:
                validated_token = self.get_validated_token(raw_token)
                return self.get_user(validated_token), validated_token
            except (InvalidToken, TokenError):
                # Cookie token is invalid/expired — fall through to header
                pass

        # Fallback: standard Authorization: Bearer <token> header
        return super().authenticate(request)
