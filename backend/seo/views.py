from django.conf import settings
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from django.views.decorators.http import require_GET

from categories.models import Category
from products.models import Product

# Fixed, non-slug-driven public routes — mirrors frontend/src/router.tsx's
# top-level static paths (excludes account/admin/cart/checkout: private,
# no SEO value, already blocked in robots.txt below).
STATIC_ROUTES = [
    ("/", "daily", "1.0"),
    ("/catalog", "daily", "0.8"),
    ("/promotions", "daily", "0.8"),
    ("/about", "monthly", "0.3"),
    ("/contact", "monthly", "0.3"),
    ("/terms", "yearly", "0.1"),
    ("/privacy-policy", "yearly", "0.1"),
    ("/cookie-policy", "yearly", "0.1"),
    ("/returns", "yearly", "0.1"),
]

# Paths with no indexable/public value — private data, infinite duplicate
# query permutations, or app chrome a crawler shouldn't spend budget on.
DISALLOWED_PATHS = [
    "/admin",
    "/account",
    "/cart",
    "/checkout",
    "/order-confirmation",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/search",
]


@require_GET
def robots_txt(request):
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    lines = ["User-agent: *"]
    lines += [f"Disallow: {p}" for p in DISALLOWED_PATHS]
    lines += ["", f"Sitemap: {base}/sitemap.xml", ""]
    return HttpResponse("\n".join(lines), content_type="text/plain")


@require_GET
def llms_txt(request):
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    content = render_to_string(
        "seo/llms.txt",
        {
            "base": base,
            "product_count": Product.objects.filter(
                status=Product.STATUS_PUBLISHED
            ).count(),
            "category_count": Category.objects.filter(
                status=Category.STATUS_PUBLISHED
            ).count(),
        },
    )
    return HttpResponse(content, content_type="text/plain")


@require_GET
def sitemap_xml(request):
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    today = timezone.now().date().isoformat()

    urls = [
        {"loc": f"{base}{path}", "lastmod": today, "changefreq": freq, "priority": pri}
        for path, freq, pri in STATIC_ROUTES
    ]

    categories = Category.objects.filter(status=Category.STATUS_PUBLISHED).only(
        "slug", "updated_at"
    )
    urls += [
        {
            "loc": f"{base}/category/{c.slug}",
            "lastmod": c.updated_at.date().isoformat(),
            "changefreq": "weekly",
            "priority": "0.7",
        }
        for c in categories
    ]

    products = Product.objects.filter(status=Product.STATUS_PUBLISHED).only(
        "slug", "updated_at"
    )
    urls += [
        {
            "loc": f"{base}/product/{p.slug}",
            "lastmod": p.updated_at.date().isoformat(),
            "changefreq": "weekly",
            "priority": "0.6",
        }
        for p in products
    ]

    xml = render_to_string("seo/sitemap.xml", {"urls": urls})
    return HttpResponse(xml, content_type="application/xml")
