import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class Order(TimeStampedModel):
    STATUS_PENDING = "pending"
    STATUS_CONFIRMED = "confirmed"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_REJECTED, "Rejected"),
    ]

    SHIPPING_SPEEDY_ADDRESS = "speedy_address"
    SHIPPING_SPEEDY_OFFICE = "speedy_office"
    SHIPPING_METHOD_CHOICES = [
        (SHIPPING_SPEEDY_ADDRESS, "Доставка до адрес"),
        (SHIPPING_SPEEDY_OFFICE, "До офис на Спиди"),
    ]

    PAYMENT_CASH_ON_DELIVERY = "cash_on_delivery"
    PAYMENT_METHOD_CHOICES = [
        (PAYMENT_CASH_ON_DELIVERY, "Наложен платеж"),
    ]

    number = models.CharField(max_length=32, unique=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="orders",
        on_delete=models.SET_NULL,
    )
    customer_email = models.EmailField()
    customer_name = models.CharField(max_length=255, blank=True, default="")
    customer_phone = models.CharField(max_length=64, blank=True, default="")

    # Company/B2B order details — snapshot at order time (same "never
    # recompute historical orders" rule as the money fields below), never
    # sourced from a mutable profile, so a later profile edit can't silently
    # change an already-placed order's invoice details.
    is_company_order = models.BooleanField(default=False)
    company_name = models.CharField(max_length=255, blank=True, default="")
    company_eik = models.CharField(max_length=32, blank=True, default="")
    company_vat_number = models.CharField(max_length=32, blank=True, default="")
    company_address = models.CharField(max_length=512, blank=True, default="")
    company_mol = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )
    # subtotal (items, excl. VAT) + shipping -> vat_amount -> total, all snapshot
    # at order time so a later VAT_RATE_PERCENT/setting change never rewrites history.
    subtotal_bgn = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    vat_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    vat_amount_bgn = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_bgn = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True, default="")
    reject_reason = models.TextField(blank=True, default="")

    address = models.ForeignKey(
        "accounts.Address",
        null=True,
        blank=True,
        related_name="orders",
        on_delete=models.SET_NULL,
    )
    shipping_method = models.CharField(
        max_length=32, choices=SHIPPING_METHOD_CHOICES, blank=True, default=""
    )
    payment_method = models.CharField(
        max_length=32, choices=PAYMENT_METHOD_CHOICES, default=PAYMENT_CASH_ON_DELIVERY
    )
    delivery_address_line = models.CharField(max_length=512, blank=True, default="")
    delivery_city = models.CharField(max_length=128, blank=True, default="")
    delivery_post_code = models.CharField(max_length=16, blank=True, default="")
    speedy_office_id = models.CharField(max_length=64, blank=True, default="")
    speedy_office_name = models.CharField(max_length=255, blank=True, default="")
    shipping_cost_bgn = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Snapshot, same as everything else above — a coupon's value could
    # change (it can't, single-use, but this stays consistent with the
    # "never recompute historical orders" rule regardless) and deleting the
    # Coupon later must never touch this order's own recorded numbers.
    coupon = models.ForeignKey(
        "coupons.Coupon",
        null=True,
        blank=True,
        related_name="orders",
        on_delete=models.SET_NULL,
    )
    coupon_code = models.CharField(max_length=32, blank=True, default="")
    coupon_discount_bgn = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.number

    @staticmethod
    def generate_number() -> str:
        return f"ORD-{uuid.uuid4().hex[:10].upper()}"

    @property
    def total_profit_bgn(self) -> Decimal | None:
        # None (not zero) when no line has a recorded cost — e.g. orders
        # placed before cost_price_bgn existed, or products with no
        # admin_price set — so the UI can tell "no cost data" from "broke even".
        profits = [
            item.profit_bgn for item in self.items.all() if item.profit_bgn is not None
        ]
        if not profits:
            return None
        return sum(profits, Decimal("0"))


class OrderItem(TimeStampedModel):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(
        "products.Product",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="order_items",
    )
    product_name = models.CharField(max_length=512)
    product_external_id = models.CharField(max_length=64, blank=True, default="")
    product_sku = models.CharField(max_length=128, blank=True, default="")
    quantity = models.PositiveIntegerField(default=1)
    # unit_price is what was actually charged (after any discount); original_unit_price
    # is the pre-discount base price, kept only so invoices can show "was / now".
    # Both are permanent snapshots — never recomputed from current product data.
    original_unit_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)
    # Snapshot of Product.admin_price (reseller/cost price) at order-creation
    # time — same "never recompute historical orders" rule as unit_price
    # above. Null when the product had no admin_price set, or for orders
    # placed before this field existed; profit_bgn below stays None in that
    # case rather than pretending the cost was 0.
    cost_price_bgn = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    discount_label = models.CharField(max_length=255, blank=True, default="")
    # Which Promotion (if any) actually won the price for this line, captured
    # at order-creation time — used to retire single-item "+ Промоция"
    # quick-adds once the order confirming their use goes through, rather
    # than re-deriving "which promo was used" later from mutable state.
    # SET_NULL so deleting a promotion later never breaks a historical order.
    applied_promotion = models.ForeignKey(
        "promotions.Promotion",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="order_items",
    )

    def __str__(self) -> str:
        return f"{self.product_name} x{self.quantity}"

    @property
    def profit_bgn(self) -> Decimal | None:
        if self.cost_price_bgn is None:
            return None
        return (self.unit_price - self.cost_price_bgn) * self.quantity


class OrderNotification(TimeStampedModel):
    order = models.ForeignKey(
        Order, related_name="notifications", on_delete=models.CASCADE
    )
    is_read = models.BooleanField(default=False)
    message = models.CharField(max_length=512, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Notification {self.order.number}"


class Invoice(TimeStampedModel):
    """Structure only for now (spec #11/#23) — PDF generation lands in Phase 6.

    Deliberately thin: every money/product fact an invoice needs to print
    already lives on the immutable Order/OrderItem snapshot, so this model
    doesn't duplicate it. It exists to hold the invoice's own sequential
    number (distinct from the order number, per BG accounting convention)
    and, later, the generated PDF file.
    """

    order = models.OneToOneField(
        Order, related_name="invoice", on_delete=models.CASCADE
    )
    number = models.CharField(max_length=32, unique=True, db_index=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    pdf_file = models.FileField(upload_to="invoices/", null=True, blank=True)

    def __str__(self) -> str:
        return self.number

    @staticmethod
    def generate_number() -> str:
        return f"INV-{uuid.uuid4().hex[:10].upper()}"


class CreditNote(TimeStampedModel):
    """DB foundation only (spec #24) — full refund/credit workflow is future
    work. Mirrors Invoice's snapshot philosophy: amount/reason are the only
    facts that don't already live elsewhere, everything else traces back to
    the original invoice/order."""

    invoice = models.ForeignKey(
        Invoice, related_name="credit_notes", on_delete=models.CASCADE
    )
    number = models.CharField(max_length=32, unique=True, db_index=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    amount_bgn = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField(blank=True, default="")
    pdf_file = models.FileField(upload_to="credit-notes/", null=True, blank=True)

    def __str__(self) -> str:
        return self.number

    @staticmethod
    def generate_number() -> str:
        return f"CN-{uuid.uuid4().hex[:10].upper()}"


class EmailLog(TimeStampedModel):
    TYPE_ADMIN_ORDER = "admin_order"
    TYPE_CUSTOMER_INVOICE = "customer_invoice"
    TYPE_ADMIN_CONFIRMATION = "admin_confirmation"
    TYPE_CHOICES = [
        (TYPE_ADMIN_ORDER, "Admin order"),
        (TYPE_CUSTOMER_INVOICE, "Customer invoice"),
        (TYPE_ADMIN_CONFIRMATION, "Admin confirmation"),
    ]

    STATUS_SENT = "sent"
    STATUS_FAILED = "failed"
    STATUS_PENDING = "pending"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_SENT, "Sent"),
        (STATUS_FAILED, "Failed"),
    ]

    order = models.ForeignKey(Order, related_name="emails", on_delete=models.CASCADE)
    email_type = models.CharField(max_length=32, choices=TYPE_CHOICES)
    to_address = models.EmailField()
    subject = models.CharField(max_length=512, blank=True, default="")
    status = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    body_preview = models.TextField(blank=True, default="")
    error = models.TextField(blank=True, default="")
    sent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.email_type} → {self.to_address}"
