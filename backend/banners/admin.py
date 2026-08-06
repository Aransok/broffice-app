from django.contrib import admin

from .models import Banner


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    # Read-only / system-generated — sync_banners() owns create/update/delete,
    # this registration exists only so admin can see current state at a glance.
    list_display = ("promotion", "banner_type", "image_path", "updated_at")
    list_filter = ("banner_type",)
    readonly_fields = (
        "promotion",
        "banner_type",
        "image_path",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False
