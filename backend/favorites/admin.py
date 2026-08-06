from django.contrib import admin

from .models import Favorite


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("user", "product", "created_at")
    search_fields = ("user__username", "user__email", "product__name", "product__sku")
    list_filter = ("created_at",)
    autocomplete_fields = ("user", "product")
