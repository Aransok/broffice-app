"""Automatic promo banner generation — one Pillow-rendered banner per active
product- or category-scoped Promotion.

global-scope promotions never get a banner: there's no single product/
category image to render for "whole site" discount. user-scope promotions
never get one either — that's a private per-client discount and must never
surface on the public homepage (confirmed with the client, see
promotion_scope_client_decouple planning note).

sync_banners() is the one entry point: it (re)generates banners for
currently-active-by-date promotions and deletes banners for anything no
longer active (expired, not yet started, deactivated, or deleted outright),
then writes manifest.json for the frontend carousel to read. Called from a
signal on Promotion save/delete (banners/signals.py) and a periodic Celery
Beat task (config/settings.py CELERY_BEAT_SCHEDULE) that catches pure
date-expiry when nobody touches the admin panel.
"""

import json
from decimal import Decimal
from io import BytesIO
from pathlib import Path

import requests
from django.conf import settings
from PIL import Image, ImageDraw, ImageFont

from categories.services import get_descendant_category_ids
from common.currency import format_eur
from common.emails import BRAND_BLUE, BRAND_ORANGE
from common.fonts import (
    FONT_PATH_CANDIDATES_BOLD,
    FONT_PATH_CANDIDATES_REGULAR,
    find_font_path,
)
from common.media import resolve_media_path
from pricing.services import compute_promo_price, get_base_price
from products.models import Product
from promotions.models import Promotion
from promotions.services import get_active_promotions

from .models import Banner

CANVAS_SIZE = (1200, 400)
SUBJECT_BOX = (380, 380)


def _banners_dir() -> Path:
    # Deliberately re-reads settings.MEDIA_ROOT on every call rather than
    # caching it at import time — tests override MEDIA_ROOT per-test
    # (conftest.py's _isolate_media_root autouse fixture) and a module-level
    # constant would silently keep pointing at whatever MEDIA_ROOT was set
    # to when this module first got imported, defeating that isolation.
    # "highlights", not "banners": "/banners/" in a URL is a classic
    # ad-blocker filter-list pattern (EasyList and similar block it by
    # default) — a real customer with one enabled would have this silently
    # fail to fetch, with no console error and no visible network entry.
    return Path(settings.MEDIA_ROOT) / "highlights"


_rembg_session = None


def _get_rembg_session():
    global _rembg_session
    if _rembg_session is None:
        from rembg import new_session

        # isnet-general-use over rembg's default (u2net): tested both against
        # a real catalog photo with a busy/uneven studio background (a
        # flat-lay of many small parts) — u2net left a visibly opaque cloud
        # where the background should have gone transparent (confirmed via
        # actual alpha values, not just eyeballing it), isnet-general-use
        # cleanly zeroed it out. Same ballpark model size/cost, just a better
        # default for this catalog's photos.
        _rembg_session = new_session("isnet-general-use")
    return _rembg_session


def remove_background(image: Image.Image) -> Image.Image:
    """Isolated as its own function (rather than inlined) so tests can
    monkeypatch it — actually invoking the model is slow (first-ever call
    downloads a ~176MB model file) and irrelevant to testing the sync/
    manifest orchestration around it. Imported lazily so importing this
    module (e.g. at Django startup) never pays onnxruntime's import cost
    unless a banner is actually being generated."""
    from rembg import remove

    return remove(image, session=_get_rembg_session())


CUTOUT_MAX_SIZE = (720, 720)


def _trim_cutout(image: Image.Image) -> Image.Image:
    """Crops a background-removed image to the product itself (no empty
    transparent margin, so the storefront can size and place it exactly)
    and caps it at a size the carousel never needs to exceed."""
    image = image.convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if bbox:
        image = image.crop(bbox)
    image.thumbnail(CUTOUT_MAX_SIZE)
    return image


def _save_cutouts(promotion: Promotion, cutouts: list[Image.Image]) -> list[str]:
    """Writes this promotion's cut-outs as highlights/<id>-item-<n>.png
    (replacing any earlier set) and returns their MEDIA_ROOT-relative
    paths, in order."""
    banners_dir = _banners_dir()
    for old in banners_dir.glob(f"{promotion.id}-item-*.png"):
        old.unlink()
    paths = []
    for index, cutout in enumerate(cutouts):
        relative_path = f"highlights/{promotion.id}-item-{index}.png"
        _trim_cutout(cutout).save(Path(settings.MEDIA_ROOT) / relative_path, "PNG")
        paths.append(relative_path)
    return paths


def _trim_decimal(value: Decimal) -> str:
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return text or "0"


def _discount_label(promotion: Promotion) -> str:
    if promotion.discount_type == Promotion.TYPE_COST_PLUS:
        # Clients see the resulting price, never "cost + X%".
        product = promotion.product
        if product is not None and product.admin_price is not None:
            base = get_base_price(product)
            if base is not None:
                return format_eur(compute_promo_price(base, promotion, product))
        return "Специална цена"
    if promotion.discount_type == Promotion.TYPE_PERCENT:
        return f"-{_trim_decimal(promotion.value)}%"
    # Flat is the final price itself (see compute_promo_price), shown in
    # EUR - the site is EUR-only everywhere else, this banner text was the
    # one place still showing the internal BGN storage value directly.
    return format_eur(promotion.value)


def _font(candidates: list[str], size: int) -> ImageFont.FreeTypeFont:
    path = find_font_path(candidates)
    if path:
        return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def _wrap_text(
    draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int
) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if not current or draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _load_source_image(image_path: str) -> Image.Image | None:
    if not image_path:
        return None
    # Supplier-synced products (the bulk of the real catalog) store an
    # already-absolute hotlinked URL rather than a local path (see
    # sync_supplier_catalog.py) — fetched here rather than skipped, unlike
    # orders/emails.py's inline images, because banner generation runs in a
    # background task (Celery), not inside a request/response cycle where a
    # network fetch would add latency someone is actively waiting on.
    if image_path.startswith(("http://", "https://")):
        try:
            response = requests.get(image_path, timeout=10)
            response.raise_for_status()
        except requests.RequestException:
            return None
        try:
            return Image.open(BytesIO(response.content)).convert("RGBA")
        except OSError:
            return None
    path = resolve_media_path(image_path)
    if path is None:
        return None
    try:
        return Image.open(path).convert("RGBA")
    except OSError:
        return None


def _compose(
    *,
    title: str,
    subject_image: Image.Image | None,
    discount_label: str,
    old_price_text: str | None,
    new_price_text: str | None,
) -> Image.Image:
    canvas = Image.new("RGBA", CANVAS_SIZE, BRAND_BLUE)
    draw = ImageDraw.Draw(canvas)

    # A flat blue field read as plain — both brand colors together instead,
    # via a diagonal orange stripe pattern along the bottom edge (drawn
    # first, so everything else composites on top of it): a recognizable
    # "on sale" motif in retail/promo design, not just a solid block. Sized
    # to stay clear of the text block's own bottom margin and the subject
    # image's vertical centering gap, so it reads as a deliberate accent,
    # not a clash. Built via a mask (band shape) + a full-canvas diagonal
    # stripe fill, composited together — Pillow has no direct way to clip
    # an arbitrary polygon to a repeating pattern otherwise.
    band_mask = Image.new("L", CANVAS_SIZE, 0)
    ImageDraw.Draw(band_mask).polygon(
        [
            (0, CANVAS_SIZE[1]),
            (CANVAS_SIZE[0], CANVAS_SIZE[1]),
            (CANVAS_SIZE[0], CANVAS_SIZE[1] - 45),
            (0, CANVAS_SIZE[1] - 15),
        ],
        fill=255,
    )
    stripes = Image.new("RGBA", CANVAS_SIZE, BRAND_BLUE)
    stripes_draw = ImageDraw.Draw(stripes)
    stripe_width = 16
    for x in range(-CANVAS_SIZE[1], CANVAS_SIZE[0] + CANVAS_SIZE[1], stripe_width * 2):
        stripes_draw.line(
            [(x, CANVAS_SIZE[1]), (x + CANVAS_SIZE[1], 0)],
            fill=BRAND_ORANGE,
            width=stripe_width,
        )
    canvas = Image.composite(stripes, canvas, band_mask)
    draw = ImageDraw.Draw(canvas)

    title_font = _font(FONT_PATH_CANDIDATES_BOLD, 44)
    price_font = _font(FONT_PATH_CANDIDATES_BOLD, 36)
    old_price_font = _font(FONT_PATH_CANDIDATES_REGULAR, 24)
    badge_font = _font(FONT_PATH_CANDIDATES_BOLD, 28)

    text_left = 60
    text_max_width = 620

    y = 100
    for line in _wrap_text(draw, title, title_font, text_max_width)[:2]:
        draw.text((text_left, y), line, font=title_font, fill="white")
        y += 56

    y += 20
    if old_price_text:
        bbox = draw.textbbox((text_left, y), old_price_text, font=old_price_font)
        draw.text((text_left, y), old_price_text, font=old_price_font, fill="#cbd5e1")
        mid_y = (bbox[1] + bbox[3]) // 2
        draw.line((bbox[0], mid_y, bbox[2], mid_y), fill="#cbd5e1", width=2)
        y += 34

    if new_price_text:
        draw.text((text_left, y), new_price_text, font=price_font, fill="white")

    badge_padding = 16
    badge_width = draw.textlength(discount_label, font=badge_font) + badge_padding * 2
    draw.rectangle((0, 0, badge_width, 56), fill=BRAND_ORANGE)
    draw.text((badge_padding, 12), discount_label, font=badge_font, fill="white")

    if subject_image is not None:
        subject_image = subject_image.copy()
        subject_image.thumbnail(SUBJECT_BOX)
        px = (
            CANVAS_SIZE[0]
            - SUBJECT_BOX[0]
            - 60
            + (SUBJECT_BOX[0] - subject_image.width) // 2
        )
        py = (CANVAS_SIZE[1] - subject_image.height) // 2
        canvas.alpha_composite(subject_image, (px, py))
    else:
        # No product/category photo to show (~25% of this catalog's
        # categories have none, and a product can lack images too) — fill
        # what would otherwise be a bare half of solid blue with a large
        # discount pill instead, in the same spot the photo would occupy.
        big_badge_font = _font(FONT_PATH_CANDIDATES_BOLD, 72)
        text_w = draw.textlength(discount_label, font=big_badge_font)
        pill_w = text_w + 100
        pill_h = 152
        center_x = CANVAS_SIZE[0] - SUBJECT_BOX[0] // 2 - 60
        center_y = CANVAS_SIZE[1] // 2
        draw.rounded_rectangle(
            (
                center_x - pill_w / 2,
                center_y - pill_h / 2,
                center_x + pill_w / 2,
                center_y + pill_h / 2,
            ),
            radius=pill_h / 2,
            fill=BRAND_ORANGE,
        )
        draw.text(
            (center_x, center_y),
            discount_label,
            font=big_badge_font,
            fill="white",
            anchor="mm",
        )

    return canvas.convert("RGB")


def _make_product_banner(
    promotion: Promotion,
) -> tuple[Image.Image, list[Image.Image]] | None:
    product = promotion.product
    if product is None:
        return None
    base = get_base_price(product)
    if base is None:
        return None
    new_price = compute_promo_price(base, promotion, product=product)

    subject = None
    first_image = product.images.first()
    if first_image is not None:
        loaded = _load_source_image(first_image.path)
        if loaded is not None:
            subject = remove_background(loaded)

    image = _compose(
        title=product.name,
        subject_image=subject,
        discount_label=_discount_label(promotion),
        old_price_text=(
            format_eur(base) if new_price != base.quantize(Decimal("0.01")) else None
        ),
        new_price_text=format_eur(new_price),
    )
    return image, [subject] if subject is not None else []


MAX_COLLAGE_IMAGES = 4


# How many products to try per category banner before giving up (each try
# can be a remote image fetch plus a background-removal pass).
MAX_COLLAGE_ATTEMPTS = 10


def _category_representative_images(category, limit: int = MAX_COLLAGE_IMAGES):
    """Real product photos from inside the category — a category promo
    discounts many items, not one, so the banner shows a handful of real
    products (background-removed, same as a product banner) rather than a
    single photo or the category's own (often generic) icon image. Client
    feedback: "if its category ... get more photos" — one item's photo
    looked like only that one item was on sale.

    Drawn from the whole category subtree and spread across its
    subcategories (one product from each in turn), so a "Хартия" promo
    shows paper, notebooks and labels rather than four copies of near-
    identical copy paper - and a parent category whose products all sit in
    subcategories still gets pictures."""
    products = (
        Product.objects.filter(
            category_id__in=get_descendant_category_ids(category),
            status=Product.STATUS_PUBLISHED,
        )
        .exclude(images__isnull=True)
        .prefetch_related("images")
        .distinct()
        .order_by("category_id", "-created_at")[:200]
    )
    by_category: dict = {}
    for product in products:
        by_category.setdefault(product.category_id, []).append(product)
    queues = list(by_category.values())
    ordered = []
    while any(queues):
        for queue in queues:
            if queue:
                ordered.append(queue.pop(0))

    images = []
    for product in ordered[:MAX_COLLAGE_ATTEMPTS]:
        if len(images) >= limit:
            break
        first_image = product.images.first()
        if first_image is None:
            continue
        loaded = _load_source_image(first_image.path)
        if loaded is not None:
            images.append(remove_background(loaded))
    return images


def _build_collage(images: list[Image.Image], box: tuple[int, int]) -> Image.Image:
    """Arranges 1-4 already background-removed images into a grid filling
    `box` — a single image just gets thumbnailed (matches how a product
    banner places its one subject image), 2+ get tiled 2-per-row."""
    if len(images) == 1:
        thumb = images[0].copy()
        thumb.thumbnail(box)
        return thumb
    cols = 2
    rows = 2 if len(images) > 2 else 1
    cell_w, cell_h = box[0] // cols, box[1] // rows
    collage = Image.new("RGBA", box, (0, 0, 0, 0))
    for idx, image in enumerate(images[: cols * rows]):
        col, row = idx % cols, idx // cols
        thumb = image.copy()
        thumb.thumbnail((cell_w - 10, cell_h - 10))
        cx = col * cell_w + (cell_w - thumb.width) // 2
        cy = row * cell_h + (cell_h - thumb.height) // 2
        collage.alpha_composite(thumb, (cx, cy))
    return collage


def _make_category_banner(
    promotion: Promotion,
) -> tuple[Image.Image, list[Image.Image]] | None:
    category = promotion.category
    if category is None:
        return None
    representative_images = _category_representative_images(category)
    if representative_images:
        subject = _build_collage(representative_images, SUBJECT_BOX)
    elif category.image_path:
        # Fallback only when the category has no products with a usable
        # photo at all — category hero/icon images are curated assets, not
        # studio product photos, so no background-removal step for these.
        subject = _load_source_image(category.image_path)
    else:
        subject = None
    image = _compose(
        title=category.name,
        subject_image=subject,
        discount_label=_discount_label(promotion),
        old_price_text=None,
        new_price_text=None,
    )
    return image, representative_images


def _active_banner_promotions() -> list[Promotion]:
    return [
        p
        for p in get_active_promotions()
        # user is None: target and audience are independent now (see
        # promotions/models.py) — a promotion can be scope=product AND
        # targeted at one specific client at the same time. That kind of
        # private, per-client discount must never generate a public
        # homepage banner, regardless of its scope.
        if p.user_id is None
        and (
            (p.scope == Promotion.SCOPE_PRODUCT and p.product_id)
            or (p.scope == Promotion.SCOPE_CATEGORY and p.category_id)
        )
    ]


def _subject_hue(relative_paths: list[str]) -> int | None:
    """The main colour of the product cut-out(s) as a hue (0-359), so the
    carousel can pick a slide colour that contrasts with the product rather
    than one that swallows it (a teal paper box on a teal slide). None when
    the product is mostly white/grey/black - any slide colour works then."""
    import colorsys
    import math

    x = y = weight = 0.0
    total = 0
    for relative_path in relative_paths:
        path = Path(settings.MEDIA_ROOT) / relative_path
        try:
            image = Image.open(path).convert("RGBA")
        except OSError:
            continue
        image.thumbnail((48, 48))
        data = image.tobytes()
        for i in range(0, len(data), 4):
            r, g, b, a = data[i : i + 4]
            if a < 128:
                continue
            total += 1
            h, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if sat < 0.25 or val < 0.2:
                continue
            w = sat * val
            x += math.cos(h * 2 * math.pi) * w
            y += math.sin(h * 2 * math.pi) * w
            weight += w
    if total == 0 or weight / total < 0.12:
        return None
    return round(math.degrees(math.atan2(y, x))) % 360


def _write_manifest(active_promotions: list[Promotion]) -> None:
    banners = {
        b.promotion_id: b
        for b in Banner.objects.filter(
            promotion_id__in=[p.id for p in active_promotions]
        )
    }
    entries = []
    for promotion in active_promotions:
        banner = banners.get(promotion.id)
        if banner is None:
            continue
        subject_image = ""
        price = ""
        old_price = ""
        if promotion.scope == Promotion.SCOPE_PRODUCT:
            product = promotion.product
            target_url = f"/product/{product.slug}"
            title = product.name
            first = product.images.order_by("sort_order").first()
            subject_image = first.path if first else ""
            base = get_base_price(product)
            if base is not None:
                old_price = format_eur(base)
                price = format_eur(compute_promo_price(base, promotion, product))
        else:
            target_url = f"/category/{promotion.category.slug}"
            title = promotion.category.name
            subject_image = promotion.category.image_path or ""
        entries.append(
            {
                "id": str(promotion.id),
                "type": banner.banner_type,
                "image_path": banner.image_path,
                # The raw product/category picture and prices, so the
                # storefront can compose the banner live (the PNG above
                # stays as the fallback and for designs that want it).
                "subject_image": subject_image,
                # Background-removed cut-outs (1 for a product, up to 4
                # products from across the category) - what the carousel
                # actually shows; subject_image is only its fallback.
                "subject_images": banner.subject_paths or [],
                "subject_hue": _subject_hue(banner.subject_paths or []),
                "price": price,
                "old_price": old_price if old_price != price else "",
                "name": promotion.name,
                "ends_at": promotion.ends_at.isoformat() if promotion.ends_at else "",
                "target_url": target_url,
                "title": title,
                "discount_label": _discount_label(promotion),
            }
        )
    banners_dir = _banners_dir()
    banners_dir.mkdir(parents=True, exist_ok=True)
    (banners_dir / "manifest.json").write_text(
        json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def sync_banners() -> None:
    _banners_dir().mkdir(parents=True, exist_ok=True)
    active = _active_banner_promotions()
    active_ids = {p.id for p in active}

    # Banner's own post_delete signal (banners/signals.py) removes the PNG
    # file — this only needs to drop the row.
    Banner.objects.exclude(promotion_id__in=active_ids).delete()

    existing = {
        b.promotion_id: b for b in Banner.objects.filter(promotion_id__in=active_ids)
    }
    for promotion in active:
        banner = existing.get(promotion.id)
        # Regenerate only when new, or the promotion changed since the
        # banner was last rendered (name/price/discount edits) — not on
        # every ~10-minute beat tick for an already-current banner.
        if (
            banner is not None
            and banner.updated_at >= promotion.updated_at
            and banner.subject_paths is not None
            and (Path(settings.MEDIA_ROOT) / banner.image_path).exists()
        ):
            continue

        made = (
            _make_product_banner(promotion)
            if promotion.scope == Promotion.SCOPE_PRODUCT
            else _make_category_banner(promotion)
        )
        if made is None:
            continue
        image, cutouts = made

        relative_path = f"highlights/{promotion.id}.png"
        (Path(settings.MEDIA_ROOT) / relative_path).parent.mkdir(
            parents=True, exist_ok=True
        )
        image.save(Path(settings.MEDIA_ROOT) / relative_path, format="PNG")
        Banner.objects.update_or_create(
            promotion=promotion,
            defaults={
                "banner_type": promotion.scope,
                "image_path": relative_path,
                "subject_paths": _save_cutouts(promotion, cutouts),
            },
        )

    _write_manifest(active)
