"""Idempotent importers: knowledge JSON → Django ORM (or dry-run JSON upsert)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class BaseImporter:
    def __init__(self, knowledge_dir: Path):
        self.knowledge_dir = knowledge_dir

    def load(self, name: str) -> Any:
        path = self.knowledge_dir / name
        if not path.exists():
            return []
        return json.loads(path.read_text(encoding="utf-8"))


class ProductImporter(BaseImporter):
    """Upsert products by external_id. Safe to re-run."""

    def import_all(self, upsert_fn) -> dict:
        products = self.load("products.json")
        created = updated = 0
        for item in products:
            ext_id = item.get("external_id")
            if not ext_id:
                continue
            was_created = upsert_fn(ext_id, item)
            if was_created:
                created += 1
            else:
                updated += 1
        return {"created": created, "updated": updated, "total": len(products)}


class CategoryImporter(BaseImporter):
    def import_all(self, upsert_fn) -> dict:
        categories = self.load("categories.json")
        created = updated = 0
        # Parents first (no parent_id), then children — simple 2-pass
        ordered = sorted(categories, key=lambda c: 0 if not c.get("parent_id") else 1)
        for item in ordered:
            ext_id = item.get("external_id")
            if not ext_id:
                continue
            was_created = upsert_fn(ext_id, item)
            if was_created:
                created += 1
            else:
                updated += 1
        return {"created": created, "updated": updated, "total": len(categories)}


class BrandImporter(BaseImporter):
    def import_all(self, upsert_fn) -> dict:
        brands = self.load("brands.json")
        created = updated = 0
        for item in brands:
            ext_id = item.get("external_id")
            if not ext_id:
                continue
            was_created = upsert_fn(ext_id, item)
            if was_created:
                created += 1
            else:
                updated += 1
        return {"created": created, "updated": updated, "total": len(brands)}


class ImageImporter(BaseImporter):
    def import_all(self, upsert_fn) -> dict:
        images = self.load("images.json")
        created = updated = 0
        for item in images:
            key = item.get("hash") or item.get("original_path")
            if not key:
                continue
            was_created = upsert_fn(key, item)
            if was_created:
                created += 1
            else:
                updated += 1
        return {"created": created, "updated": updated, "total": len(images)}


def dry_run_store(store: dict, key: str, item: dict) -> bool:
    """In-memory upsert used before Django is ready."""
    created = key not in store
    store[key] = item
    return created
