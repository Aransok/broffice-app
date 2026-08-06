"""Pull the product catalog from the officecenter-bg.com supplier API and
upsert it into our own database (safe to re-run — same external_id-keyed
update_or_create pattern as import_knowledge.py).

Field mapping:
- supplier `RRP` (recommended retail price) -> our price_bgn/price_eur, the
  customer-facing sale price.
- supplier `price` (the client's own purchase price from the supplier) ->
  our admin_price, an admin-only field never shown to customers.
- `client_price` is never touched here — it's a separate, fully
  admin-controlled override layer and must survive re-syncs unchanged.
- supplier `categories` is a full root-to-leaf ancestry list per product
  (each entry has its own `parent_id`) — these become real linked Category
  rows, parent chain included. The supplier and the legacy HTTrack import
  both read from the same officecenter-bg.com database, so their category
  ids are numerically identical — matched by the bare id as external_id, so
  this merges straight into the already-imported legacy category tree
  instead of creating a parallel duplicate one. The leaf (the one entry
  that isn't any other entry's parent) becomes the product's single
  `category` FK, since the schema (like the rest of the storefront) only
  supports one category per product.
- Once a Category/Brand/Product row exists, its `slug` is never touched
  again on a later resync — only set at creation. A resync must not
  silently rewrite an already-indexed, real SEO URL just because a name
  shifted slightly on the supplier's end.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from brands.models import Brand
from categories.models import Category
from products.models import (
    Product,
    ProductImage,
    ProductSpecification,
    next_item_number,
)


def _dec(val):
    if val is None or val == "":
        return None
    try:
        return Decimal(str(val))
    except (InvalidOperation, ValueError, TypeError):
        return None


class Command(BaseCommand):
    help = "Sync the product catalog from the supplier API into our database (safe to re-run)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--max-pages",
            type=int,
            default=None,
            help="Stop after this many pages (for a quick/manual test run).",
        )

    def handle(self, *args, **options):
        api_key = settings.SUPPLIER_CATALOG_API_KEY
        base_url = settings.SUPPLIER_CATALOG_BASE_URL
        if not api_key:
            raise CommandError(
                "SUPPLIER_CATALOG_API_KEY is not set — add it to .env before running this command."
            )
        max_pages = options.get("max_pages")

        url = f"{base_url.rstrip('/')}/{api_key}"
        params = {"page": 1}
        created_count = 0
        updated_count = 0
        page_number = 0

        while url:
            page_number += 1
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            payload = response.json()
            # One short transaction per product (not one for the whole run)
            # — SQLite takes a whole-database write lock for the duration of
            # a transaction, and a multi-minute single transaction across
            # ~3000 products locked out every other request the live dev
            # server was trying to serve at the same time.
            for item in payload.get("data") or []:
                if self._sync_product(item):
                    created_count += 1
                else:
                    updated_count += 1
            self.stdout.write(
                f"Page {page_number}: {created_count + updated_count} synced so far"
            )
            if max_pages and page_number >= max_pages:
                break
            url = (payload.get("links") or {}).get("next")
            params = None  # the `next` link already carries its own query string

        self.stdout.write(
            self.style.SUCCESS(
                f"Supplier sync complete: {created_count} created, {updated_count} updated."
            )
        )
        # Not returned: BaseCommand.execute() does `self.stdout.write(output)`
        # on whatever handle() returns, which blows up on anything but a
        # string/None. Callers that need the counts (the admin sync view)
        # instantiate this Command and call .handle() directly instead of
        # going through call_command()/execute(), and read these back.
        self.created_count = created_count
        self.updated_count = updated_count

    @transaction.atomic
    def _sync_product(self, item: dict) -> bool:
        supplier_id = str(item.get("id"))
        external_id = f"supplier-{supplier_id}"
        category = self._resolve_category(item.get("categories") or {})
        brand = self._resolve_brand(item.get("brand"))

        price = item.get("price") or {}
        rrp = item.get("RRP") or {}
        specifications = self._build_specifications(item)

        existing_product = Product.objects.filter(external_id=external_id).first()
        is_new = existing_product is None
        slug = (
            existing_product.slug
            if existing_product
            else self._unique_slug(
                Product, item.get("name") or external_id, external_id
            )
        )
        price_bgn = _dec(rrp.get("BGN"))
        defaults = {
            "slug": slug,
            "name": item.get("name") or external_id,
            "description": item.get("description") or "",
            "brand": brand,
            "category": category,
            "price_bgn": price_bgn,
            "price_eur": _dec(rrp.get("EUR")),
            "admin_price": _dec(price.get("BGN")),
            "specifications": specifications,
            "supplier_id": supplier_id,
        }
        if is_new:
            # A real starting client price from day one (matching
            # import_knowledge.py's own convention) — never set again on a
            # later resync, since by then it may be a deliberate admin
            # override (AdminPriceEditor) that must survive re-syncs.
            defaults["client_price"] = price_bgn
        product, _ = Product.objects.update_or_create(
            external_id=external_id, defaults=defaults
        )
        if is_new:
            product.item_number = next_item_number()
            product.save(update_fields=["item_number"])

        ProductSpecification.objects.filter(product=product).delete()
        for i, (name, value) in enumerate(specifications.items()):
            ProductSpecification.objects.create(
                product=product, name=name, value=str(value), sort_order=i
            )

        ProductImage.objects.filter(product=product).delete()
        photos = item.get("photos") or []
        # `is_main` decides which photo shows up as the primary/list-view
        # image (get_primary_image() just takes images[0]), not API order.
        photos_sorted = sorted(
            photos, key=lambda p: 0 if (isinstance(p, dict) and p.get("is_main")) else 1
        )
        for i, photo in enumerate(photos_sorted):
            photo_url = photo.get("url") if isinstance(photo, dict) else photo
            if not photo_url:
                continue
            ProductImage.objects.create(product=product, path=photo_url, sort_order=i)

        return is_new

    def _build_specifications(self, item: dict) -> dict:
        # `options` comes back as a list (of name/value-shaped dicts) or a
        # bare {} depending on the product — never trust it's already a dict.
        raw_options = item.get("options")
        if isinstance(raw_options, dict):
            specifications = dict(raw_options)
        else:
            specifications = {}
            for opt in raw_options or []:
                if isinstance(opt, dict) and opt.get("name") is not None:
                    specifications[str(opt["name"])] = opt.get("value")

        dimension_labels = (
            ("height", "Височина (мм)"),
            ("width", "Ширина (мм)"),
            ("depth", "Дълбочина (мм)"),
            ("weight", "Тегло (кг)"),
        )
        for api_field, label in dimension_labels:
            value = item.get(api_field)
            # 0 is the API's "not recorded" sentinel here, not a real
            # zero-height/zero-weight product.
            if value not in (None, "", 0):
                specifications[label] = value
        return specifications

    def _get_or_create_named(self, model, external_id: str, name: str):
        """Update the name if it changed, but never touch `slug` on an
        existing row — only assigned once, at creation."""
        existing = model.objects.filter(external_id=external_id).first()
        if existing:
            if existing.name != name:
                existing.name = name
                existing.save(update_fields=["name", "updated_at"])
            return existing
        slug = self._unique_slug(model, name, external_id)
        return model.objects.create(external_id=external_id, name=name, slug=slug)

    def _resolve_category(self, categories: list):
        if not categories:
            return None
        by_id = {}
        for cat in categories:
            cat_id = cat.get("id")
            if cat_id is None:
                continue
            # The supplier and the legacy HTTrack import both read from the
            # same officecenter-bg.com database, so their category ids are
            # numerically identical — using the bare id (not a "supplier-"
            # prefixed one) merges straight into the already-imported legacy
            # category instead of creating a duplicate parallel tree.
            ext = str(cat_id)
            category = self._get_or_create_named(Category, ext, cat.get("name") or ext)
            by_id[cat_id] = (category, cat.get("parent_id") or None)

        for cat_id, (category, parent_id) in by_id.items():
            parent = by_id.get(parent_id)
            if parent and category.parent_id != parent[0].id:
                category.parent = parent[0]
                category.save(update_fields=["parent", "updated_at"])

        parent_ids = {parent_id for _, parent_id in by_id.values() if parent_id}
        leaves = [
            category
            for cat_id, (category, _) in by_id.items()
            if cat_id not in parent_ids
        ]
        return (leaves or [next(iter(by_id.values()))[0]])[-1]

    def _resolve_brand(self, brand_name: str | None):
        if not brand_name:
            return None
        # Unlike categories, brand ids aren't shared between the legacy
        # import and the supplier API, so matching has to go by name — the
        # legacy import's small brand set (10 brands) would otherwise get a
        # same-named duplicate the moment the supplier feed mentions "Bic".
        existing = Brand.objects.filter(name__iexact=brand_name).first()
        if existing:
            return existing
        ext = f"supplier-brand-{brand_name.strip().lower().replace(' ', '-')}"
        return self._get_or_create_named(Brand, ext, brand_name)

    def _unique_slug(self, model, label: str, external_id: str) -> str:
        """Slugify a supplier-given name (Cyrillic, unlike import_knowledge.py's
        pre-slugified legacy JSON) and keep it when free; otherwise append
        external_id."""
        base = slugify(label, allow_unicode=True) or external_id
        existing = (
            model.objects.filter(slug=base).exclude(external_id=external_id).exists()
        )
        if not existing:
            return base
        return f"{base}-{external_id}"
