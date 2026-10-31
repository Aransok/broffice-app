from django.db import models

from common.models import TimeStampedModel


class Banner(TimeStampedModel):
    TYPE_PRODUCT = "product"
    TYPE_CATEGORY = "category"
    TYPE_CHOICES = [(TYPE_PRODUCT, "Product"), (TYPE_CATEGORY, "Category")]

    # One banner per promotion (spec: product-scoped promo -> product
    # banner, category-scoped -> category banner). Deleting the promotion
    # deletes its banner row; the generated file is removed by sync_banners
    # itself before the row goes (see banners/services.py).
    promotion = models.OneToOneField(
        "promotions.Promotion", on_delete=models.CASCADE, related_name="banner"
    )
    banner_type = models.CharField(max_length=16, choices=TYPE_CHOICES)
    # Relative to MEDIA_ROOT, e.g. "banners/<promotion-id>.png" — same
    # convention as ProductImage.path/Category.image_path.
    image_path = models.CharField(max_length=1024)
    # Background-removed product cut-outs (transparent PNGs, relative to
    # MEDIA_ROOT) the live homepage carousel floats on the slide: one for a
    # product promo, a few products from across the category for a category
    # promo. None = not generated yet (banners from before this existed).
    subject_paths = models.JSONField(null=True, blank=True, default=None)

    def __str__(self) -> str:
        return f"Banner for {self.promotion_id}"
