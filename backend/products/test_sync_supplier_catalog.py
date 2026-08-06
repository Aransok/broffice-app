from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from django.core.management.base import CommandError

from brands.models import Brand
from categories.models import Category
from products.management.commands.sync_supplier_catalog import Command
from products.models import Product, ProductImage, ProductSpecification


def _mock_response(payload: dict) -> MagicMock:
    response = MagicMock()
    response.json.return_value = payload
    response.raise_for_status.return_value = None
    return response


def _item(**overrides) -> dict:
    item = {
        "id": 272,
        "name": "Тест продукт",
        "description": "Описание",
        "brand": "Bic",
        "categories": [
            {"id": 1, "name": "Root", "parent_id": None},
            {"id": 2, "name": "Leaf", "parent_id": 1},
        ],
        "price": {"BGN": "1.00", "EUR": "0.51"},
        "RRP": {"BGN": "1.35", "EUR": "0.69"},
        "options": {},
        "photos": [],
    }
    item.update(overrides)
    return item


def _run_sync(settings, items: list[dict], *, max_pages: int | None = None) -> Command:
    settings.SUPPLIER_CATALOG_API_KEY = "test-key"
    payload = {"data": items, "links": {"next": None}}
    with patch(
        "products.management.commands.sync_supplier_catalog.requests.get",
        return_value=_mock_response(payload),
    ):
        command = Command()
        command.handle(max_pages=max_pages)
    return command


@pytest.mark.django_db
def test_command_requires_api_key(settings):
    settings.SUPPLIER_CATALOG_API_KEY = ""
    with pytest.raises(CommandError):
        Command().handle(max_pages=None)


@pytest.mark.django_db
def test_sync_creates_new_product_with_correct_field_mapping(settings):
    command = _run_sync(settings, [_item()])

    product = Product.objects.get(external_id="supplier-272")
    assert command.created_count == 1
    assert command.updated_count == 0
    # RRP -> customer-facing price, price -> admin-only cost.
    assert product.price_bgn == Decimal("1.35")
    assert product.admin_price == Decimal("1.00")
    # client_price seeded from RRP only on creation.
    assert product.client_price == Decimal("1.35")
    assert product.name == "Тест продукт"


@pytest.mark.django_db
def test_resync_updates_price_but_never_touches_client_price(settings):
    _run_sync(settings, [_item()])
    product = Product.objects.get(external_id="supplier-272")
    # Simulate a deliberate admin override that must survive re-syncs.
    product.client_price = Decimal("9.99")
    product.save(update_fields=["client_price"])

    command = _run_sync(settings, [_item(RRP={"BGN": "2.00", "EUR": "1.02"})])

    product.refresh_from_db()
    assert command.created_count == 0
    assert command.updated_count == 1
    assert product.price_bgn == Decimal("2.00")
    assert product.client_price == Decimal("9.99")


@pytest.mark.django_db
def test_resync_never_rewrites_slug(settings):
    _run_sync(settings, [_item()])
    product = Product.objects.get(external_id="supplier-272")
    Product.objects.filter(pk=product.pk).update(slug="a-manually-fixed-slug")

    _run_sync(settings, [_item(name="Съвсем различно име")])

    product.refresh_from_db()
    assert product.slug == "a-manually-fixed-slug"
    assert product.name == "Съвсем различно име"


@pytest.mark.django_db
def test_sync_builds_category_hierarchy_and_assigns_leaf(settings):
    _run_sync(settings, [_item()])

    root = Category.objects.get(external_id="1")
    leaf = Category.objects.get(external_id="2")
    assert leaf.parent_id == root.id

    product = Product.objects.get(external_id="supplier-272")
    assert product.category_id == leaf.id


@pytest.mark.django_db
def test_sync_reuses_existing_category_by_bare_numeric_id(settings):
    # Matches the legacy HTTrack import's own external_id convention (bare
    # numeric id, not "supplier-" prefixed) — must merge, not duplicate.
    pre_existing = Category.objects.create(
        external_id="2", slug="leaf-legacy", name="Leaf (legacy name)"
    )

    _run_sync(settings, [_item()])

    assert Category.objects.filter(external_id="2").count() == 1
    pre_existing.refresh_from_db()
    assert pre_existing.name == "Leaf"  # name updated, id/slug preserved
    assert pre_existing.slug == "leaf-legacy"


@pytest.mark.django_db
def test_sync_matches_brand_by_name_case_insensitive(settings):
    existing_brand = Brand.objects.create(
        external_id="legacy-bic", slug="bic", name="Bic"
    )

    _run_sync(settings, [_item(brand="BIC")])

    product = Product.objects.get(external_id="supplier-272")
    assert product.brand_id == existing_brand.id
    assert Brand.objects.filter(name__iexact="bic").count() == 1


@pytest.mark.django_db
def test_sync_replaces_specifications_and_images_on_resync(settings):
    _run_sync(
        settings,
        [
            _item(
                options=[{"name": "Цвят", "value": "Червен"}],
                photos=[
                    {"url": "https://example.com/a.jpg", "is_main": False},
                    {"url": "https://example.com/b.jpg", "is_main": True},
                ],
            )
        ],
    )
    product = Product.objects.get(external_id="supplier-272")
    assert ProductSpecification.objects.filter(product=product).count() == 1
    images = list(ProductImage.objects.filter(product=product).order_by("sort_order"))
    # is_main decides primary/first image, not API list order.
    assert images[0].path == "https://example.com/b.jpg"

    _run_sync(
        settings,
        [_item(options=[{"name": "Размер", "value": "M"}], photos=[])],
    )
    product.refresh_from_db()
    specs = list(ProductSpecification.objects.filter(product=product))
    assert len(specs) == 1
    assert specs[0].name == "Размер"
    assert ProductImage.objects.filter(product=product).count() == 0


@pytest.mark.django_db
def test_build_specifications_treats_zero_as_not_recorded():
    command = Command()
    specs = command._build_specifications(
        {"options": {}, "height": 0, "width": 120, "weight": None}
    )
    assert "Височина (мм)" not in specs
    assert specs["Ширина (мм)"] == 120
    assert "Тегло (кг)" not in specs


@pytest.mark.django_db
def test_sync_paginates_through_next_link(settings):
    settings.SUPPLIER_CATALOG_API_KEY = "test-key"
    page1 = {
        "data": [_item(id=1, name="Продукт 1")],
        "links": {"next": "https://supplier.example/api/page-2"},
    }
    page2 = {"data": [_item(id=2, name="Продукт 2")], "links": {"next": None}}

    with patch(
        "products.management.commands.sync_supplier_catalog.requests.get",
        side_effect=[_mock_response(page1), _mock_response(page2)],
    ) as mock_get:
        command = Command()
        command.handle(max_pages=None)

    assert mock_get.call_count == 2
    # The `next` link already carries its own query string.
    assert mock_get.call_args_list[1].kwargs["params"] is None
    assert command.created_count == 2
    assert Product.objects.filter(external_id="supplier-1").exists()
    assert Product.objects.filter(external_id="supplier-2").exists()


@pytest.mark.django_db
def test_sync_respects_max_pages(settings):
    settings.SUPPLIER_CATALOG_API_KEY = "test-key"
    page1 = {
        "data": [_item(id=1)],
        "links": {"next": "https://supplier.example/api/page-2"},
    }

    with patch(
        "products.management.commands.sync_supplier_catalog.requests.get",
        return_value=_mock_response(page1),
    ) as mock_get:
        command = Command()
        command.handle(max_pages=1)

    assert mock_get.call_count == 1
