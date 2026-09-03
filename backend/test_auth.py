import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.users.authentication import CookieJWTAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.test import APIRequestFactory

factory = APIRequestFactory()
request = factory.post('/api/auth/register/')
request.COOKIES['access_token'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid_signature'

try:
    auth1 = CookieJWTAuthentication()
    res1 = auth1.authenticate(request)
    print("Cookie auth Result:", res1)
    
    auth2 = JWTAuthentication()
    res2 = auth2.authenticate(request)
    print("JWT auth Result:", res2)
except Exception as e:
    print("Exception:", type(e), e)
