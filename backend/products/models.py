from django.db import models

from common.models import SoftStatusModel, TimeStampedModel


def next_item_number() -> int:
    """Next value for Product.item_number — a plain 1, 2, 3... counter (not
    the UUID `id`), so staff can reference a product by a short number
    instead of the external/supplier id. Computed via Max()+1, same pattern
    already used for ProductImage.sort_order (see api/views.py upload_images)
    rather than a DB-level AutoField, since `id` already fills that role."""
    return (Product.objects.aggregate(m=models.Max("item_number"))["m"] or 0) + 1


class Product(TimeStampedModel, SoftStatusModel):
    external_id = models.CharField(max_length=64, unique=True, db_index=True)
    # Human-friendly tracking number, 1/2/3..., independent of `id`/`external_id`.
    item_number = models.PositiveIntegerField(
        unique=True, null=True, blank=True, db_index=True
    )
    slug = models.SlugField(max_length=255, unique=True)
    name = models.CharField(max_length=512)
    short_description = models.TextField(blank=True, default="")
    description = models.TextField(blank=True, default="")
    brand = models.ForeignKey(
        "brands.Brand",
        null=True,
        blank=True,
        related_name="products",
        on_delete=models.SET_NULL,
    )
    category = models.ForeignKey(
        "categories.Category",
        null=True,
        blank=True,
        related_name="products",
        on_delete=models.SET_NULL,
    )
    price_bgn = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    price_eur = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    old_price_bgn = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    old_price_eur = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    # Dual pricing for admin vs clients (rules TBD)
    client_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    admin_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    currency = models.CharField(max_length=8, default="BGN")
    availability = models.CharField(max_length=64, blank=True, default="in_stock")
    pack_quantity = models.PositiveIntegerField(null=True, blank=True)
    specifications = models.JSONField(default=dict, blank=True)

    # Supplier mapping (prep only — see docs/tasks for the "no auto-ordering
    # yet" scope note). Original supplier website → us → customer.
    supplier_id = models.CharField(max_length=128, blank=True, default="")
    supplier_code = models.CharField(max_length=128, blank=True, default="")
    supplier_url = models.URLField(max_length=1024, blank=True, default="")
    supplier_name = models.CharField(max_length=255, blank=True, default="")
    supplier_reference = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["category", "status"]),
        ]

    def __str__(self) -> str:
        return self.name


class ProductImage(TimeStampedModel):
    product = models.ForeignKey(
        Product, related_name="images", on_delete=models.CASCADE
    )
    path = models.CharField(max_length=1024)
    hash = models.CharField(max_length=64, blank=True, default="", db_index=True)
    alt_text = models.CharField(max_length=512, blank=True, default="")
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)
    thumbnail_path = models.CharField(max_length=1024, blank=True, default="")
    webp_path = models.CharField(max_length=1024, blank=True, default="")

    class Meta:
        ordering = ["sort_order", "created_at"]

    def __str__(self) -> str:
        return f"{self.product_id}:{self.path}"


class ProductDocument(TimeStampedModel):
    product = models.ForeignKey(
        Product, related_name="documents", on_delete=models.CASCADE
    )
    title = models.CharField(max_length=255)
    path = models.CharField(max_length=1024)
    sort_order = models.IntegerField(default=0)

    def __str__(self) -> str:
        return self.title


class ProductSpecification(TimeStampedModel):
    product = models.ForeignKey(
        Product, related_name="spec_rows", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=255)
    value = models.CharField(max_length=1024)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return f"{self.name}: {self.value}"
