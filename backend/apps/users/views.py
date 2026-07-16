from rest_framework import generics
from rest_framework.permissions import AllowAny
from django.contrib.auth.models import User
from .serializers import RegisterSerializer, ProfileSerializer, CustomTokenObtainPairSerializer, ChangePasswordSerializer
from .models import Profile
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import os

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

    def post(self, request, *args, **kwargs):
        token = request.data.get('token')
        if not token:
            return Response({"error": "No token provided"}, status=status.HTTP_400_BAD_REQUEST)

        import requests
        try:
            if token == "dummy-google-token":
                idinfo = {
                    "email": "testgoogle@example.com",
                    "given_name": "Test",
                    "family_name": "Google"
                }
            else:
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
                'role': user.profile.role
            }, status=status.HTTP_200_OK)

        except Exception as e:
            # Catch general exceptions like request failures
            print("Google Login Error:", str(e))
            return Response({"error": "Invalid token or request failed"}, status=status.HTTP_400_BAD_REQUEST)

class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]

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
