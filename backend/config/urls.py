from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse


def hello_world(request):
    return HttpResponse("Hello World from Flight Reservation System API")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/hello/", hello_world),

    # Users API
    path("api/v1/users/", include("users.urls")),
]