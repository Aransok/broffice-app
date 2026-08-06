from django.apps import AppConfig


class BannersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "banners"

    def ready(self) -> None:
        from . import signals  # noqa: F401
