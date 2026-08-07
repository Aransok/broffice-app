"""One-off/rerunnable import of knowledge/seo.json (real per-page titles
extracted from the original officecenter-bg.com site) into the SEO model.

Matching: seo.json's `entity_id` is the site's own numeric id. Products were
resynced under `external_id=f"supplier-{id}"` (see
products/management/commands/sync_supplier_catalog.py); categories keep the
bare numeric id as their external_id (see categories import). SEO rows are
then keyed by our own internal UUID (`entity_id=str(product.id)`), which is
what seo/services.py looks up — not the legacy numeric id — so this import
must resolve the match before writing the row.

Safe to re-run: update_or_create keyed by (entity_type, entity_id).
"""

from __future__ import annotations

import json

from django.conf import settings
from django.core.management.base import BaseCommand

from categories.models import Category
from products.models import Product
from seo.models import SEO


class Command(BaseCommand):
    help = "Import knowledge/seo.json into the SEO model."

    def handle(self, *args, **options):
        path = settings.KNOWLEDGE_DIR / "seo.json"
        if not path.exists():
            self.stderr.write(f"Not found: {path}")
            return

        entries = json.loads(path.read_text(encoding="utf-8"))

        imported = 0
        unmatched = 0

        for entry in entries:
            entity_type = entry.get("entity_type")
            legacy_id = entry.get("entity_id")
            if not entity_type or not legacy_id:
                continue

            if entity_type == "product":
                obj = Product.objects.filter(
                    external_id=f"supplier-{legacy_id}"
                ).first()
            elif entity_type == "category":
                obj = Category.objects.filter(external_id=str(legacy_id)).first()
            else:
                obj = None

            if obj is None:
                unmatched += 1
                continue

            SEO.objects.update_or_create(
                entity_type=entity_type,
                entity_id=str(obj.id),
                defaults={
                    "title": entry.get("title") or "",
                    "description": entry.get("description") or "",
                    "keywords": entry.get("keywords") or "",
                    "robots": entry.get("robots") or "",
                    "open_graph": entry.get("open_graph") or {},
                    "json_ld": entry.get("json_ld") or [],
                },
            )
            imported += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {imported} SEO row(s), {unmatched} entr{'y' if unmatched == 1 else 'ies'} "
                f"had no matching product/category (expected — seo.json only covers a subset)."
            )
        )
