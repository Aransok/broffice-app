from django.contrib import admin

from .models import Address, Profile

admin.site.register(Profile)


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ("full_name", "user", "city", "is_default", "created_at")
    list_filter = ("is_default", "city")
    search_fields = ("full_name", "phone", "city", "address_line")
