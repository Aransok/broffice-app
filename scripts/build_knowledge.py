#!/usr/bin/env python3
"""Build knowledge/*.json from HTTrack HTML using parsers."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from parser.brand_parser import BrandParser
from parser.category_parser import CategoryParser
from parser.image_parser import ImageParser
from parser.menu_parser import MenuParser
from parser.product_parser import ProductParser
from parser.seo_parser import SEOParser

HTTRACK = ROOT.parent / "officecenter-bg.com"
KNOWLEDGE = ROOT / "knowledge"
KNOWLEDGE.mkdir(parents=True, exist_ok=True)


def load_json(path: Path, default):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return default
    return default


def main() -> None:
    product_parser = ProductParser()
    category_parser = CategoryParser()
    brand_parser = BrandParser()
    seo_parser = SEOParser()
    image_parser = ImageParser(httrack_root=HTTRACK)
    menu_parser = MenuParser()

    products = []
    categories = []
    brands = []
    seo_entries = []
    images = []
    problems = load_json(KNOWLEDGE / "problems.json", {"parse_errors": [], "notes": []})

    product_files = sorted((HTTRACK / "product").rglob("*.html")) if (HTTRACK / "product").exists() else []
    for path in product_files:
        result = product_parser.parse_file(path)
        if result.get("status") == "ok":
            products.append(result["content"])
            seo_entries.append(result.get("seo") or {})
            for img in result.get("media") or []:
                images.append(image_parser.enrich(img, referenced_by=result["content"].get("external_id")))
        else:
            problems.setdefault("parse_errors", []).append({"file": str(path), "errors": result.get("errors")})

    category_files = sorted((HTTRACK / "category").rglob("*.html")) if (HTTRACK / "category").exists() else []
    for path in category_files:
        result = category_parser.parse_file(path)
        if result.get("status") == "ok":
            categories.append(result["content"])
            seo_entries.append(result.get("seo") or {})
        else:
            problems.setdefault("parse_errors", []).append({"file": str(path), "errors": result.get("errors")})

    brand_files = sorted((HTTRACK / "brand").rglob("*.html")) if (HTTRACK / "brand").exists() else []
    for path in brand_files:
        result = brand_parser.parse_file(path)
        if result.get("status") == "ok":
            brands.append(result["content"])
        else:
            problems.setdefault("parse_errors", []).append({"file": str(path), "errors": result.get("errors")})

    index_path = HTTRACK / "index.html"
    navigation = {"menus": []}
    if index_path.exists():
        navigation = menu_parser.parse_file(index_path).get("content") or navigation

    # Deduplicate images by path
    by_path = {}
    for img in images:
        key = img.get("original_path") or img.get("src")
        if key:
            by_path[key] = img

    site = load_json(KNOWLEDGE / "site.json", {})
    site.update(
        {
            "website_name": "Office Center BG",
            "language": "bg",
            "currency": "BGN",
            "parsed_products": len(products),
            "parsed_categories": len(categories),
            "parsed_brands": len(brands),
            "parsed_images": len(by_path),
        }
    )

    relationships = {
        "products_to_categories": [
            {"product_id": p.get("external_id"), "category_ids": p.get("category_ids", [])} for p in products
        ],
        "products_to_brands": [
            {"product_id": p.get("external_id"), "brand": p.get("brand")} for p in products if p.get("brand")
        ],
    }

    (KNOWLEDGE / "products.json").write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "categories.json").write_text(json.dumps(categories, ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "brands.json").write_text(json.dumps(brands, ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "images.json").write_text(json.dumps(list(by_path.values()), ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "navigation.json").write_text(json.dumps(navigation, ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "seo.json").write_text(json.dumps([s for s in seo_entries if s], ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "relationships.json").write_text(json.dumps(relationships, ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "site.json").write_text(json.dumps(site, ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "problems.json").write_text(json.dumps(problems, ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "report.md").write_text(
        "\n".join(
            [
                "# Knowledge Base Report",
                "",
                f"- Products: {len(products)}",
                f"- Categories: {len(categories)}",
                f"- Brands: {len(brands)}",
                f"- Images (product-linked): {len(by_path)}",
                f"- SEO entries: {len([s for s in seo_entries if s])}",
                "",
                "Source: HTTrack parsers. Live crawl merges into pages.json / routes.json separately.",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Knowledge built: products={len(products)} categories={len(categories)} brands={len(brands)} images={len(by_path)}")


if __name__ == "__main__":
    main()
