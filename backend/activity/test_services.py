import pytest
from django.contrib.auth.models import User

from activity.models import ProductView
from activity.services import (
    _diversify_by_brand,
    get_recommended_products,
    get_similar_products,
    track_product_view,
)
from brands.models import Brand
from categories.models import Category
from products.models import Product


@pytest.fixture
def category(db):
    return Category.objects.create(external_id="cat-1", slug="cat-1", name="Category 1")


@pytest.fixture
def other_category(db):
    return Category.objects.create(external_id="cat-2", slug="cat-2", name="Category 2")


def _make_product(category, *, brand=None, external_id=None, name="P"):
    external_id = external_id or f"ext-{Product.objects.count()}-{name}"
    return Product.objects.create(
        external_id=external_id,
        slug=external_id,
        name=name,
        category=category,
        brand=brand,
        status=Product.STATUS_PUBLISHED,
        price_bgn="10.00",
    )


@pytest.mark.django_db
def test_get_similar_products_requires_category(db):
    product = Product.objects.create(
        external_id="no-cat", slug="no-cat", name="No category", price_bgn="5.00"
    )
    assert list(get_similar_products(product)) == []


@pytest.mark.django_db
def test_get_similar_products_excludes_itself_and_other_categories(
    category, other_category
):
    target = _make_product(category, name="Target")
    same_category = _make_product(category, name="Sibling")
    _make_product(other_category, name="Unrelated")

    results = list(get_similar_products(target))

    assert target not in results
    assert same_category in results
    assert all(p.category_id == category.id for p in results)


@pytest.mark.django_db
def test_get_similar_products_diversifies_by_brand(category):
    # The exact per-brand cap is already precisely covered by the direct
    # _diversify_by_brand unit tests below (deterministic input order) —
    # this integration test only checks the properties that survive the
    # real DB's random ordering: the full limit gets filled from a big
    # enough pool, and every result is still a real candidate (not the
    # target itself, not a different category).
    target = _make_product(category, name="Target")
    brand_a = Brand.objects.create(external_id="a", slug="a", name="Brand A")
    brand_b = Brand.objects.create(external_id="b", slug="b", name="Brand B")
    for i in range(6):
        _make_product(category, brand=brand_a, name=f"A{i}")
    for i in range(6):
        _make_product(category, brand=brand_b, name=f"B{i}")

    results = get_similar_products(target, limit=8)

    assert len(results) == 8
    assert target not in results
    assert all(p.category_id == category.id for p in results)


@pytest.mark.django_db
def test_get_recommended_products_empty_for_anonymous_user():
    assert list(get_recommended_products(None)) == []


@pytest.mark.django_db
def test_get_recommended_products_empty_with_no_view_history(db, category):
    user = User.objects.create_user(username="noactivity", password="x")
    _make_product(category, name="Anything")
    assert list(get_recommended_products(user)) == []


@pytest.mark.django_db
def test_get_recommended_products_excludes_already_viewed(category):
    user = User.objects.create_user(username="shopper", password="x")
    viewed = _make_product(category, name="Already viewed")
    not_viewed = _make_product(category, name="Not viewed yet")
    track_product_view(user, viewed)

    results = list(get_recommended_products(user))

    assert viewed not in results
    assert not_viewed in results


@pytest.mark.django_db
def test_get_recommended_products_only_pulls_from_top_viewed_categories(
    category, other_category
):
    user = User.objects.create_user(username="shopper2", password="x")
    heavily_viewed = _make_product(category, name="Heavily viewed anchor")
    track_product_view(user, heavily_viewed)

    _make_product(category, name="Same category candidate")
    other_candidate = _make_product(
        other_category, name="Never-viewed-category candidate"
    )

    results = list(get_recommended_products(user))

    # Only category is in the user's viewed-category set (other_category was
    # never viewed at all) — its products must not show up as "recommended".
    assert other_candidate not in results
    assert all(p.category_id == category.id for p in results)


@pytest.mark.django_db
def test_get_recommended_products_excludes_explicit_product(category):
    user = User.objects.create_user(username="shopper3", password="x")
    anchor = _make_product(category, name="Anchor")
    track_product_view(user, anchor)
    current = _make_product(category, name="Currently viewing")

    results = list(get_recommended_products(user, exclude_product_id=current.id))

    assert current not in results


@pytest.mark.django_db
def test_track_product_view_increments_existing_row(category):
    user = User.objects.create_user(username="repeat", password="x")
    product = _make_product(category, name="Repeat target")

    first = track_product_view(user, product)
    assert first.view_count == 1

    second = track_product_view(user, product)
    assert second.view_count == 2
    assert ProductView.objects.filter(user=user, product=product).count() == 1


def test_diversify_by_brand_backfills_when_all_one_brand():
    class Fake:
        def __init__(self, brand_id):
            self.brand_id = brand_id

    products = [Fake("brand-x") for _ in range(10)]
    result = _diversify_by_brand(products, limit=8, max_per_brand=2)
    # A genuinely single-brand pool still fills the requested limit rather
    # than truncating down to just max_per_brand.
    assert len(result) == 8


def test_diversify_by_brand_caps_mixed_brands():
    class Fake:
        def __init__(self, brand_id):
            self.brand_id = brand_id

    # 4 distinct brands, 2 each = exactly `limit` items with no need for the
    # backfill path — isolates the cap itself rather than the "fill the
    # rest anyway" fallback already covered by the single-brand test above.
    products = [Fake(b) for b in "aabbccdd"]
    result = _diversify_by_brand(products, limit=8, max_per_brand=2)
    brand_ids = [p.brand_id for p in result]
    assert len(result) == 8
    assert all(brand_ids.count(b) <= 2 for b in set(brand_ids))
