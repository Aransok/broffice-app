from django.contrib import admin

from .models import Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("external_id", "name", "slug", "parent", "status")
    search_fields = ("name", "slug", "external_id")
    list_filter = ("status",)
