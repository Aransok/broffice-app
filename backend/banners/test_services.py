import json
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import pytest
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone

from banners.models import Banner
from banners.services import sync_banners
from categories.models import Category
from products.models import Product
from promotions.models import Promotion

# Background removal actually invokes an ML model (slow, and downloads a
# ~176MB file on first-ever call) — irrelevant to testing the sync/manifest
# orchestration, so every test patches it out to an identity function.
_NO_OP_BG_REMOVAL = patch(
    "banners.services.remove_background", side_effect=lambda img: img
)


@pytest.fixture(autouse=True)
def _no_background_removal():
    with _NO_OP_BG_REMOVAL:
        yield


@pytest.fixture
def category(db):
    return Category.objects.create(
        external_id="cat-1", slug="test-cat", name="Test Category"
    )


@pytest.fixture
def product(db, category):
    return Product.objects.create(
        external_id="prod-1",
        slug="test-product",
        name="Test Product",
        category=category,
        price_bgn="100.00",
        client_price="100.00",
        admin_price="60.00",
    )


def _active_promotion(**kwargs):
    defaults = {
        "name": "Test promo",
        "discount_type": Promotion.TYPE_PERCENT,
        "value": Decimal(20),
        "active": True,
    }
    defaults.update(kwargs)
    return Promotion.objects.create(**defaults)


@pytest.mark.django_db
def test_sync_banners_creates_banner_for_product_promotion(product):
    promo = _active_promotion(scope=Promotion.SCOPE_PRODUCT, product=product)

    sync_banners()

    banner = Banner.objects.get(promotion=promo)
    assert banner.banner_type == Banner.TYPE_PRODUCT
    assert (Path(settings.MEDIA_ROOT) / banner.image_path).exists()

    manifest = json.loads(
        (Path(settings.MEDIA_ROOT) / "highlights" / "manifest.json").read_text()
    )
    assert len(manifest) == 1
    assert manifest[0]["title"] == product.name
    assert manifest[0]["target_url"] == f"/product/{product.slug}"
    assert manifest[0]["discount_label"] == "-20%"


@pytest.mark.django_db
def test_sync_banners_flat_promotion_label_is_eur_not_bgn(product):
    """The banner's price text used to be rendered straight from the
    internal BGN storage value - the site is EUR-only everywhere else, this
    was the one place still leaking BGN."""
    from common.currency import format_eur

    value = Decimal("19.56")  # ~ 10.00 EUR at the fixed BGN_PER_EUR rate
    _active_promotion(
        scope=Promotion.SCOPE_PRODUCT,
        product=product,
        discount_type=Promotion.TYPE_FLAT,
        value=value,
    )

    sync_banners()

    # encoding="utf-8" is required here (not just the default) - Path.
    # read_text() without it falls back to the OS locale's preferred
    # encoding, which is cp1252 on Windows dev machines and silently
    # mangles the euro sign on read even though services.py's own write
    # already specifies UTF-8 correctly. Linux (prod) defaults to UTF-8
    # either way, so this was only ever a local-test-environment trap.
    manifest = json.loads(
        (Path(settings.MEDIA_ROOT) / "highlights" / "manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert manifest[0]["discount_label"] == format_eur(value)
    assert "лв" not in manifest[0]["discount_label"]
    assert "лв" not in manifest[0]["discount_label"]


@pytest.mark.django_db
def test_sync_banners_creates_banner_for_category_promotion(category):
    promo = _active_promotion(scope=Promotion.SCOPE_CATEGORY, category=category)

    sync_banners()

    banner = Banner.objects.get(promotion=promo)
    assert banner.banner_type == Banner.TYPE_CATEGORY

    manifest = json.loads(
        (Path(settings.MEDIA_ROOT) / "highlights" / "manifest.json").read_text()
    )
    assert manifest[0]["target_url"] == f"/category/{category.slug}"


@pytest.mark.django_db
def test_sync_banners_skips_global_scoped_promotions(category):
    # global has no single product/category image to render.
    _active_promotion(scope=Promotion.SCOPE_GLOBAL)

    sync_banners()

    assert Banner.objects.count() == 0


@pytest.mark.django_db
def test_sync_banners_skips_client_targeted_promotions(db, product, category):
    # target and audience are independent now (promotions migration 0003) —
    # a promotion can be scope=product/category AND targeted at one client
    # at the same time. That must never generate a public homepage banner,
    # regardless of scope.
    client = User.objects.create_user(username="client1", password="x")
    _active_promotion(scope=Promotion.SCOPE_PRODUCT, product=product, user=client)
    _active_promotion(scope=Promotion.SCOPE_CATEGORY, category=category, user=client)

    sync_banners()

    assert Banner.objects.count() == 0
    manifest = json.loads(
        (Path(settings.MEDIA_ROOT) / "highlights" / "manifest.json").read_text()
    )
    assert manifest == []


@pytest.mark.django_db
def test_sync_banners_removes_banner_when_promotion_deactivated(product):
    promo = _active_promotion(scope=Promotion.SCOPE_PRODUCT, product=product)
    sync_banners()
    banner = Banner.objects.get(promotion=promo)
    image_path = Path(settings.MEDIA_ROOT) / banner.image_path
    assert image_path.exists()

    promo.active = False
    promo.save()
    sync_banners()

    assert not Banner.objects.filter(promotion=promo).exists()
    assert not image_path.exists()
    manifest = json.loads(
        (Path(settings.MEDIA_ROOT) / "highlights" / "manifest.json").read_text()
    )
    assert manifest == []


@pytest.mark.django_db
def test_sync_banners_removes_banner_when_promotion_deleted(product):
    promo = _active_promotion(scope=Promotion.SCOPE_PRODUCT, product=product)
    sync_banners()
    banner = Banner.objects.get(promotion=promo)
    image_path = Path(settings.MEDIA_ROOT) / banner.image_path
    assert image_path.exists()

    promo.delete()

    assert not Banner.objects.filter(promotion_id=promo.id).exists()
    assert not image_path.exists()


@pytest.mark.django_db
def test_sync_banners_excludes_future_and_expired_promotions(product, category):
    _active_promotion(
        scope=Promotion.SCOPE_PRODUCT,
        product=product,
        starts_at=timezone.now() + timedelta(days=1),
    )
    _active_promotion(
        scope=Promotion.SCOPE_CATEGORY,
        category=category,
        ends_at=timezone.now() - timedelta(days=1),
    )

    sync_banners()

    assert Banner.objects.count() == 0
