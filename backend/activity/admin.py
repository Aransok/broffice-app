from django.contrib import admin

from .models import ProductView


@admin.register(ProductView)
class ProductViewAdmin(admin.ModelAdmin):
    list_display = ("user", "product", "category", "view_count", "last_viewed_at")
    search_fields = ("user__username", "user__email", "product__name", "product__sku")
    list_filter = ("last_viewed_at",)
    autocomplete_fields = ("user", "product", "category")
