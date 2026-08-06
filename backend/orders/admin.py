from django.contrib import admin

from .models import CreditNote, EmailLog, Invoice, Order, OrderItem, OrderNotification


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "number",
        "customer_email",
        "status",
        "shipping_method",
        "payment_method",
        "total_bgn",
        "created_at",
    )
    list_filter = ("status", "shipping_method", "payment_method")
    search_fields = ("number", "customer_email", "customer_name")
    inlines = [OrderItemInline]


admin.site.register(OrderNotification)
admin.site.register(EmailLog)


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("number", "order", "issued_at")
    search_fields = ("number", "order__number", "order__customer_email")


@admin.register(CreditNote)
class CreditNoteAdmin(admin.ModelAdmin):
    list_display = ("number", "invoice", "amount_bgn", "issued_at")
    search_fields = ("number", "invoice__number")
