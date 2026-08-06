from django.contrib import admin

from .models import SpeedyOffice


@admin.register(SpeedyOffice)
class SpeedyOfficeAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "external_id", "is_active")
    list_filter = ("city", "is_active")
    search_fields = ("name", "city", "external_id", "address")
