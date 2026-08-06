from django.contrib import admin

from .models import Product, ProductDocument, ProductImage, ProductSpecification


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0


class ProductSpecInline(admin.TabularInline):
    model = ProductSpecification
    extra = 0


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "external_id",
        "name",
        "category",
        "brand",
        "price_bgn",
        "client_price",
        "admin_price",
        "status",
    )
    search_fields = ("name", "slug", "external_id", "sku")
    list_filter = ("status", "brand", "category")
    inlines = [ProductImageInline, ProductSpecInline]


admin.site.register(ProductDocument)
