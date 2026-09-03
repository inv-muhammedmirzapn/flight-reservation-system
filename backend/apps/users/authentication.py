from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.exceptions import AuthenticationFailed
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
            except (InvalidToken, TokenError, AuthenticationFailed):
                # Cookie token is invalid/expired, OR the user was deleted from the database
                # check if standard header token is provided
                header_auth = super().authenticate(request)
                if header_auth is not None:
                    return header_auth
                # No valid header token provided — return None to fall back to AnonymousUser.
                # If the view requires authentication, DRF will reject it with a 401 later.
                return None

        # Fallback: standard Authorization: Bearer <token> header
        return super().authenticate(request)


class CookieJWTScheme(SimpleJWTScheme):
    target_class = CookieJWTAuthentication
    name = 'cookieAuth'


