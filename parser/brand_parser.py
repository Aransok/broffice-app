"""Brand HTML → structured JSON."""

from __future__ import annotations

from pathlib import Path

from .base import entity_from_path, extract_seo, read_soup, result


class BrandParser:
    def parse_file(self, path: Path) -> dict:
        try:
            soup = read_soup(path)
        except OSError as exc:
            return result(status="error", errors=[str(exc)])

        external_id, slug = entity_from_path(path, "brand")
        if not external_id:
            return result(status="error", errors=["could not parse brand id/slug"])

        name = ""
        h = soup.select_one("h1, h2, .product-title")
        if h:
            name = h.get_text(" ", strip=True)
        if not name and soup.title:
            name = soup.title.get_text(" ", strip=True)

        logo = None
        img = soup.select_one("img[src*='brand'], .brand img, img")
        if img and img.get("src"):
            logo = img["src"].split("?")[0]

        url_hint = f"/brand/{external_id}/{slug}"
        seo = extract_seo(soup, url_hint)
        seo["entity_type"] = "brand"
        seo["entity_id"] = external_id

        content = {
            "external_id": external_id,
            "slug": slug,
            "name": name,
            "logo": logo,
            "url": url_hint,
            "source_file": str(path),
        }
        return result(content=content, seo=seo, metadata={"path": str(path)})
