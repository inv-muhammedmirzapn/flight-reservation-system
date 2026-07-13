from django.contrib import admin
from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "role",
        "phone_number",
        "country",
        "state",
        "city",
    )

    list_filter = (
        "role",
        "country",
        "state",
    )

    search_fields = (
        "user__username",
        "user__email",
        "phone_number",
    )

    ordering = ("id",)