"""Category HTML → structured JSON."""

from __future__ import annotations

import re
from pathlib import Path

from .base import entity_from_path, extract_seo, read_soup, result


class CategoryParser:
    def parse_file(self, path: Path) -> dict:
        try:
            soup = read_soup(path)
        except OSError as exc:
            return result(status="error", errors=[str(exc)])

        external_id, slug = entity_from_path(path, "category")
        if not external_id:
            return result(status="error", errors=["could not parse category id/slug"])

        title = ""
        h = soup.select_one("h1, h2.category-title, .axil-section-gap h1, .title")
        if h:
            title = h.get_text(" ", strip=True)
        if not title and soup.title:
            title = soup.title.get_text(" ", strip=True)

        breadcrumbs = []
        parent_id = None
        crumb_links = soup.select("ul.axil-breadcrumb a")
        for a in crumb_links:
            href = a.get("href", "")
            # Breadcrumb parent links are relative (e.g. "../369/opakoviecni-materiali.html"),
            # not "category/369/..." — strip leading "../"/"./" before matching the id/slug.
            normalized = re.sub(r"^(?:\.\./|\./)+", "", href.replace("\\", "/"))
            m = re.search(r"^(?:category/)?(\d+)/([^/]+?)(?:\.html)?$", normalized)
            breadcrumbs.append(
                {
                    "name": a.get_text(" ", strip=True),
                    "category_id": m.group(1) if m else None,
                }
            )
            if m:
                parent_id = m.group(1)  # last category link before current is parent

        # If last breadcrumb category equals self, take previous
        if (
            breadcrumbs
            and breadcrumbs[-1].get("category_id") == external_id
            and len(breadcrumbs) >= 2
        ):
            parent_id = breadcrumbs[-2].get("category_id")
        elif breadcrumbs and breadcrumbs[-1].get("category_id") == external_id:
            parent_id = None

        children = []
        for a in soup.select("a[href*='/category/'], a[href*='category/']"):
            href = a.get("href", "")
            m = re.search(
                r"category/(\d+)/([^/]+?)(?:\.html)?$", href.replace("\\", "/")
            )
            if m and m.group(1) != external_id:
                children.append(
                    {
                        "external_id": m.group(1),
                        "slug": m.group(2),
                        "name": a.get_text(" ", strip=True),
                    }
                )

        # unique children
        seen = set()
        uniq_children = []
        for c in children:
            if c["external_id"] not in seen:
                seen.add(c["external_id"])
                uniq_children.append(c)

        product_ids = []
        for a in soup.select("a[href*='/product/'], a[href*='product/']"):
            href = a.get("href", "")
            m = re.search(r"product/(\d+)/", href.replace("\\", "/"))
            if m:
                product_ids.append(m.group(1))

        url_hint = f"/category/{external_id}/{slug}"
        seo = extract_seo(soup, url_hint)
        seo["entity_type"] = "category"
        seo["entity_id"] = external_id

        image = None
        img = soup.select_one(".category-image img, .axil-category img, img")
        if img and img.get("src") and "product" not in (img.get("src") or ""):
            image = (img.get("src") or "").split("?")[0]

        content = {
            "external_id": external_id,
            "slug": slug,
            "name": title,
            "parent_id": parent_id if parent_id != external_id else None,
            "breadcrumb": breadcrumbs,
            "children": uniq_children[:50],
            "product_ids_sample": list(dict.fromkeys(product_ids))[:100],
            "image": image,
            "url": url_hint,
            "source_file": str(path),
        }
        return result(content=content, seo=seo, metadata={"path": str(path)})
