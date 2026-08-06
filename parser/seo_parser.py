"""SEO extractor wrapper."""

from __future__ import annotations

from pathlib import Path

from .base import extract_seo, read_soup, result


class SEOParser:
    def parse_file(self, path: Path, url_hint: str = "") -> dict:
        try:
            soup = read_soup(path)
        except OSError as exc:
            return result(status="error", errors=[str(exc)])
        seo = extract_seo(soup, url_hint)
        return result(content=seo, seo=seo)
