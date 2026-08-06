"""Import products/categories/brands from knowledge/*.json (idempotent)."""

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from brands.models import Brand
from categories.models import Category
from products.models import Product, ProductImage, ProductSpecification


def _dec(val):
    if val is None or val == "":
        return None
    try:
        return Decimal(str(val))
    except (InvalidOperation, ValueError):
        return None


class Command(BaseCommand):
    help = "Import knowledge JSON into the database (safe to re-run)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--knowledge",
            type=str,
            default=str(settings.KNOWLEDGE_DIR),
            help="Path to knowledge directory",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        knowledge = Path(options["knowledge"])
        brands_data = self._load(knowledge / "brands.json")
        categories_data = self._load(knowledge / "categories.json")
        products_data = self._load(knowledge / "products.json")
        images_data = self._load(knowledge / "images.json")

        brand_map = {}
        for item in brands_data:
            ext = str(item["external_id"])
            slug = self._unique_slug(Brand, item.get("slug") or ext, ext)
            brand, _ = Brand.objects.update_or_create(
                external_id=ext,
                defaults={
                    "slug": slug,
                    "name": item.get("name") or item.get("slug") or ext,
                    "logo_path": (item.get("logo") or "").replace("../", ""),
                },
            )
            brand_map[ext] = brand
        self.stdout.write(f"Brands: {len(brand_map)}")

        cat_map = {}
        for item in categories_data:
            ext = str(item["external_id"])
            slug = self._unique_slug(Category, item.get("slug") or ext, ext)
            cat, _ = Category.objects.update_or_create(
                external_id=ext,
                defaults={
                    "slug": slug,
                    "name": item.get("name") or item.get("slug") or ext,
                    "image_path": (item.get("image") or "").replace("../", ""),
                },
            )
            cat_map[ext] = cat
        for item in categories_data:
            parent_id = item.get("parent_id")
            if parent_id and str(parent_id) in cat_map:
                cat = cat_map[str(item["external_id"])]
                cat.parent = cat_map[str(parent_id)]
                cat.save(update_fields=["parent", "updated_at"])
        self.stdout.write(f"Categories: {len(cat_map)}")

        images_by_ref = {}
        for img in images_data:
            ref = str(img.get("referenced_by") or "")
            images_by_ref.setdefault(ref, []).append(img)

        count = 0
        for item in products_data:
            ext = str(item["external_id"])
            brand = None
            if item.get("brand") and item["brand"].get("external_id"):
                brand = brand_map.get(str(item["brand"]["external_id"]))
            category = None
            if item.get("category_ids"):
                category = cat_map.get(str(item["category_ids"][-1]))
            price_bgn = _dec(item.get("price_bgn"))
            slug = self._unique_slug(Product, item.get("slug") or ext, ext)
            product, _ = Product.objects.update_or_create(
                external_id=ext,
                defaults={
                    "slug": slug,
                    "name": item.get("name") or item.get("slug") or ext,
                    "description": item.get("description") or "",
                    "brand": brand,
                    "category": category,
                    "price_bgn": price_bgn,
                    "price_eur": _dec(item.get("price_eur")),
                    "old_price_bgn": _dec(item.get("old_price_bgn")),
                    "old_price_eur": _dec(item.get("old_price_eur")),
                    "client_price": price_bgn,
                    "admin_price": price_bgn,
                    "currency": item.get("currency") or "BGN",
                    "pack_quantity": item.get("pack_quantity"),
                    "specifications": item.get("specifications") or {},
                },
            )
            ProductSpecification.objects.filter(product=product).delete()
            for i, (k, v) in enumerate((item.get("specifications") or {}).items()):
                ProductSpecification.objects.create(
                    product=product, name=k, value=str(v), sort_order=i
                )

            ProductImage.objects.filter(product=product).delete()
            for img in images_by_ref.get(ext, []):
                ProductImage.objects.create(
                    product=product,
                    path=img.get("original_path") or "",
                    hash=img.get("hash") or "",
                    alt_text=img.get("alt") or "",
                    file_size=img.get("size"),
                    sort_order=img.get("sort_order") or 0,
                )
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Products imported: {count}"))

    def _unique_slug(self, model, base_slug: str, external_id: str) -> str:
        """Keep original slug when free; otherwise append external_id."""
        base = (base_slug or external_id).strip() or external_id
        existing = (
            model.objects.filter(slug=base).exclude(external_id=external_id).exists()
        )
        if not existing:
            return base
        return f"{base}-{external_id}"

    def _load(self, path: Path):
        if not path.exists():
            self.stdout.write(self.style.WARNING(f"Missing {path}"))
            return []
        return json.loads(path.read_text(encoding="utf-8"))
