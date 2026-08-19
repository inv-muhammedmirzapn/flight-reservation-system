from django.urls import path
from .views import CustomTokenObtainPairView, CookieTokenRefreshView
from .views import (
    RegisterView, ProfileAPIView, GoogleLoginView,
    ChangePasswordAPIView, ForgotPasswordView, ResetPasswordView,
    RequestEmailOTPView, VerifyEmailOTPView, LogoutView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('google-login/', GoogleLoginView.as_view(), name='google_login'),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path("profile/", ProfileAPIView.as_view(), name="profile"),
    path("change-password/", ChangePasswordAPIView.as_view(), name="change_password"),
    path("password/forgot/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("password/reset/", ResetPasswordView.as_view(), name="reset_password"),
    path("email/request-otp/", RequestEmailOTPView.as_view(), name="request_email_otp"),
    path("email/verify-otp/", VerifyEmailOTPView.as_view(), name="verify_email_otp"),
]