import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from rest_framework_simplejwt.authentication import JWTAuthentication
import inspect
print(inspect.getsource(JWTAuthentication.get_user))
