#!/usr/bin/env python3
"""Controlled live crawl of officecenter-bg.com — metadata only, rate-limited."""

from __future__ import annotations

import json
import re
import time
from collections import deque
from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE = ROOT / "knowledge"
KNOWLEDGE.mkdir(parents=True, exist_ok=True)

BASE = "https://officecenter-bg.com"
USER_AGENT = "BrofficeMigrationBot/1.0 (+local migration; contact admin)"
DELAY_SEC = 0.75
MAX_PAGES = 120  # safety cap for first run; re-run with higher limit later
EXCLUDE_QUERY_KEYS = {"page", "sort", "filter", "view", "session", "sid", "search"}


def normalize_url(url: str) -> str | None:
    url, _ = urldefrag(url)
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return None
    if parsed.netloc and "officecenter-bg.com" not in parsed.netloc:
        return None
    # Drop query params that explode crawl space
    if parsed.query:
        q = parsed.query.lower()
        if any(k in q for k in EXCLUDE_QUERY_KEYS):
            # Allow bare /search without dumping all query variants into queue
            if "/search" in parsed.path:
                return f"{BASE}/search"
            return None
    path = parsed.path.rstrip("/") or "/"
    # Skip obvious junk
    if any(x in path for x in ("/cdn-cgi", "/cache", "/tmp", "/stat", ".xml", ".jpg", ".png", ".webp", ".css", ".js", ".pdf")):
        if path.endswith(".xml") and "sitemap" in path:
            pass
        elif any(path.endswith(ext) for ext in (".jpg", ".png", ".webp", ".css", ".js", ".pdf", ".gif", ".svg")):
            return None
    return f"{BASE}{path}" if not path.startswith("http") else urljoin(BASE, path)


def classify(url: str) -> str:
    path = urlparse(url).path
    if path in {"", "/"}:
        return "home"
    if path.startswith("/product/"):
        return "product"
    if path.startswith("/category/"):
        return "category"
    if path.startswith("/brand/"):
        return "brand"
    if "promotion" in path:
        return "promotions"
    if path.startswith("/search"):
        return "search"
    return "page"


def extract_entity(url: str) -> tuple[str | None, str | None]:
    m = re.match(r"^/(product|category|brand)/(\d+)/([^/]+)/?$", urlparse(url).path)
    if not m:
        return None, None
    return m.group(2), m.group(3)


def fetch(session: requests.Session, url: str) -> tuple[int, str | None]:
    try:
        resp = session.get(url, timeout=30, allow_redirects=True)
        ctype = resp.headers.get("content-type", "")
        if "text/html" not in ctype and "application/xhtml" not in ctype:
            return resp.status_code, None
        return resp.status_code, resp.text
    except requests.RequestException as exc:
        return 0, None


def parse_page(url: str, html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    title = (soup.title.string or "").strip() if soup.title else ""
    meta_desc = ""
    md = soup.find("meta", attrs={"name": "description"})
    if md and md.get("content"):
        meta_desc = md["content"].strip()
    canonical = ""
    can = soup.find("link", rel="canonical")
    if can and can.get("href"):
        canonical = urljoin(url, can["href"])
    breadcrumbs = [li.get_text(" ", strip=True) for li in soup.select("ul.axil-breadcrumb li")]
    product_title = ""
    pt = soup.select_one("h2.product-title, h1.product-title, .product-title")
    if pt:
        product_title = pt.get_text(" ", strip=True)
    images = []
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or ""
        if src:
            images.append(urljoin(url, src))
    links = []
    for a in soup.find_all("a", href=True):
        n = normalize_url(urljoin(url, a["href"]))
        if n:
            links.append(n)
    entity_id, slug = extract_entity(url)
    return {
        "url": url,
        "type": classify(url),
        "title": title,
        "meta_title": title,
        "meta_description": meta_desc,
        "canonical": canonical,
        "breadcrumb": breadcrumbs,
        "entity_id": entity_id,
        "slug": slug,
        "product_title": product_title,
        "images": images[:30],
        "internal_links": sorted(set(links))[:100],
        "source": "live_crawl",
    }


def load_seed_from_httrack() -> list[str]:
    seeds = [BASE + "/", BASE + "/promotions"]
    inv = ROOT / "docs" / "discovery" / "page_inventory.csv"
    if inv.exists():
        import csv

        with inv.open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                pt = row.get("page_type")
                eid = row.get("entity_id")
                slug = row.get("slug")
                if pt in {"product", "category", "brand"} and eid and slug:
                    seeds.append(f"{BASE}/{pt}/{eid}/{slug}")
    # Prefer unique, keep order
    seen = set()
    out = []
    for s in seeds:
        n = normalize_url(s)
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out


def try_sitemap(session: requests.Session) -> list[str]:
    urls = []
    for path in ("/sitemap.xml", "/sitemap_index.xml"):
        try:
            r = session.get(BASE + path, timeout=20)
            if r.status_code != 200:
                continue
            # crude loc extraction
            for loc in re.findall(r"<loc>(.*?)</loc>", r.text, flags=re.I):
                n = normalize_url(loc.strip())
                if n:
                    urls.append(n)
        except requests.RequestException:
            continue
    return urls


def main() -> None:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "bg,en;q=0.8"})

    queue: deque[str] = deque()
    seen: set[str] = set()
    pages: list[dict] = []
    routes: list[dict] = []
    errors: list[dict] = []

    for u in load_seed_from_httrack() + try_sitemap(session):
        if u not in seen:
            seen.add(u)
            queue.append(u)

    print(f"Seed URLs: {len(queue)}")

    while queue and len(pages) < MAX_PAGES:
        url = queue.popleft()
        # Skip non-HTML targets we already filtered; still allow listing pages
        status, html = fetch(session, url)
        time.sleep(DELAY_SEC)
        if not html:
            errors.append({"url": url, "status": status, "error": "no_html"})
            routes.append({"original_url": url, "type": classify(url), "status": status, "source": "live_crawl"})
            continue
        page = parse_page(url, html)
        page["http_status"] = status
        pages.append(page)
        entity_id, slug = extract_entity(url)
        routes.append(
            {
                "original_url": url,
                "normalized_url": urlparse(url).path or "/",
                "type": page["type"],
                "entity_id": entity_id,
                "slug": slug,
                "react_route": urlparse(url).path or "/",
                "api_endpoint": None,
                "status": status,
                "source": "live_crawl",
            }
        )
        # Enqueue only category/product/brand/home children to control growth
        for link in page["internal_links"]:
            t = classify(link)
            if t in {"home", "product", "category", "brand", "promotions", "page"} and link not in seen:
                # Prefer catalog entity pages; allow limited static pages
                if t == "page" and len(pages) > 50:
                    continue
                seen.add(link)
                queue.append(link)
        if len(pages) % 25 == 0:
            print(f"Crawled {len(pages)} pages, queue={len(queue)}")

    # Merge with existing HTTrack routes if present
    existing_routes = []
    routes_path = KNOWLEDGE / "routes.json"
    if routes_path.exists():
        try:
            existing_routes = json.loads(routes_path.read_text(encoding="utf-8"))
            if not isinstance(existing_routes, list):
                existing_routes = []
        except json.JSONDecodeError:
            existing_routes = []

    by_url = {r.get("original_url") or r.get("url"): r for r in existing_routes if isinstance(r, dict)}
    for r in routes:
        by_url[r["original_url"]] = r  # live crawl overwrites/fills

    pages_path = KNOWLEDGE / "pages.json"
    existing_pages = []
    if pages_path.exists():
        try:
            existing_pages = json.loads(pages_path.read_text(encoding="utf-8"))
            if not isinstance(existing_pages, list):
                existing_pages = []
        except json.JSONDecodeError:
            existing_pages = []
    by_page = {p.get("url"): p for p in existing_pages if isinstance(p, dict)}
    for p in pages:
        by_page[p["url"]] = p

    routes_path.write_text(json.dumps(list(by_url.values()), ensure_ascii=False, indent=2), encoding="utf-8")
    pages_path.write_text(json.dumps(list(by_page.values()), ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "crawl_errors.json").write_text(json.dumps(errors, ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "crawl_report.md").write_text(
        "\n".join(
            [
                "# Live Crawl Report",
                "",
                f"- Base: {BASE}",
                f"- Pages fetched with HTML: {len(pages)}",
                f"- Routes total (merged): {len(by_url)}",
                f"- Errors: {len(errors)}",
                f"- Max pages cap: {MAX_PAGES}",
                f"- Delay: {DELAY_SEC}s",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Done. pages={len(pages)} routes={len(by_url)} errors={len(errors)}")


if __name__ == "__main__":
    main()
