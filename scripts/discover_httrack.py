#!/usr/bin/env python3
"""Phase 0 — Analyze HTTrack mirror and write discovery artifacts."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
HTTRACK = ROOT.parent / "officecenter-bg.com"
DISCOVERY = ROOT / "docs" / "discovery"
KNOWLEDGE = ROOT / "knowledge"

DISCOVERY.mkdir(parents=True, exist_ok=True)
KNOWLEDGE.mkdir(parents=True, exist_ok=True)


def classify_path(rel: str) -> str:
    p = rel.replace("\\", "/").lower()
    if p in {"index.html", "./index.html"} or p.endswith("/index.html") and p.count("/") <= 1:
        return "home"
    if "/product/" in f"/{p}" or p.startswith("product/"):
        return "product"
    if "/category/" in f"/{p}" or p.startswith("category/"):
        return "category"
    if "/brand/" in f"/{p}" or p.startswith("brand/"):
        return "brand"
    if "promotions" in p:
        return "promotions"
    if "search" in p:
        return "search"
    if "contact" in p:
        return "contact"
    if "catalog-pdf" in p:
        return "document"
    if p.endswith(".html"):
        return "static"
    return "other"


def extract_id_slug(rel: str, page_type: str) -> tuple[str | None, str | None]:
    parts = Path(rel).as_posix().split("/")
    if page_type in {"product", "category", "brand"} and len(parts) >= 3:
        entity_id = parts[1]
        slug = Path(parts[2]).stem
        return entity_id, slug
    return None, None


def analyze_html(path: Path, rel: str) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(text, "lxml")
    page_type = classify_path(rel)
    entity_id, slug = extract_id_slug(rel, page_type)

    title = (soup.title.string or "").strip() if soup.title else ""
    meta_desc = ""
    md = soup.find("meta", attrs={"name": "description"})
    if md and md.get("content"):
        meta_desc = md["content"].strip()

    canonical = ""
    can = soup.find("link", attrs={"rel": "canonical"})
    if can and can.get("href"):
        canonical = can["href"].strip()

    keywords = ""
    mk = soup.find("meta", attrs={"name": "keywords"})
    if mk and mk.get("content"):
        keywords = mk["content"].strip()

    breadcrumbs = []
    for li in soup.select("ul.axil-breadcrumb li"):
        breadcrumbs.append(li.get_text(" ", strip=True))

    images = [img.get("src", "") for img in soup.find_all("img") if img.get("src")]
    links = [a.get("href", "") for a in soup.find_all("a") if a.get("href")]
    forms = len(soup.find_all("form"))
    scripts = [s.get("src", "inline") for s in soup.find_all("script")]
    styles = [l.get("href", "") for l in soup.find_all("link", rel="stylesheet")]
    json_ld = len(soup.find_all("script", type="application/ld+json"))

    product_title = ""
    pt = soup.select_one("h2.product-title, h1.product-title, .product-title")
    if pt:
        product_title = pt.get_text(" ", strip=True)

    prices = [el.get_text(" ", strip=True) for el in soup.select(".price-amount, .price.current-price, span.price-amount")]

    return {
        "path": rel.replace("\\", "/"),
        "url": f"/{rel.replace(chr(92), '/').removesuffix('.html')}",
        "title": title,
        "description": meta_desc,
        "keywords": keywords,
        "canonical_url": canonical,
        "breadcrumb": " > ".join(breadcrumbs),
        "page_type": page_type,
        "language": "bg",
        "entity_id": entity_id or "",
        "slug": slug or "",
        "product_title": product_title,
        "prices": " | ".join(prices[:4]),
        "number_of_images": len(images),
        "number_of_links": len(links),
        "forms": forms,
        "scripts": len(scripts),
        "stylesheets": len(styles),
        "structured_data": json_ld,
        "status": "ok",
        "notes": "",
        "images_sample": images[:5],
        "links_sample": links[:20],
    }


def detect_components(samples: list[BeautifulSoup]) -> list[dict]:
    selectors = {
        "Header": "header.axil-header, header.header",
        "Footer": "footer, .footer-area, .axil-footer-area",
        "MegaMenu": ".department-megamenu, .header-department",
        "SearchBox": ".axil-search, #searchForm",
        "ProductCard": ".axil-product, .product-card, .product",
        "Breadcrumbs": "ul.axil-breadcrumb",
        "Pagination": ".pagination, .axil-pagination",
        "Filters": ".axil-shop-sidebar, .filter",
        "ImageGallery": ".product-gallery, .axil-product-gallery",
        "SpecificationTable": "#specifications, .product-description",
        "RelatedProducts": ".related-products, .recent-product",
        "Banner": ".banner, .axil-banner",
        "Carousel": ".slick-slider, .axil-slick",
    }
    found = []
    for name, sel in selectors.items():
        pages = 0
        for soup in samples:
            if soup.select_one(sel):
                pages += 1
        if pages:
            found.append(
                {
                    "name": name,
                    "selector": sel,
                    "pages_detected": pages,
                    "estimated_react_component": name,
                }
            )
    return found


def write_md(path: Path, title: str, body: str) -> None:
    path.write_text(f"# {title}\n\n{body}\n", encoding="utf-8")


def main() -> None:
    if not HTTRACK.exists():
        raise SystemExit(f"HTTrack root not found: {HTTRACK}")

    html_files = sorted(HTTRACK.rglob("*.html"))
    rows: list[dict] = []
    type_counts: Counter[str] = Counter()
    nav_links: set[str] = set()
    css_files: list[str] = []
    js_files: list[str] = []
    problems: list[str] = []
    sample_soups: list[BeautifulSoup] = []

    for path in html_files:
        rel = str(path.relative_to(HTTRACK))
        try:
            row = analyze_html(path, rel)
            rows.append(row)
            type_counts[row["page_type"]] += 1
            if len(sample_soups) < 8 and row["page_type"] in {
                "home",
                "product",
                "category",
                "brand",
            }:
                sample_soups.append(
                    BeautifulSoup(path.read_text(encoding="utf-8", errors="replace"), "lxml")
                )
            for href in row.get("links_sample", []):
                if href and not href.startswith(("http", "mailto", "tel", "#", "javascript")):
                    nav_links.add(href)
        except Exception as exc:  # noqa: BLE001
            problems.append(f"{rel}: {exc}")
            rows.append(
                {
                    "path": rel.replace("\\", "/"),
                    "url": "",
                    "title": "",
                    "description": "",
                    "keywords": "",
                    "canonical_url": "",
                    "breadcrumb": "",
                    "page_type": classify_path(rel),
                    "language": "bg",
                    "entity_id": "",
                    "slug": "",
                    "product_title": "",
                    "prices": "",
                    "number_of_images": 0,
                    "number_of_links": 0,
                    "forms": 0,
                    "scripts": 0,
                    "stylesheets": 0,
                    "structured_data": 0,
                    "status": "error",
                    "notes": str(exc),
                }
            )

    # CSS / JS inventory
    for css in HTTRACK.rglob("*.css"):
        css_files.append(str(css.relative_to(HTTRACK)).replace("\\", "/"))
    for js in HTTRACK.rglob("*.js"):
        js_files.append(str(js.relative_to(HTTRACK)).replace("\\", "/"))

    image_count = sum(1 for _ in (HTTRACK / "image").rglob("*") if _.is_file()) if (HTTRACK / "image").exists() else 0

    # CSV inventory
    fieldnames = [
        "path",
        "url",
        "title",
        "description",
        "keywords",
        "canonical_url",
        "breadcrumb",
        "page_type",
        "language",
        "entity_id",
        "slug",
        "product_title",
        "prices",
        "number_of_images",
        "number_of_links",
        "forms",
        "scripts",
        "stylesheets",
        "structured_data",
        "status",
        "notes",
    ]
    csv_path = DISCOVERY / "page_inventory.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    components = detect_components(sample_soups)

    # Discovery markdown docs
    write_md(
        DISCOVERY / "site-map.md",
        "Site Map",
        "\n".join(
            [
                f"- HTTrack root: `{HTTRACK}`",
                f"- Total HTML files: **{len(html_files)}**",
                f"- Images under image/: **{image_count}**",
                f"- CSS files: **{len(css_files)}**",
                f"- JS files: **{len(js_files)}**",
                "",
                "## Page type counts",
                "",
                *[f"- {k}: {v}" for k, v in sorted(type_counts.items())],
            ]
        ),
    )

    write_md(
        DISCOVERY / "pages.md",
        "Pages",
        "\n".join(
            [
                f"Inventoried **{len(rows)}** HTML pages. See `page_inventory.csv`.",
                "",
                "## Sample products",
                "",
                *[
                    f"- [{r['entity_id']}] {r['product_title'] or r['title']} (`{r['path']}`)"
                    for r in rows
                    if r["page_type"] == "product"
                ][:15],
            ]
        ),
    )

    write_md(
        DISCOVERY / "navigation.md",
        "Navigation",
        "\n".join(
            [
                "Detected from header department menu and breadcrumbs.",
                "",
                "## Patterns",
                "",
                "- Header: `header.axil-header.header-style-2`",
                "- Category mega menu: `.header-department` / `.department-megamenu`",
                "- Search: form `#searchForm` → `https://officecenter-bg.com/search`",
                "- Breadcrumbs: `ul.axil-breadcrumb`",
                "- Phone: `0700 45 095`",
                "",
                f"Unique relative links sampled: **{len(nav_links)}**",
            ]
        ),
    )

    write_md(
        DISCOVERY / "components.md",
        "Components",
        "\n".join(
            [
                "Repeating UI blocks detected in sample pages:",
                "",
                *[f"- **{c['name']}** — `{c['selector']}` (seen in {c['pages_detected']} samples)" for c in components],
            ]
        ),
    )

    write_md(
        DISCOVERY / "categories.md",
        "Categories",
        "\n".join(
            [
                f"Category HTML pages in mirror: **{type_counts.get('category', 0)}**",
                "",
                "URL pattern: `/category/{id}/{slug}`",
                "",
                "## Sample",
                "",
                *[
                    f"- {r['entity_id']} — {r['title']} (`{r['path']}`)"
                    for r in rows
                    if r["page_type"] == "category"
                ][:20],
            ]
        ),
    )

    write_md(
        DISCOVERY / "products.md",
        "Products",
        "\n".join(
            [
                f"Product HTML pages in mirror: **{type_counts.get('product', 0)}** (partial download)",
                "",
                "URL pattern: `/product/{id}/{slug}`",
                "",
                "Extractable fields observed:",
                "",
                "- `h2.product-title`",
                "- `.price-amount` / `.price.current-price` (EUR + BGN без ДДС)",
                "- Breadcrumb trail",
                "- Tab `#specifications` (Характеристики)",
                "- Gallery images under product page",
                "- CSRF/token script with `route_name = 'product.show'`",
            ]
        ),
    )

    write_md(
        DISCOVERY / "brands.md",
        "Brands",
        "\n".join(
            [
                f"Brand HTML pages: **{type_counts.get('brand', 0)}**",
                "",
                "URL pattern: `/brand/{id}/{slug}`",
                "",
                *[
                    f"- {r['entity_id']} — {r['title']}"
                    for r in rows
                    if r["page_type"] == "brand"
                ],
            ]
        ),
    )

    write_md(
        DISCOVERY / "images.md",
        "Images",
        "\n".join(
            [
                f"Files under `image/`: **{image_count}**",
                "",
                "Also: `assets/media/` logos, `assets_site1/` theme assets.",
                "",
                "Deduplicate by hash during import; store paths only in PostgreSQL.",
            ]
        ),
    )

    write_md(
        DISCOVERY / "downloads.md",
        "Downloads",
        f"catalog-pdf HTML/files: **{type_counts.get('document', 0)}** entries under `catalog-pdf/`.",
    )

    write_md(
        DISCOVERY / "seo.md",
        "SEO",
        "\n".join(
            [
                "Observed SEO elements:",
                "",
                "- `<title>` present on pages",
                "- `<meta name=\"description\">` often empty in samples",
                "- `<link rel=\"canonical\">` present (sometimes relative HTTrack paths)",
                "- Google Tag Manager `GTM-P6FRWS2P`",
                "- Language content: Bulgarian (html lang may say en — HTTrack artifact)",
                "",
                "Preserve original public URLs; fix HTTrack-relative canonicals during import.",
            ]
        ),
    )

    write_md(
        DISCOVERY / "css.md",
        "CSS Analysis",
        "\n".join(
            [
                f"CSS files found: **{len(css_files)}**",
                "",
                "## Key stylesheets",
                "",
                *[f"- `{c}`" for c in css_files[:40]],
                "",
                "Primary theme: `assets_site1/css/style.min.css`, `custom.css`, Bootstrap vendor stack.",
            ]
        ),
    )

    write_md(
        DISCOVERY / "design-system.md",
        "Design System (initial)",
        "\n".join(
            [
                "Derived from theme classes and inline styles:",
                "",
                "- Framework feel: Axil eCommerce theme + Bootstrap",
                "- Primary color variable: `var(--color-primary)` (approx blue `#3577f0` from search UI)",
                "- Search / UI radius: ~8px",
                "- Header: `header-style-2`, department mega menu",
                "- Product cards / prices dual currency EUR + лв. без ДДС",
                "- Breakpoints: Bootstrap defaults (sm/md/lg)",
                "",
                "Refine after deeper CSS parse in later tasks.",
            ]
        ),
    )

    write_md(
        DISCOVERY / "javascript.md",
        "JavaScript",
        "\n".join(
            [
                f"JS files found: **{len(js_files)}**",
                "",
                *[f"- `{j}`" for j in js_files[:40]],
                "",
                "Behaviors: search history, qty buttons, slick carousels, department menu, GTM.",
            ]
        ),
    )

    write_md(DISCOVERY / "forms.md", "Forms", "Primary form: site search (`#searchForm`). Cart/checkout likely server-side on live site (limited in mirror).")
    write_md(DISCOVERY / "filters.md", "Filters", "Category pages expected to have sidebar filters (`.axil-shop-sidebar`). Confirm via live crawl samples.")
    write_md(DISCOVERY / "search.md", "Search", "Search endpoint: `https://officecenter-bg.com/search?search=...`. Placeholder: „Кои продукти търсите?“")
    write_md(DISCOVERY / "header.md", "Header", "Logo Plovdiv, search, phone 0700 45 095, category department mega menu, promotions link.")
    write_md(DISCOVERY / "footer.md", "Footer", "Inspect `footer` / `.axil-footer-area` on index — document links during live crawl enrichment.")
    write_md(DISCOVERY / "blog.md", "Blog", "No dedicated blog HTML detected in current partial mirror.")
    write_md(DISCOVERY / "static-pages.md", "Static Pages", "\n".join([f"- `{r['path']}` — {r['title']}" for r in rows if r["page_type"] == "static"][:30]) or "Few static HTML pages in mirror beyond entity pages.")
    write_md(
        DISCOVERY / "problems.md",
        "Problems",
        "\n".join(
            [
                "## Known issues",
                "",
                "- HTTrack mirror is **partial** (products << full catalog)",
                "- Relative canonical URLs rewritten by HTTrack",
                "- `html lang=\"en\"` while content is Bulgarian",
                "- Broken/missing asset links possible (`favicon.html` style HTTrack stubs)",
                "- Dynamic filter/pagination URLs intentionally excluded from crawl strategy",
                "",
                "## Parse errors",
                "",
                *(problems or ["None"]),
            ]
        ),
    )
    write_md(DISCOVERY / "unknown.md", "Unknown", "Full product count, live filter schema, cart/checkout flow, login endpoints — resolve via live crawl + API probing.")

    # Lightweight knowledge seed (will be enriched by parsers)
    site = {
        "website_name": "Office Center BG",
        "language": "bg",
        "currency": "BGN",
        "also_shows_currency": "EUR",
        "source": "httrack",
        "httrack_path": str(HTTRACK),
        "total_html_pages": len(html_files),
        "total_products_html": type_counts.get("product", 0),
        "total_categories_html": type_counts.get("category", 0),
        "total_brands_html": type_counts.get("brand", 0),
        "total_images": image_count,
        "total_css": len(css_files),
        "total_js": len(js_files),
        "page_type_counts": dict(type_counts),
    }
    (KNOWLEDGE / "site.json").write_text(json.dumps(site, ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "components.json").write_text(json.dumps(components, ensure_ascii=False, indent=2), encoding="utf-8")
    (KNOWLEDGE / "statistics.json").write_text(
        json.dumps({"from_httrack": site, "problems_count": len(problems)}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (KNOWLEDGE / "problems.json").write_text(
        json.dumps({"parse_errors": problems, "notes": ["partial_mirror"]}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Analyzed {len(html_files)} HTML files")
    print(f"Wrote {csv_path}")
    print(f"Page types: {dict(type_counts)}")


if __name__ == "__main__":
    main()
