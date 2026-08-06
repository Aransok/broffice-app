"""Shared parser helpers."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup


def read_soup(path: Path) -> BeautifulSoup:
    return BeautifulSoup(path.read_text(encoding="utf-8", errors="replace"), "lxml")


def result(
    *,
    status: str = "ok",
    content: Any = None,
    errors: list | None = None,
    warnings: list | None = None,
    metadata: dict | None = None,
    relationships: dict | None = None,
    media: list | None = None,
    seo: dict | None = None,
) -> dict:
    return {
        "status": status,
        "errors": errors or [],
        "warnings": warnings or [],
        "metadata": metadata or {},
        "content": content or {},
        "relationships": relationships or {},
        "media": media or [],
        "seo": seo or {},
    }


def entity_from_path(path: Path, kind: str) -> tuple[str | None, str | None]:
    # .../product/272/slug.html
    parts = path.as_posix().split("/")
    try:
        idx = parts.index(kind)
        return parts[idx + 1], Path(parts[idx + 2]).stem
    except (ValueError, IndexError):
        return None, None


_PRICE_RE = re.compile(
    r"(?P<eur>€\s*(?P<eur_val>[\d.,]+))|(?P<bgn>(?P<bgn_val>[\d.,]+)\s*лв)",
    re.I,
)


def parse_prices(texts: list[str]) -> dict:
    """Extract EUR/BGN amounts from price text nodes."""
    out: dict[str, float | None] = {"price_eur": None, "price_bgn": None, "old_price_eur": None, "old_price_bgn": None}
    for text in texts:
        clean = " ".join(text.split())
        if "лв" in clean.lower() or "€" in clean or "eur" in clean.lower():
            for m in _PRICE_RE.finditer(clean.replace("\xa0", " ")):
                if m.group("eur_val"):
                    val = _to_float(m.group("eur_val"))
                    if "old" in clean.lower() or "ста" in clean.lower():
                        out["old_price_eur"] = val
                    elif out["price_eur"] is None:
                        out["price_eur"] = val
                if m.group("bgn_val"):
                    val = _to_float(m.group("bgn_val"))
                    if "old" in clean.lower():
                        out["old_price_bgn"] = val
                    elif out["price_bgn"] is None:
                        out["price_bgn"] = val
    return out


def _to_float(raw: str) -> float | None:
    try:
        return float(raw.replace(" ", "").replace(",", "."))
    except ValueError:
        return None


def extract_seo(soup: BeautifulSoup, url_hint: str = "") -> dict:
    title = (soup.title.string or "").strip() if soup.title else ""
    desc = ""
    md = soup.find("meta", attrs={"name": "description"})
    if md and md.get("content"):
        desc = md["content"].strip()
    keywords = ""
    mk = soup.find("meta", attrs={"name": "keywords"})
    if mk and mk.get("content"):
        keywords = mk["content"].strip()
    canonical = ""
    can = soup.find("link", rel="canonical")
    if can and can.get("href"):
        canonical = can["href"].strip()
    robots = ""
    mr = soup.find("meta", attrs={"name": "robots"})
    if mr and mr.get("content"):
        robots = mr["content"].strip()
    og = {}
    for tag in soup.find_all("meta", attrs={"property": True}):
        prop = tag.get("property", "")
        if prop.startswith("og:") and tag.get("content"):
            og[prop] = tag["content"]
    json_ld = []
    for script in soup.find_all("script", type="application/ld+json"):
        if script.string:
            json_ld.append(script.string.strip())
    return {
        "url": url_hint,
        "title": title,
        "description": desc,
        "keywords": keywords,
        "canonical": canonical,
        "robots": robots,
        "open_graph": og,
        "json_ld": json_ld,
    }
