from decimal import Decimal

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from pricing.services import get_effective_price
from products.models import Product
from promotions.models import Promotion


def make_product(cost="2.00", price="5.00", slug="paper"):
    return Product.objects.create(
        external_id=f"x-{slug}",
        slug=slug,
        name="Хартия",
        price_bgn=Decimal(price),
        admin_price=Decimal(cost) if cost is not None else None,
        status=Product.STATUS_PUBLISHED,
    )


@pytest.fixture
def client_user(db):
    return User.objects.create_user(username="client", password="clientpass")


@pytest.mark.django_db
def test_cost_plus_builds_price_up_from_cost(client_user):
    product = make_product()
    Promotion.objects.create(
        name="Доставна +10%",
        discount_type=Promotion.TYPE_COST_PLUS,
        value=Decimal(10),
        scope=Promotion.SCOPE_PRODUCT,
        product=product,
        user=client_user,
    )
    result = get_effective_price(product, client_user)
    assert result.price == Decimal("2.20")
    assert result.source == "promotion"
    # Other clients keep the normal price.
    other = User.objects.create_user(username="other", password="x")
    assert get_effective_price(product, other).price == Decimal("5.00")


@pytest.mark.django_db
def test_cost_plus_never_above_normal_price_or_without_cost(client_user):
    expensive = make_product(cost="4.80", price="5.00", slug="a")
    no_cost = make_product(cost=None, price="5.00", slug="b")
    Promotion.objects.create(
        name="Всичко на доставна +10%",
        discount_type=Promotion.TYPE_COST_PLUS,
        value=Decimal(10),
        scope=Promotion.SCOPE_GLOBAL,
        user=client_user,
    )
    # 4.80 + 10% = 5.28 is above 5.00: the client just pays the normal price.
    assert get_effective_price(expensive, client_user).source == "base"
    assert get_effective_price(expensive, client_user).price == Decimal("5.00")
    assert get_effective_price(no_cost, client_user).source == "base"


@pytest.mark.django_db
def test_cost_plus_zero_percent_is_cost(client_user):
    product = make_product()
    Promotion.objects.create(
        name="На доставна",
        discount_type=Promotion.TYPE_COST_PLUS,
        value=Decimal(0),
        scope=Promotion.SCOPE_PRODUCT,
        product=product,
        user=client_user,
    )
    assert get_effective_price(product, client_user).price == Decimal("2.00")


@pytest.mark.django_db
def test_admin_api_accepts_cost_plus_and_rejects_negative(client_user):
    admin = User.objects.create_user(
        username="admin", password="x", is_staff=True, is_superuser=True
    )
    product = make_product()
    api = APIClient()
    api.force_authenticate(user=admin)
    payload = {
        "name": "Доставна +10%",
        "discount_type": "cost_plus",
        "value": "10.00",
        "scope": "product",
        "product": str(product.id),
        "user": client_user.id,
    }
    resp = api.post("/api/v1/admin/promotions/", payload, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["value"] == "10.00"
    payload["value"] = "-5"
    resp = api.post("/api/v1/admin/promotions/", payload, format="json")
    assert resp.status_code == 400
