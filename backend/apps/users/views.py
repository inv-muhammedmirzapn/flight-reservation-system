from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as rf_serializers
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from django.contrib.auth.models import User
from django.conf import settings

from .serializers import (
    RegisterSerializer,
    ProfileSerializer,
    CustomTokenObtainPairSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    RequestEmailOTPSerializer,
    VerifyEmailOTPSerializer,
    LogoutSerializer,
)
from .models import Profile
from .services import (
    GoogleAuthError,
    google_login,
    send_password_reset_otp,
    reset_password,
    change_password,
    send_email_change_otp,
    verify_email_change_otp,
)
from .throttling import LoginRateThrottle


# ---------------------------------------------------------------------------
# Registration / Profile
# ---------------------------------------------------------------------------

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer




class ProfileAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom token view that sets JWT tokens as HttpOnly cookies instead of
    returning them in the response body. Only profile data is returned in JSON."""
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            data = response.data
            access = data.pop('access', None)
            refresh = data.pop('refresh', None)
            secure = getattr(settings, 'JWT_COOKIE_SECURE', False)
            samesite = getattr(settings, 'JWT_COOKIE_SAMESITE', 'Lax')
            if access:
                response.set_cookie(
                    'access_token', access,
                    max_age=60 * 10,          # 10 minutes — matches ACCESS_TOKEN_LIFETIME
                    httponly=True,
                    samesite=samesite,
                    secure=secure,
                    path='/',
                )
            if refresh:
                response.set_cookie(
                    'refresh_token', refresh,
                    max_age=60 * 60 * 24,     # 1 day — matches REFRESH_TOKEN_LIFETIME
                    httponly=True,
                    samesite=samesite,
                    secure=secure,
                    path='/',
                )
        return response
    

class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        request=None,
        responses={200: inline_serializer("LogoutResponse", {"detail": rf_serializers.CharField()})}
    )
    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get('refresh_token')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass  # already invalid / blacklisted — still clear cookies
        response = Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        response.delete_cookie('access_token', path='/')
        response.delete_cookie('refresh_token', path='/')
        return response

# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------

class GoogleLoginView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = [LoginRateThrottle]

    @extend_schema(
        request=inline_serializer(
            name="GoogleLoginRequest",
            fields={"token": rf_serializers.CharField()},
        ),
        responses={
            200: inline_serializer(
                "GoogleLoginResponse",
                {
                    "id": rf_serializers.IntegerField(),
                    "username": rf_serializers.CharField(),
                    "email": rf_serializers.CharField(),
                    "role": rf_serializers.CharField(),
                    "is_superuser": rf_serializers.BooleanField(),
                },
            )
        },
    )
    def post(self, request, *args, **kwargs):
        token = request.data.get("token")
        if not token:
            return Response(
                {"error": "No token provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            data = google_login(token)
        except GoogleAuthError:
            raise AuthenticationFailed("Google login failed or token is invalid.")

        # Move tokens into HttpOnly cookies
        secure = getattr(settings, 'JWT_COOKIE_SECURE', False)
        samesite = getattr(settings, 'JWT_COOKIE_SAMESITE', 'Lax')
        access = data.pop('access', None)
        refresh = data.pop('refresh', None)

        response = Response(data, status=status.HTTP_200_OK)
        if access:
            response.set_cookie(
                'access_token', access,
                max_age=60 * 10,
                httponly=True, samesite=samesite, secure=secure, path='/',
            )
        if refresh:
            response.set_cookie(
                'refresh_token', refresh,
                max_age=60 * 60 * 24,
                httponly=True, samesite=samesite, secure=secure, path='/',
            )
        return response


# ---------------------------------------------------------------------------
# Cookie-based Token Refresh
# ---------------------------------------------------------------------------

class CookieTokenRefreshView(APIView):
    """
    Replaces the default TokenRefreshView. Reads the refresh token from the
    HttpOnly 'refresh_token' cookie, issues a new access token (and rotated
    refresh token if ROTATE_REFRESH_TOKENS=True), and sets them as HttpOnly
    cookies. Returns no sensitive data in the response body.
    """
    permission_classes = (AllowAny,)

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get('refresh_token')
        if not refresh_token:
            return Response(
                {'detail': 'Refresh token not found. Please log in again.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            token = RefreshToken(refresh_token)
            new_access = str(token.access_token)
            rotate = getattr(settings, 'SIMPLE_JWT', {}).get('ROTATE_REFRESH_TOKENS', False)
            new_refresh = str(token) if rotate else refresh_token

            secure = getattr(settings, 'JWT_COOKIE_SECURE', False)
            samesite = getattr(settings, 'JWT_COOKIE_SAMESITE', 'Lax')

            response = Response({'detail': 'Token refreshed successfully.'})
            response.set_cookie(
                'access_token', new_access,
                max_age=60 * 10,
                httponly=True, samesite=samesite, secure=secure, path='/',
            )
            response.set_cookie(
                'refresh_token', new_refresh,
                max_age=60 * 60 * 24,
                httponly=True, samesite=samesite, secure=secure, path='/',
            )
            return response
        except Exception:
            return Response(
                {'detail': 'Token is invalid or expired. Please log in again.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )


# ---------------------------------------------------------------------------
# Password management
# ---------------------------------------------------------------------------

class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [LoginRateThrottle]

    @extend_schema(
        request=ChangePasswordSerializer,
        responses={
            200: inline_serializer(
                "ChangePasswordResponse", {"detail": rf_serializers.CharField()}
            )
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        ok = change_password(
            user=request.user,
            old_password=serializer.validated_data.get("old_password", ""),
            new_password=serializer.validated_data["new_password"],
        )
        if not ok:
            raise AuthenticationFailed("Invalid credentials.")
        return Response(
            {"detail": "Password has been successfully updated."},
            status=status.HTTP_200_OK,
        )


class ForgotPasswordView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = [LoginRateThrottle]

    @extend_schema(
        request=ForgotPasswordSerializer,
        responses={
            200: inline_serializer(
                "ForgotPasswordResponse", {"detail": rf_serializers.CharField()}
            )
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Service is safe to call even if the e-mail doesn't exist —
        # it silently does nothing, so no user enumeration.
        send_password_reset_otp(serializer.validated_data["email"])

        return Response(
            {
                "detail": (
                    "If an account with that email exists, "
                    "we have sent a password reset OTP."
                )   
            },
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = [LoginRateThrottle]

    @extend_schema(
        request=ResetPasswordSerializer,
        responses={
            200: inline_serializer(
                "ResetPasswordResponse", {"detail": rf_serializers.CharField()}
            )
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ok = reset_password(
            email=serializer.validated_data["email"],
            otp=serializer.validated_data["otp"],
            new_password=serializer.validated_data["new_password"],
        )
        if not ok:
            raise ValidationError({"detail": "The OTP is invalid or has expired."})
        return Response(
            {"detail": "Password has been reset successfully."},
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# E-mail change OTP flow
# ---------------------------------------------------------------------------

class RequestEmailOTPView(APIView):
    """Send a 6-digit OTP to the user's *new* email address to verify ownership."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer(
            "RequestEmailOTPRequest", {"new_email": rf_serializers.EmailField()}
        ),
        responses={
            200: inline_serializer(
                "RequestEmailOTPResponse", {"detail": rf_serializers.CharField()}
            )
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = RequestEmailOTPSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        send_email_change_otp(request.user, serializer.validated_data["new_email"])
        return Response(
            {"detail": "If the email is valid and available, an OTP has been sent."}, status=status.HTTP_200_OK
        )


class VerifyEmailOTPView(APIView):
    """Verify the OTP and update the user's email address."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer(
            "VerifyEmailOTPRequest",
            {
                "new_email": rf_serializers.EmailField(),
                "otp": rf_serializers.CharField(),
            },
        ),
        responses={
            200: inline_serializer(
                "VerifyEmailOTPResponse",
                {
                    "detail": rf_serializers.CharField(),
                    "email": rf_serializers.EmailField(),
                },
            )
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = VerifyEmailOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_email = serializer.validated_data["new_email"]
        ok = verify_email_change_otp(
            user=request.user,
            new_email=new_email,
            otp=serializer.validated_data["otp"],
        )
        if not ok:
            raise ValidationError({"detail": "The OTP is invalid or has expired."})
        return Response(
            {"detail": "Email updated successfully.", "email": new_email},
            status=status.HTTP_200_OK,
        )
