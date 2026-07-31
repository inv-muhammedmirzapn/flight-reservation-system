from rest_framework import generics
from rest_framework.permissions import AllowAny
from django.contrib.auth.models import User
from .serializers import RegisterSerializer, ProfileSerializer, CustomTokenObtainPairSerializer, ChangePasswordSerializer, ForgotPasswordSerializer, ResetPasswordSerializer, RequestEmailOTPSerializer, VerifyEmailOTPSerializer
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings
from django.core.cache import cache
import random
import threading
from .models import Profile
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
import os
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as rf_serializers

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer


class ProfileAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom token view that ensures a Profile exists for authenticated user."""
    serializer_class = CustomTokenObtainPairSerializer

class GoogleLoginView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        request=inline_serializer(
            name='GoogleLoginRequest',
            fields={'token': rf_serializers.CharField()}
        ),
        responses={200: inline_serializer('GoogleLoginResponse', {
            'refresh': rf_serializers.CharField(),
            'access': rf_serializers.CharField(),
            'id': rf_serializers.IntegerField(),
            'username': rf_serializers.CharField(),
            'email': rf_serializers.CharField(),
            'role': rf_serializers.CharField(),
            'is_superuser': rf_serializers.BooleanField(),
        })}
    )
    def post(self, request, *args, **kwargs):
        token = request.data.get('token')
        if not token:
            return Response({"error": "No token provided"}, status=status.HTTP_400_BAD_REQUEST)

        import requests
        try:
            # The frontend's useGoogleLogin provides an access token.
            # We can verify and fetch user info by calling the Google userinfo endpoint.
            response = requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {token}'}
            )
            if not response.ok:
                return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)
            idinfo = response.json()

            email = idinfo['email']
            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')

            # Find or create user
            # Handle cases where multiple users might have the same email
            user = User.objects.filter(email=email).first()
            
            if not user:
                # Create new user if they don't exist
                user = User.objects.create(
                    username=email,
                    email=email,
                    first_name=first_name,
                    last_name=last_name
                )
                user.set_unusable_password()
                user.save()
                
            # Create profile if not exists
            Profile.objects.get_or_create(user=user)

            # Generate tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.profile.role,
                'is_superuser': user.is_superuser
            }, status=status.HTTP_200_OK)

        except Exception as e:
            # Catch general exceptions like request failures
            print("Google Login Error:", str(e))
            return Response({"error": "Invalid token or request failed"}, status=status.HTTP_400_BAD_REQUEST)

class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=ChangePasswordSerializer, responses={200: inline_serializer('ChangePasswordResponse', {'detail': rf_serializers.CharField()})})
    def post(self, request, *args, **kwargs):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            old_password = serializer.validated_data.get('old_password')
            new_password = serializer.validated_data.get('new_password')
            
            if not user.check_password(old_password):
                return Response({"old_password": ["Wrong password."]}, status=status.HTTP_400_BAD_REQUEST)
                
            user.set_password(new_password)
            user.save()
            return Response({"detail": "Password has been successfully updated."}, status=status.HTTP_200_OK)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ForgotPasswordView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_request'

    @extend_schema(request=ForgotPasswordSerializer, responses={200: inline_serializer('ForgotPasswordResponse', {'detail': rf_serializers.CharField()})})
    def post(self, request, *args, **kwargs):
        serializer = ForgotPasswordSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = User.objects.filter(email=email).first()
            if user:
                # Generate 6-digit OTP
                otp = str(random.randint(100000, 999999))
                
                # Store in cache for 5 minutes (300 seconds)
                cache_key = f"pwd_reset_otp_{email}"
                cache.set(cache_key, otp, timeout=300)

                # Define email sending function
                def send_otp_email(target_email, otp_code):
                    try:
                        from apps.notifications.email_templates import password_reset_otp
                        from django.core.mail import EmailMultiAlternatives
                        import re
                        subject, html = password_reset_otp(otp_code)
                        plain_text = re.sub(r'<[^>]+>', ' ', html)
                        plain_text = re.sub(r'\s+', ' ', plain_text).strip()
                        msg = EmailMultiAlternatives(
                            subject=subject,
                            body=plain_text,
                            from_email=settings.EMAIL_HOST_USER,
                            to=[target_email],
                        )
                        msg.attach_alternative(html, "text/html")
                        msg.send(fail_silently=False)
                    except Exception as e:
                        print(f"Error sending password reset email: {e}")

                # Send email in a background thread
                threading.Thread(target=send_otp_email, args=(email, otp)).start()
            
            # Always return 200 OK so we don't leak whether an email exists or not
            return Response({"detail": "If an account with that email exists, we have sent a password reset OTP."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_verify'

    @extend_schema(request=ResetPasswordSerializer, responses={200: inline_serializer('ResetPasswordResponse', {'detail': rf_serializers.CharField()})})
    def post(self, request, *args, **kwargs):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            otp = serializer.validated_data['otp']
            new_password = serializer.validated_data['new_password']

            cache_key = f"pwd_reset_otp_{email}"
            cached_otp = cache.get(cache_key)

            if cached_otp and cached_otp == otp:
                user = User.objects.filter(email=email).first()
                if user:
                    user.set_password(new_password)
                    user.save()
                    cache.delete(cache_key)
                    return Response({"detail": "Password has been reset successfully."}, status=status.HTTP_200_OK)
            
            return Response({"error": "The OTP is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
class RequestEmailOTPView(APIView):
    """Send a 6-digit OTP to the user's *new* email address to verify ownership."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_request'

    @extend_schema(
        request=inline_serializer('RequestEmailOTPRequest', {'new_email': rf_serializers.EmailField()}),
        responses={200: inline_serializer('RequestEmailOTPResponse', {'detail': rf_serializers.CharField()})}
    )
    def post(self, request, *args, **kwargs):
        serializer = RequestEmailOTPSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_email = serializer.validated_data['new_email']
        otp = str(random.randint(100000, 999999))
        cache_key = f"email_otp_{request.user.id}_{new_email}"
        cache.set(cache_key, otp, timeout=300)

        def send_otp_email(target_email, otp_code):
            try:
                from apps.notifications.email_templates import email_change_otp
                from django.core.mail import EmailMultiAlternatives
                import re
                subject, html = email_change_otp(otp_code, target_email)
                plain_text = re.sub(r'<[^>]+>', ' ', html)
                plain_text = re.sub(r'\s+', ' ', plain_text).strip()
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=plain_text,
                    from_email=settings.EMAIL_HOST_USER,
                    to=[target_email],
                )
                msg.attach_alternative(html, "text/html")
                msg.send(fail_silently=False)
            except Exception as e:
                print(f"Error sending email change OTP: {e}")

        threading.Thread(target=send_otp_email, args=(new_email, otp)).start()
        return Response({"detail": "OTP sent to the new email address."}, status=status.HTTP_200_OK)


class VerifyEmailOTPView(APIView):
    """Verify the OTP and update the user's email address."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_verify'

    @extend_schema(
        request=inline_serializer('VerifyEmailOTPRequest', {
            'new_email': rf_serializers.EmailField(),
            'otp': rf_serializers.CharField()
        }),
        responses={200: inline_serializer('VerifyEmailOTPResponse', {
            'detail': rf_serializers.CharField(),
            'email': rf_serializers.EmailField()
        })}
    )
    def post(self, request, *args, **kwargs):
        serializer = VerifyEmailOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_email = serializer.validated_data['new_email']
        otp = serializer.validated_data['otp']
        cache_key = f"email_otp_{request.user.id}_{new_email}"
        cached_otp = cache.get(cache_key)

        if cached_otp and cached_otp == otp:
            user = request.user
            user.email = new_email
            user.save()
            cache.delete(cache_key)
            return Response(
                {"detail": "Email updated successfully.", "email": new_email},
                status=status.HTTP_200_OK
            )

        return Response(
            {"error": "The OTP is invalid or has expired."},
            status=status.HTTP_400_BAD_REQUEST
        )
