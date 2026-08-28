from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme


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
            except (InvalidToken, TokenError) as exc:
                # Cookie token is invalid/expired — check if standard header token is provided
                header_auth = super().authenticate(request)
                if header_auth is not None:
                    return header_auth
                # No valid header token provided — raise the exception so DRF returns 401,
                # triggering frontend silent token refresh (fetchWithAuth).
                raise exc

        # Fallback: standard Authorization: Bearer <token> header
        return super().authenticate(request)


class CookieJWTScheme(SimpleJWTScheme):
    target_class = CookieJWTAuthentication
    name = 'cookieAuth'


