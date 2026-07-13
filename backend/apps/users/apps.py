from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.users'

    def ready(self):
        # register signal handlers (auto-create Profile on User creation)
        try:
            from . import signals  # noqa: F401
        except Exception:
            pass
