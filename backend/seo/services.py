"""Builds the SEO payload (title, description, canonical, Open Graph,
JSON-LD) embedded in product/category API responses.

A real editorial `SEO` row (imported from knowledge/seo.json, or entered by
an admin later) always wins. Every field still falls back to something
reasonable generated from the entity itself, so a page never ships blank
meta tags just because nobody has written custom copy for it yet.
"""

from __future__ import annotations

from django.conf import settings

from pricing.services import get_effective_price
from promotions.services import get_active_promotions

from .models import SEO

SITE_NAME = "BRoffice"


def _absolute_url(path: str) -> str:
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    return f"{base}{path}"


def _media_url(path: str) -> str | None:
    """Mirrors frontend/src/api/media.ts::getImageUrl's three path shapes,
    minus the legacy-HTTrack-bridge fallback: that bridge only exists under
    DEBUG (config/urls.py), so a path that only resolves there would be a
    broken image link in the actual production Open Graph/JSON-LD output —
    better to omit the image than advertise one that 404s for real crawlers.
    """
    if not path:
        return None
    if path.startswith(("http://", "https://")):
        return path
    if path.startswith(("products/", "categories/", "brands/", "highlights/")):
        return _absolute_url(f"/media/{path}")
    return None


def _lookup(entity_type: str, entity_id) -> SEO | None:
    return SEO.objects.filter(entity_type=entity_type, entity_id=str(entity_id)).first()


def _truncate(text: str, limit: int = 300) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def build_product_seo(product) -> dict:
    override = _lookup("product", product.id)
    path = f"/product/{product.slug}"
    canonical = _absolute_url(path)

    title = (override.title if override else "") or f"{product.name} | {SITE_NAME}"
    description = (override.description if override else "") or _truncate(
        product.short_description or product.description or product.name
    )

    # obj.images.all() reuses the prefetch_related("images") cache already
    # applied by ProductViewSet's queryset — same pattern as
    # ProductListSerializer.get_primary_image, no extra query.
    images = list(product.images.all())
    image_urls = [url for img in images if (url := _media_url(img.path))]

    # The anonymous/public-facing price — mirrors what ProductListSerializer's
    # promo_price_bgn exposes to a logged-out visitor, since structured data
    # read by crawlers must reflect the public page, not a signed-in user's
    # individual pricing.
    price = product.client_price or product.price_bgn
    promo = get_effective_price(product, None, get_active_promotions(), {})
    if promo is not None and promo.source != "base":
        price = promo.price

    json_ld = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.name,
        "description": description,
        "sku": product.sku,
        "url": canonical,
    }
    if image_urls:
        json_ld["image"] = image_urls
    if product.brand_id:
        json_ld["brand"] = {"@type": "Brand", "name": product.brand.name}
    if price is not None:
        json_ld["offers"] = {
            "@type": "Offer",
            "url": canonical,
            "priceCurrency": product.currency or "BGN",
            "price": str(price),
            "availability": (
                "https://schema.org/InStock"
                if product.availability == "in_stock"
                else "https://schema.org/OutOfStock"
            ),
        }

    return {
        "title": title,
        "description": description,
        "keywords": (override.keywords if override else "") or "",
        "canonical": canonical,
        "robots": (override.robots if override else "") or "index, follow",
        "open_graph": {
            "og:type": "product",
            "og:title": title,
            "og:description": description,
            "og:url": canonical,
            "og:site_name": SITE_NAME,
            **({"og:image": image_urls[0]} if image_urls else {}),
        },
        "json_ld": [json_ld],
    }


# Legal/info Page.slug -> the real live route that renders it (see
# frontend/src/router.tsx's `<LegalPage slug="..." />` usages) — Page.slug
# itself isn't a real path (there's no generic /pages/:slug route).
_STATIC_PAGE_PATHS = {
    "about-us": "/about",
    "terms-and-conditions": "/terms",
    "privacy-policy": "/privacy-policy",
    "cookie-policy": "/cookie-policy",
    "returns-and-withdrawal": "/returns",
}


def build_page_seo(page) -> dict:
    path = _STATIC_PAGE_PATHS.get(page.slug, f"/{page.slug}")
    canonical = _absolute_url(path)
    override = page.seo

    title = (override.title if override else "") or f"{page.title} | {SITE_NAME}"
    description = (override.description if override else "") or _truncate(
        page.body or page.title
    )

    return {
        "title": title,
        "description": description,
        "keywords": (override.keywords if override else "") or "",
        "canonical": canonical,
        "robots": (override.robots if override else "") or "index, follow",
        "open_graph": {
            "og:type": "website",
            "og:title": title,
            "og:description": description,
            "og:url": canonical,
            "og:site_name": SITE_NAME,
        },
        "json_ld": [],
    }


def build_category_seo(category) -> dict:
    override = _lookup("category", category.id)
    path = f"/category/{category.slug}"
    canonical = _absolute_url(path)

    title = (override.title if override else "") or f"{category.name} | {SITE_NAME}"
    description = (override.description if override else "") or _truncate(
        category.description or category.name
    )
    image_url = _media_url(category.image_path)

    json_ld = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": category.name,
        "description": description,
        "url": canonical,
    }
    if image_url:
        json_ld["image"] = image_url

    return {
        "title": title,
        "description": description,
        "keywords": (override.keywords if override else "") or "",
        "canonical": canonical,
        "robots": (override.robots if override else "") or "index, follow",
        "open_graph": {
            "og:type": "website",
            "og:title": title,
            "og:description": description,
            "og:url": canonical,
            "og:site_name": SITE_NAME,
            **({"og:image": image_url} if image_url else {}),
        },
        "json_ld": [json_ld],
    }
