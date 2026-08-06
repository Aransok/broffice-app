"""Product HTML → structured JSON."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

from .base import entity_from_path, extract_seo, parse_prices, read_soup, result


class ProductParser:
    def parse_file(self, path: Path) -> dict:
        try:
            soup = read_soup(path)
        except OSError as exc:
            return result(status="error", errors=[str(exc)], metadata={"path": str(path)})

        external_id, slug = entity_from_path(path, "product")
        if not external_id:
            return result(status="error", errors=["could not parse product id/slug"], metadata={"path": str(path)})

        title_el = soup.select_one("h2.product-title, h1.product-title")
        name = title_el.get_text(" ", strip=True) if title_el else ""
        if not name and soup.title:
            name = soup.title.get_text(" ", strip=True)

        price_texts = [el.get_text(" ", strip=True) for el in soup.select(".single-product-content .price-amount, .single-product-content .price")]
        prices = parse_prices(price_texts)

        desc_el = soup.select_one(".single-product-content p.description")
        description = desc_el.decode_contents().strip() if desc_el else ""
        # Preserve Bulgarian text; strip only outer noise — keep HTML breaks as text
        description_text = desc_el.get_text("\n", strip=True) if desc_el else ""

        breadcrumbs = []
        category_ids = []
        for a in soup.select("ul.axil-breadcrumb a"):
            href = a.get("href", "")
            text = a.get_text(" ", strip=True)
            m = re.search(r"category/(\d+)/([^/]+?)(?:\.html)?$", href.replace("\\", "/"))
            breadcrumbs.append({"name": text, "href": href, "category_id": m.group(1) if m else None, "slug": m.group(2) if m else None})
            if m:
                category_ids.append(m.group(1))

        brand = None
        brand_a = soup.select_one('.single-product-content a[href*="/brand/"]')
        if brand_a:
            href = brand_a.get("href", "")
            bm = re.search(r"brand/(\d+)/([^/]+?)(?:\.html)?$", href.replace("\\", "/"))
            brand = {
                "name": (brand_a.get_text(" ", strip=True) or (brand_a.find("img") or {}).get("alt") if brand_a.find("img") else "") or "",
                "external_id": bm.group(1) if bm else None,
                "slug": bm.group(2) if bm else None,
                "href": href,
            }
            if brand_a.find("img") and not brand["name"]:
                brand["name"] = brand_a.find("img").get("alt", "")

        specs = {}
        for tr in soup.select("#specifications table tr"):
            th = tr.find("th")
            td = tr.find("td")
            if th and td:
                specs[th.get_text(" ", strip=True)] = td.get_text(" ", strip=True)

        media = []
        seen = set()
        for img in soup.select(".single-product-thumbnail img, .product-large-thumbnail-4 img, .small-thumb-img img"):
            src = img.get("src") or ""
            if not src or src in seen:
                continue
            seen.add(src)
            # Strip query for storage key
            clean = src.split("?")[0]
            media.append(
                {
                    "src": src,
                    "original_path": clean.replace("../", ""),
                    "alt": img.get("alt", ""),
                    "sort_order": len(media),
                }
            )

        pack_qty = None
        for span in soup.select(".single-product-content span"):
            t = span.get_text(" ", strip=True)
            if "Брой в опаковка" in t:
                m = re.search(r"(\d+)", t)
                if m:
                    pack_qty = int(m.group(1))

        url_hint = f"/product/{external_id}/{slug}"
        seo = extract_seo(soup, url_hint)
        seo["entity_type"] = "product"
        seo["entity_id"] = external_id

        content = {
            "external_id": external_id,
            "slug": slug,
            "name": name,
            "description_html": description,
            "description": description_text,
            "brand": brand,
            "category_ids": category_ids,
            "breadcrumb": breadcrumbs,
            "price_eur": prices.get("price_eur"),
            "price_bgn": prices.get("price_bgn"),
            "old_price_eur": prices.get("old_price_eur"),
            "old_price_bgn": prices.get("old_price_bgn"),
            "currency": "BGN",
            "pack_quantity": pack_qty,
            "specifications": specs,
            "images": [m["original_path"] for m in media],
            "url": url_hint,
            "source_file": str(path),
        }
        return result(
            content=content,
            media=media,
            seo=seo,
            relationships={"categories": category_ids, "brand": brand},
            metadata={"path": str(path)},
        )
