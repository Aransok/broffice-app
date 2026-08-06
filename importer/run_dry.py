"""CLI dry-run / Django import entrypoint."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from importer.base import (
    BrandImporter,
    CategoryImporter,
    ImageImporter,
    ProductImporter,
    dry_run_store,
)


def main() -> None:
    knowledge = ROOT / "knowledge"
    product_store: dict = {}
    category_store: dict = {}
    brand_store: dict = {}
    image_store: dict = {}

    stats = {
        "products": ProductImporter(knowledge).import_all(lambda k, v: dry_run_store(product_store, k, v)),
        "categories": CategoryImporter(knowledge).import_all(lambda k, v: dry_run_store(category_store, k, v)),
        "brands": BrandImporter(knowledge).import_all(lambda k, v: dry_run_store(brand_store, k, v)),
        "images": ImageImporter(knowledge).import_all(lambda k, v: dry_run_store(image_store, k, v)),
    }

    # Idempotency check: run products again
    second = ProductImporter(knowledge).import_all(lambda k, v: dry_run_store(product_store, k, v))
    stats["products_second_pass"] = second

    out = ROOT / "knowledge" / "import_dry_run.json"
    out.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, indent=2))
    assert second["created"] == 0, "Importer not idempotent"
    print("Idempotency OK")


if __name__ == "__main__":
    main()
