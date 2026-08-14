from decimal import Decimal

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from categories.models import Category
from orders.models import Order
from products.models import Product, ProductImage


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="admin", password="adminpass", is_staff=True, is_superuser=True
    )


@pytest.fixture
def sample_product(db):
    cat = Category.objects.create(
        external_id="1", slug="test-cat", name="Test Category"
    )
    return Product.objects.create(
        external_id="272",
        slug="test-product",
        name="Test Product",
        category=cat,
        price_bgn="1.35",
        client_price="1.35",
        admin_price="1.00",
    )


@pytest.mark.django_db
def test_public_config(api_client):
    resp = api_client.get("/api/v1/config/")
    assert resp.status_code == 200
    assert resp.data["vat_rate_percent"] == "20.00"
    assert resp.data["prices_include_vat"] is False
    assert resp.data["company_name"] == "БРАЯ 2020 ЕООД"
    assert resp.data["company_eik"] == "206313018"
    # No VAT number configured -> never a placeholder or invented value.
    assert resp.data["company_vat_number"] == ""


@pytest.mark.django_db
def test_home_sections_best_sellers_from_confirmed_orders_only(
    api_client, admin_user, sample_product
):
    cat = Category.objects.filter(external_id="1").first()
    other = Product.objects.create(
        external_id="273",
        slug="other-product",
        name="Other Product",
        category=cat,
        price_bgn="5.00",
        client_price="5.00",
    )

    # sample_product: a confirmed order for qty 3 -> should count as a best seller.
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 3}],
        },
        format="json",
    )
    number = resp.data["number"]
    api_client.force_authenticate(user=admin_user)
    api_client.post(f"/api/v1/admin/orders/{number}/confirm/")
    api_client.force_authenticate(user=None)

    # other: a pending (never confirmed) order -> must NOT count as a best seller.
    api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer2@example.com",
            "items": [{"product_id": str(other.id), "quantity": 10}],
        },
        format="json",
    )

    resp = api_client.get("/api/v1/home-sections/")
    assert resp.status_code == 200
    best_seller_ids = {p["external_id"] for p in resp.data["best_sellers"]}
    assert "272" in best_seller_ids
    assert "273" not in best_seller_ids

    new_ids = {p["external_id"] for p in resp.data["new_products"]}
    assert "272" in new_ids and "273" in new_ids


@pytest.mark.django_db
def test_home_sections_promotions_from_active_promotions(api_client, sample_product):
    from promotions.models import Promotion

    Promotion.objects.create(
        name="Product promo",
        discount_type="percent",
        value="10.00",
        scope="product",
        product=sample_product,
    )
    resp = api_client.get("/api/v1/home-sections/")
    assert resp.status_code == 200
    promo_ids = {p["external_id"] for p in resp.data["promotions"]}
    assert "272" in promo_ids


@pytest.mark.django_db
def test_pages_seeded_and_public(api_client):
    resp = api_client.get("/api/v1/pages/about-us/")
    assert resp.status_code == 200
    assert resp.data["title"] == "За нас"
    assert "БРАЯ 2020 ЕООД" in resp.data["body"]

    for slug in (
        "privacy-policy",
        "cookie-policy",
        "terms-and-conditions",
        "returns-and-withdrawal",
    ):
        resp = api_client.get(f"/api/v1/pages/{slug}/")
        assert resp.status_code == 200
        # No unresolved {{TOKEN}} placeholders should ever reach a customer.
        assert "{{" not in resp.data["body"]


@pytest.mark.django_db
def test_page_body_omits_vat_number_when_unconfigured(api_client, settings):
    settings.COMPANY_VAT_NUMBER = ""
    resp = api_client.get("/api/v1/pages/terms-and-conditions/")
    assert "ДДС номер" not in resp.data["body"]


@pytest.mark.django_db
def test_page_body_shows_vat_number_when_configured(api_client, settings):
    settings.COMPANY_VAT_NUMBER = "BG206313018"
    resp = api_client.get("/api/v1/pages/terms-and-conditions/")
    assert "ДДС номер: BG206313018" in resp.data["body"]


@pytest.mark.django_db
def test_contact_form_sends_email(api_client, mailoutbox):
    resp = api_client.post(
        "/api/v1/contact/",
        {
            "name": "Иван Иванов",
            "email": "ivan@example.com",
            "phone": "0888123456",
            "subject": "Запитване за наличност",
            "message": "Здравейте, имате ли наличност от X?",
        },
    )
    assert resp.status_code == 200
    assert len(mailoutbox) == 1
    assert mailoutbox[0].to == ["doanchetoidriz@gmail.com", "broffice.bg@gmail.com"]
    assert "Иван Иванов" in mailoutbox[0].body


@pytest.mark.django_db
def test_contact_form_requires_valid_fields(api_client):
    resp = api_client.post(
        "/api/v1/contact/", {"name": "", "email": "not-an-email", "message": ""}
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_category_tree(api_client):
    root = Category.objects.create(external_id="root-1", slug="root-1", name="Root")
    child = Category.objects.create(
        external_id="child-1", slug="child-1", name="Child", parent=root
    )
    Category.objects.create(
        external_id="leaf-1", slug="leaf-1", name="Leaf", parent=child
    )
    resp = api_client.get("/api/v1/categories/tree/")
    assert resp.status_code == 200
    root_node = next(n for n in resp.data if n["external_id"] == "root-1")
    assert root_node["children"][0]["external_id"] == "child-1"
    assert root_node["children"][0]["children"][0]["external_id"] == "leaf-1"


@pytest.mark.django_db
def test_category_page_shows_products_from_descendant_categories(api_client):
    """A mid-level category (only grandchildren have products assigned
    directly) must still show all of them - previously an exact category_id
    match meant it showed nothing until you clicked into the exact leaf."""
    root = Category.objects.create(
        external_id="paper-root", slug="paper-root", name="Хартия"
    )
    mid = Category.objects.create(
        external_id="paper-mid",
        slug="paper-mid",
        name="Хартиени кубчета и индекси",
        parent=root,
    )
    leaf = Category.objects.create(
        external_id="paper-leaf", slug="paper-leaf", name="Хартиени кубчета", parent=mid
    )
    Product.objects.create(
        external_id="leaf-product",
        slug="leaf-product",
        name="Leaf Product",
        category=leaf,
        client_price="1.00",
    )
    other_root = Category.objects.create(
        external_id="other-root", slug="other-root", name="Other"
    )
    Product.objects.create(
        external_id="unrelated-product",
        slug="unrelated-product",
        name="Unrelated Product",
        category=other_root,
        client_price="1.00",
    )

    resp = api_client.get("/api/v1/products/", {"category__slug": "paper-mid"})
    assert resp.status_code == 200
    ids = {p["external_id"] for p in resp.data["results"]}
    assert "leaf-product" in ids
    assert "unrelated-product" not in ids

    resp_root = api_client.get("/api/v1/products/", {"category__slug": "paper-root"})
    assert "leaf-product" in {p["external_id"] for p in resp_root.data["results"]}


@pytest.mark.django_db
def test_category_promotion_applies_to_descendant_category_only(api_client):
    """A category-scoped promotion must cover products in that category's
    subtree (children/grandchildren), but never a sibling category - the
    fix for "paper cubes promo doesn't show" must not become "promo leaks
    into unrelated categories" instead."""
    from promotions.models import Promotion

    chemicals = Category.objects.create(
        external_id="chemicals", slug="chemicals", name="Химия"
    )
    chemicals_sub = Category.objects.create(
        external_id="chemicals-sub",
        slug="chemicals-sub",
        name="Препарати",
        parent=chemicals,
    )
    glues = Category.objects.create(external_id="glues", slug="glues", name="Лепила")

    Product.objects.create(
        external_id="chemical-product",
        slug="chemical-product",
        name="Chemical Product",
        category=chemicals_sub,
        client_price="10.00",
    )
    Product.objects.create(
        external_id="glue-product",
        slug="glue-product",
        name="Glue Product",
        category=glues,
        client_price="10.00",
    )

    Promotion.objects.create(
        name="Chemicals -10%",
        discount_type="percent",
        value="10.00",
        scope="category",
        category=chemicals,
    )

    resp = api_client.get("/api/v1/products/")
    by_id = {p["external_id"]: p for p in resp.data["results"]}
    assert by_id["chemical-product"]["promo_price_bgn"] == "9.00"
    assert by_id["glue-product"]["promo_price_bgn"] is None


@pytest.mark.django_db
def test_admin_promotions_list_shows_category_and_product_names(
    api_client, admin_user, sample_product
):
    from promotions.models import Promotion

    cat = Category.objects.filter(external_id="1").first()
    Promotion.objects.create(
        name="Category promo",
        discount_type="percent",
        value="10.00",
        scope="category",
        category=cat,
    )
    Promotion.objects.create(
        name="Product promo",
        discount_type="percent",
        value="10.00",
        scope="product",
        product=sample_product,
    )

    api_client.force_authenticate(user=admin_user)
    resp = api_client.get("/api/v1/admin/promotions/")
    assert resp.status_code == 200
    by_name = {p["name"]: p for p in resp.data["results"]}
    assert by_name["Category promo"]["category_name"] == cat.name
    assert by_name["Product promo"]["product_name"] == sample_product.name


@pytest.mark.django_db
def test_order_numbers_are_sequential_plain_integers(api_client, sample_product):
    numbers = []
    for _ in range(3):
        resp = api_client.post(
            "/api/v1/orders/",
            {
                "customer_email": "buyer@example.com",
                "items": [{"product_external_id": "272", "quantity": 1}],
            },
            format="json",
        )
        assert resp.status_code == 201
        numbers.append(resp.data["number"])

    assert all(n.isdigit() for n in numbers)
    ints = [int(n) for n in numbers]
    assert ints == sorted(ints)
    assert len(set(ints)) == 3  # no duplicates


@pytest.mark.django_db
def test_order_item_records_cost_price_for_profit_tracking(api_client, sample_product):
    """Regression guard: cost_price_bgn (and therefore profit_bgn) must
    actually get saved on the order item, not just computed and discarded."""
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 2}],
        },
        format="json",
    )
    assert resp.status_code == 201
    order = Order.objects.get(number=resp.data["number"])
    item = order.items.get()
    assert item.cost_price_bgn == Decimal("1.00")
    assert item.profit_bgn == (Decimal("1.35") - Decimal("1.00")) * 2
    assert order.total_profit_bgn == item.profit_bgn


@pytest.mark.django_db
def test_admin_reprice_applies_a_promotion_created_after_checkout(
    api_client, admin_user, sample_product
):
    from promotions.models import Promotion

    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
        },
        format="json",
    )
    number = resp.data["number"]
    order = Order.objects.get(number=number)
    original_total = order.total_bgn
    assert order.items.get().discount_label == ""

    # A promotion created only after the order was already placed.
    Promotion.objects.create(
        name="Late promo",
        discount_type="percent",
        value="50.00",
        scope="product",
        product=sample_product,
    )

    api_client.force_authenticate(user=admin_user)
    resp = api_client.post(f"/api/v1/admin/orders/{number}/reprice/")
    assert resp.status_code == 200

    order.refresh_from_db()
    item = order.items.get()
    assert item.discount_label != ""
    assert item.unit_price == Decimal(
        "0.68"
    )  # 1.35 * 0.5 -> 0.675 -> round-half-even 0.68
    assert order.total_bgn < original_total


@pytest.mark.django_db
def test_admin_reprice_rejects_a_non_pending_order(
    api_client, admin_user, sample_product
):
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
        },
        format="json",
    )
    number = resp.data["number"]
    api_client.force_authenticate(user=admin_user)
    api_client.post(f"/api/v1/admin/orders/{number}/confirm/")

    resp = api_client.post(f"/api/v1/admin/orders/{number}/reprice/")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_admin_reject_sends_customer_email(api_client, admin_user, sample_product):
    """Previously reject() sent no email at all - the customer had no idea
    their order was declined."""
    from django.core import mail

    from orders.models import EmailLog

    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
        },
        format="json",
    )
    number = resp.data["number"]

    api_client.force_authenticate(user=admin_user)
    resp = api_client.post(
        f"/api/v1/admin/orders/{number}/reject/", {"reason": "Продуктът е изчерпан"}
    )
    assert resp.status_code == 200
    assert resp.data["status"] == "rejected"
    assert resp.data["reject_reason"] == "Продуктът е изчерпан"

    # Placing the order already sent one admin-notification email - the
    # rejection email is the customer-addressed one on top of that.
    customer_emails = [m for m in mail.outbox if m.to == ["buyer@example.com"]]
    assert len(customer_emails) == 1

    log = EmailLog.objects.get(
        order__number=number, email_type=EmailLog.TYPE_CUSTOMER_REJECTION
    )
    assert log.status == EmailLog.STATUS_SENT
    assert "Продуктът е изчерпан" in log.body_preview


@pytest.mark.django_db
def test_admin_price_hidden_from_public(api_client, admin_user, sample_product):
    anon = api_client.get("/api/v1/products/")
    listed = next(p for p in anon.data["results"] if p["external_id"] == "272")
    assert listed["admin_price"] is None
    assert listed["client_price"] == "1.35"

    detail_anon = api_client.get(f"/api/v1/products/{sample_product.slug}/")
    assert detail_anon.data["admin_price"] is None

    api_client.force_authenticate(user=admin_user)
    detail_admin = api_client.get(f"/api/v1/products/{sample_product.slug}/")
    assert detail_admin.data["admin_price"] == "1.00"


@pytest.mark.django_db
def test_product_list_shows_is_favorited_per_user(api_client, sample_product):
    anon = api_client.get("/api/v1/products/")
    listed = next(p for p in anon.data["results"] if p["external_id"] == "272")
    assert listed["is_favorited"] is False

    user = User.objects.create_user(username="fan-list", password="pass12345")
    api_client.force_authenticate(user=user)
    api_client.post("/api/v1/favorites/", {"product_id": sample_product.id})

    resp = api_client.get("/api/v1/products/")
    listed = next(p for p in resp.data["results"] if p["external_id"] == "272")
    assert listed["is_favorited"] is True


@pytest.mark.django_db
def test_promotion_global_percent_applies(api_client, sample_product):
    from promotions.models import Promotion

    Promotion.objects.create(
        name="Site-wide 10%", discount_type="percent", value="10.00", scope="global"
    )
    resp = api_client.get("/api/v1/products/")
    listed = next(p for p in resp.data["results"] if p["external_id"] == "272")
    # base client_price is 1.35 -> 10% off = 1.215 -> quantized to 1.22 (round-half-even)
    assert listed["promo_price_bgn"] == "1.22"


@pytest.mark.django_db
def test_individual_price_overrides_promotion(api_client, sample_product):
    """Priority rule: a customer's individual price must win over any
    promotion (global/category/product), never stack, never get overwritten."""
    from pricing.models import AdminPriceOverride
    from promotions.models import Promotion

    Promotion.objects.create(
        name="Site-wide 50%", discount_type="percent", value="50.00", scope="global"
    )
    vip = User.objects.create_user(username="vip-price", password="vippass")
    AdminPriceOverride.objects.create(
        product=sample_product, user=vip, client_price="1.10"
    )

    api_client.force_authenticate(user=vip)
    resp = api_client.get("/api/v1/products/")
    listed = next(p for p in resp.data["results"] if p["external_id"] == "272")
    # Individual price (1.10) must win, NOT the 50% global promo (which would be 0.68).
    assert listed["promo_price_bgn"] == "1.10"

    # A different, non-VIP user still gets the promotion, not the VIP's price.
    other = User.objects.create_user(username="not-vip", password="pass12345")
    api_client.force_authenticate(user=other)
    resp2 = api_client.get("/api/v1/products/")
    listed2 = next(p for p in resp2.data["results"] if p["external_id"] == "272")
    assert listed2["promo_price_bgn"] == "0.68"


@pytest.mark.django_db
def test_promotion_client_targeted_global_only_applies_to_that_user(
    api_client, sample_product
):
    """A client-targeted, no-product/no-category promotion (target=global +
    user=X) is the new equivalent of the old scope="user" with no product —
    "everything for this client" — see promotions migration 0003."""
    from promotions.models import Promotion

    target_user = User.objects.create_user(username="vip", password="vippass")
    Promotion.objects.create(
        name="VIP flat price",
        discount_type="flat",
        value="0.50",  # flat = the resulting price itself, not an amount off
        scope="global",
        user=target_user,
    )

    anon = api_client.get("/api/v1/products/")
    listed_anon = next(p for p in anon.data["results"] if p["external_id"] == "272")
    assert listed_anon["promo_price_bgn"] is None

    api_client.force_authenticate(user=target_user)
    listed_vip = next(
        p
        for p in api_client.get("/api/v1/products/").data["results"]
        if p["external_id"] == "272"
    )
    assert listed_vip["promo_price_bgn"] == "0.50"


@pytest.mark.django_db
def test_promotion_target_and_audience_are_independent(api_client, sample_product):
    """The actual new capability: a promotion can target one specific
    product AND one specific client at the same time — previously
    impossible (scope="product" and scope="user" were mutually exclusive)."""
    from categories.models import Category
    from products.models import Product
    from promotions.models import Promotion

    other_category = Category.objects.create(
        external_id="99", slug="other-cat", name="Other Category"
    )
    Product.objects.create(
        external_id="999",
        slug="other-product",
        name="Other Product",
        category=other_category,
        price_bgn="10.00",
        client_price="10.00",
    )
    target_user = User.objects.create_user(username="vip2", password="vippass2")
    other_user = User.objects.create_user(username="not-vip2", password="pass12345")

    Promotion.objects.create(
        name="Product+client discount",
        discount_type="percent",
        value="20.00",
        scope="product",
        product=sample_product,
        user=target_user,
    )

    def promo_price_for(user, product_external_id):
        api_client.force_authenticate(user=user)
        listed = next(
            p
            for p in api_client.get("/api/v1/products/").data["results"]
            if p["external_id"] == product_external_id
        )
        return listed["promo_price_bgn"]

    # Right client, right product -> discount applies.
    assert promo_price_for(target_user, "272") == "1.08"
    # Right client, wrong product -> no discount (target didn't match).
    assert promo_price_for(target_user, "999") is None
    # Wrong client, right product -> no discount (audience didn't match).
    assert promo_price_for(other_user, "272") is None


@pytest.mark.django_db
def test_admin_user_search(api_client, admin_user):
    User.objects.create_user(username="findme", password="pass12345")
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get("/api/v1/admin/users/", {"search": "findme"})
    assert resp.status_code == 200
    assert any(u["username"] == "findme" for u in resp.data)


@pytest.mark.django_db
def test_admin_price_override_crud_requires_admin(api_client, sample_product):
    customer = User.objects.create_user(username="cust1", password="pass12345")
    resp = api_client.post(
        "/api/v1/admin/price-overrides/",
        {
            "product": str(sample_product.id),
            "user": customer.id,
            "client_price": "0.99",
        },
    )
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_admin_price_override_crud(api_client, admin_user, sample_product):
    customer = User.objects.create_user(username="cust2", password="pass12345")
    api_client.force_authenticate(user=admin_user)
    create = api_client.post(
        "/api/v1/admin/price-overrides/",
        {
            "product": str(sample_product.id),
            "user": customer.id,
            "client_price": "0.99",
        },
    )
    assert create.status_code == 201, create.data
    assert create.data["product_name"] == sample_product.name
    assert create.data["username"] == "cust2"


@pytest.mark.django_db
def test_product_list(api_client, sample_product):
    resp = api_client.get("/api/v1/products/")
    assert resp.status_code == 200
    assert resp.data["count"] >= 1
    listed = next(p for p in resp.data["results"] if p["external_id"] == "272")
    assert listed["primary_image"] is None


@pytest.mark.django_db
def test_product_list_primary_image(api_client, sample_product):
    ProductImage.objects.create(
        product=sample_product, path="image/product/b.png", sort_order=1
    )
    ProductImage.objects.create(
        product=sample_product, path="image/product/a.png", sort_order=0
    )
    resp = api_client.get("/api/v1/products/")
    assert resp.status_code == 200
    listed = next(p for p in resp.data["results"] if p["external_id"] == "272")
    assert listed["primary_image"] == "image/product/a.png"


@pytest.mark.django_db
def test_admin_products_requires_auth(api_client, sample_product):
    resp = api_client.get("/api/v1/admin/products/")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_admin_products_ok(api_client, admin_user, sample_product):
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get("/api/v1/admin/products/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_admin_products_ordering_by_profit(api_client, admin_user):
    cat = Category.objects.create(external_id="9", slug="profit-cat", name="Profit Cat")
    low = Product.objects.create(
        external_id="low",
        slug="low-profit",
        name="Low Profit",
        category=cat,
        price_bgn="10.00",
        client_price="10.00",
        admin_price="9.00",
    )
    high = Product.objects.create(
        external_id="high",
        slug="high-profit",
        name="High Profit",
        category=cat,
        price_bgn="50.00",
        client_price="50.00",
        admin_price="5.00",
    )
    api_client.force_authenticate(user=admin_user)

    resp = api_client.get("/api/v1/admin/products/", {"ordering": "profit"})
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.data["results"]]
    assert ids.index(str(low.id)) < ids.index(str(high.id))

    resp = api_client.get("/api/v1/admin/products/", {"ordering": "-profit"})
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.data["results"]]
    assert ids.index(str(high.id)) < ids.index(str(low.id))


@pytest.mark.django_db
def test_admin_products_zero_price_filter(api_client, admin_user):
    cat = Category.objects.create(
        external_id="10", slug="zero-price-cat", name="Zero Price Cat"
    )
    zero = Product.objects.create(
        external_id="zero",
        slug="zero-price",
        name="Zero Price",
        category=cat,
        client_price="0.00",
    )
    missing = Product.objects.create(
        external_id="missing", slug="missing-price", name="Missing Price", category=cat
    )
    priced = Product.objects.create(
        external_id="priced",
        slug="real-price",
        name="Real Price",
        category=cat,
        client_price="9.99",
    )
    api_client.force_authenticate(user=admin_user)

    resp = api_client.get("/api/v1/admin/products/", {"zero_price": "1"})
    assert resp.status_code == 200
    ids = {p["id"] for p in resp.data["results"]}
    assert ids == {str(zero.id), str(missing.id)}
    assert str(priced.id) not in ids

    resp = api_client.get("/api/v1/admin/products/")
    ids = {p["id"] for p in resp.data["results"]}
    assert str(priced.id) in ids


@pytest.mark.django_db
def test_admin_product_create_requires_auth(api_client):
    resp = api_client.post("/api/v1/admin/products/", {"name": "New Product"})
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_admin_product_crud(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    create = api_client.post(
        "/api/v1/admin/products/",
        {"name": "Admin Created Product", "price_bgn": "12.50", "admin_price": "8.00"},
    )
    assert create.status_code == 201, create.data
    assert create.data["slug"] == "admin-created-product"
    assert create.data["external_id"].startswith("manual-")
    assert create.data["admin_price"] == "8.00"
    product_id = create.data["id"]

    update = api_client.patch(
        f"/api/v1/admin/products/{product_id}/",
        {"price_bgn": "15.00", "admin_price": "9.50"},
    )
    assert update.status_code == 200
    assert update.data["price_bgn"] == "15.00"
    assert update.data["admin_price"] == "9.50"
    assert update.data["slug"] == "admin-created-product"

    delete = api_client.delete(f"/api/v1/admin/products/{product_id}/")
    assert delete.status_code == 204
    # Soft delete: the row survives (so historical orders referencing it
    # never break) but is archived, and disappears from the public catalog.
    product = Product.objects.get(id=product_id)
    assert product.status == Product.STATUS_ARCHIVED

    api_client.force_authenticate(user=None)
    public = api_client.get("/api/v1/products/")
    assert not any(p["id"] == product_id for p in public.data["results"])


@pytest.mark.django_db
def test_admin_product_image_upload_and_delete(
    api_client, admin_user, sample_product, tmp_path, settings
):
    from django.core.files.uploadedfile import SimpleUploadedFile

    settings.MEDIA_ROOT = str(tmp_path)
    api_client.force_authenticate(user=admin_user)

    fake_image = SimpleUploadedFile(
        "test.png", b"fake-image-bytes", content_type="image/png"
    )
    upload = api_client.post(
        f"/api/v1/admin/products/{sample_product.id}/images/",
        {"images": [fake_image]},
        format="multipart",
    )
    assert upload.status_code == 201, upload.data
    assert len(upload.data) == 1
    image_id = upload.data[0]["id"]
    assert sample_product.images.count() == 1

    delete = api_client.delete(
        f"/api/v1/admin/products/{sample_product.id}/images/{image_id}/"
    )
    assert delete.status_code == 204
    assert sample_product.images.count() == 0


@pytest.mark.django_db
def test_login_logout_flow(api_client, admin_user):
    bad = api_client.post(
        "/api/v1/auth/login/", {"username": "admin", "password": "wrong"}
    )
    assert bad.status_code == 400

    ok = api_client.post(
        "/api/v1/auth/login/", {"username": "admin", "password": "adminpass"}
    )
    assert ok.status_code == 200
    assert ok.data["username"] == "admin"

    me = api_client.get("/api/v1/me/")
    assert me.status_code == 200

    out = api_client.post("/api/v1/auth/logout/")
    assert out.status_code == 204

    me_after = api_client.get("/api/v1/me/")
    assert me_after.status_code in (401, 403)


@pytest.mark.django_db
def test_register_creates_account_reusing_user_model_and_logs_in(api_client):
    resp = api_client.post(
        "/api/v1/auth/register/",
        {
            "first_name": "Иван",
            "last_name": "Иванов",
            "email": "newcustomer@example.com",
            "phone": "0888111222",
            "password": "Str0ngPassw0rd!",
            "password_confirm": "Str0ngPassw0rd!",
            "terms_accepted": True,
        },
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["email"] == "newcustomer@example.com"
    assert resp.data["first_name"] == "Иван"
    assert resp.data["phone"] == "0888111222"

    # Reuses the exact same User model — no second account system.
    user = User.objects.get(email="newcustomer@example.com")
    assert user.first_name == "Иван"
    assert user.check_password("Str0ngPassw0rd!")

    from accounts.models import Profile

    profile = Profile.objects.get(user=user)
    assert profile.phone == "0888111222"
    assert profile.terms_accepted_at is not None
    # Never falsely mark an unverified account as verified.
    assert profile.email_verified is False

    # Auto-logged-in after registration.
    me = api_client.get("/api/v1/me/")
    assert me.status_code == 200
    assert me.data["email"] == "newcustomer@example.com"


@pytest.mark.django_db
def test_register_rejects_duplicate_email(api_client):
    User.objects.create_user(
        username="existing@example.com",
        email="existing@example.com",
        password="pass12345",
    )
    resp = api_client.post(
        "/api/v1/auth/register/",
        {
            "first_name": "Test",
            "email": "existing@example.com",
            "phone": "0888000000",
            "password": "Str0ngPassw0rd!",
            "password_confirm": "Str0ngPassw0rd!",
            "terms_accepted": True,
        },
    )
    assert resp.status_code == 400
    assert "email" in resp.data


@pytest.mark.django_db
def test_register_rejects_mismatched_passwords(api_client):
    resp = api_client.post(
        "/api/v1/auth/register/",
        {
            "first_name": "Test",
            "email": "mismatch@example.com",
            "phone": "0888000000",
            "password": "Str0ngPassw0rd!",
            "password_confirm": "DifferentPassw0rd!",
            "terms_accepted": True,
        },
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_register_rejects_weak_password(api_client):
    resp = api_client.post(
        "/api/v1/auth/register/",
        {
            "first_name": "Test",
            "email": "weak@example.com",
            "phone": "0888000000",
            "password": "12345678",
            "password_confirm": "12345678",
            "terms_accepted": True,
        },
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_register_requires_terms_accepted(api_client):
    resp = api_client.post(
        "/api/v1/auth/register/",
        {
            "first_name": "Test",
            "email": "noterms@example.com",
            "phone": "0888000000",
            "password": "Str0ngPassw0rd!",
            "password_confirm": "Str0ngPassw0rd!",
            "terms_accepted": False,
        },
    )
    assert resp.status_code == 400
    assert not User.objects.filter(email="noterms@example.com").exists()


@pytest.mark.django_db
def test_registered_customer_can_use_cart_addresses_favorites(
    api_client, sample_product
):
    """Confirms registration doesn't create a second/parallel account system
    — the resulting user works with every existing customer feature."""
    reg = api_client.post(
        "/api/v1/auth/register/",
        {
            "first_name": "New",
            "email": "fullflow@example.com",
            "phone": "0888000001",
            "password": "Str0ngPassw0rd!",
            "password_confirm": "Str0ngPassw0rd!",
            "terms_accepted": True,
        },
    )
    assert reg.status_code == 201

    cart = api_client.post(
        "/api/v1/cart/items/", {"product_id": sample_product.id, "quantity": 1}
    )
    assert cart.status_code == 201

    addr = api_client.post(
        "/api/v1/addresses/",
        {
            "full_name": "New Customer",
            "phone": "0888000001",
            "city": "Sofia",
            "address_line": "ul. Test 1",
        },
    )
    assert addr.status_code == 201

    fav = api_client.post("/api/v1/favorites/", {"product_id": sample_product.id})
    assert fav.status_code == 201


@pytest.mark.django_db
def test_profile_update_requires_auth(api_client):
    resp = api_client.patch("/api/v1/me/", {"first_name": "X"})
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_profile_update(api_client):
    user = User.objects.create_user(
        username="profile-owner",
        email="profile-owner@example.com",
        password="pass12345",
    )
    api_client.force_authenticate(user=user)
    resp = api_client.patch(
        "/api/v1/me/",
        {"first_name": "Петър", "last_name": "Петров", "phone": "0899000000"},
    )
    assert resp.status_code == 200
    assert resp.data["first_name"] == "Петър"
    assert resp.data["phone"] == "0899000000"

    user.refresh_from_db()
    assert user.first_name == "Петър"


@pytest.mark.django_db
def test_profile_update_rejects_duplicate_email(api_client):
    User.objects.create_user(
        username="taken@example.com", email="taken@example.com", password="pass12345"
    )
    user = User.objects.create_user(
        username="changer", email="changer@example.com", password="pass12345"
    )
    api_client.force_authenticate(user=user)
    resp = api_client.patch("/api/v1/me/", {"email": "taken@example.com"})
    assert resp.status_code == 400


@pytest.mark.django_db
def test_change_password_requires_auth(api_client):
    resp = api_client.post(
        "/api/v1/auth/change-password/",
        {
            "current_password": "x",
            "new_password": "y",
            "new_password_confirm": "y",
        },
    )
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_change_password_flow(api_client):
    user = User.objects.create_user(username="pwchange", password="OldPassw0rd!")
    api_client.force_authenticate(user=user)

    wrong = api_client.post(
        "/api/v1/auth/change-password/",
        {
            "current_password": "WrongOldPassword",
            "new_password": "NewStr0ngPassw0rd!",
            "new_password_confirm": "NewStr0ngPassw0rd!",
        },
    )
    assert wrong.status_code == 400

    ok = api_client.post(
        "/api/v1/auth/change-password/",
        {
            "current_password": "OldPassw0rd!",
            "new_password": "NewStr0ngPassw0rd!",
            "new_password_confirm": "NewStr0ngPassw0rd!",
        },
    )
    assert ok.status_code == 200

    user.refresh_from_db()
    assert user.check_password("NewStr0ngPassw0rd!")

    # Session must survive its own password change (update_session_auth_hash).
    me = api_client.get("/api/v1/me/")
    assert me.status_code == 200


@pytest.mark.django_db
def test_change_password_rejects_mismatched_confirmation(api_client):
    user = User.objects.create_user(username="pwchange2", password="OldPassw0rd!")
    api_client.force_authenticate(user=user)
    resp = api_client.post(
        "/api/v1/auth/change-password/",
        {
            "current_password": "OldPassw0rd!",
            "new_password": "NewStr0ngPassw0rd!",
            "new_password_confirm": "SomethingElse!",
        },
    )
    assert resp.status_code == 400
    user.refresh_from_db()
    assert user.check_password("OldPassw0rd!")


@pytest.mark.django_db
def test_registration_does_not_grant_admin_access(api_client):
    reg = api_client.post(
        "/api/v1/auth/register/",
        {
            "first_name": "Regular",
            "email": "regular@example.com",
            "phone": "0888000002",
            "password": "Str0ngPassw0rd!",
            "password_confirm": "Str0ngPassw0rd!",
            "terms_accepted": True,
        },
    )
    assert reg.status_code == 201
    assert reg.data["is_admin_portal"] is False

    resp = api_client.get("/api/v1/admin/customers/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_address_requires_auth(api_client):
    resp = api_client.get("/api/v1/addresses/")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_address_crud_scoped_to_user(api_client):
    user = User.objects.create_user(username="buyer", password="buyerpass")
    other = User.objects.create_user(username="other", password="otherpass")
    api_client.force_authenticate(user=other)
    api_client.post(
        "/api/v1/addresses/",
        {
            "full_name": "Other Person",
            "phone": "0888000000",
            "city": "Sofia",
            "address_line": "Some street 1",
        },
    )

    api_client.force_authenticate(user=user)
    create = api_client.post(
        "/api/v1/addresses/",
        {
            "full_name": "Ivan Ivanov",
            "phone": "0888111111",
            "city": "Plovdiv",
            "post_code": "4000",
            "address_line": "ul. Test 1",
            "is_default": True,
        },
    )
    assert create.status_code == 201

    listed = api_client.get("/api/v1/addresses/")
    assert listed.status_code == 200
    assert listed.data["count"] == 1
    assert listed.data["results"][0]["full_name"] == "Ivan Ivanov"


@pytest.mark.django_db
def test_address_only_one_default_at_a_time(api_client):
    user = User.objects.create_user(username="addr-owner", password="pass12345")
    api_client.force_authenticate(user=user)

    first = api_client.post(
        "/api/v1/addresses/",
        {
            "full_name": "First",
            "phone": "0888111111",
            "city": "Plovdiv",
            "address_line": "ul. First 1",
            "is_default": True,
        },
    )
    second = api_client.post(
        "/api/v1/addresses/",
        {
            "full_name": "Second",
            "phone": "0888222222",
            "city": "Sofia",
            "address_line": "ul. Second 2",
            "is_default": True,
        },
    )
    assert second.status_code == 201

    listed = api_client.get("/api/v1/addresses/")
    defaults = [a for a in listed.data["results"] if a["is_default"]]
    assert len(defaults) == 1
    assert defaults[0]["id"] == second.data["id"]

    # Setting the first one back to default must un-default the second.
    api_client.patch(f"/api/v1/addresses/{first.data['id']}/", {"is_default": True})
    listed = api_client.get("/api/v1/addresses/")
    defaults = [a for a in listed.data["results"] if a["is_default"]]
    assert len(defaults) == 1
    assert defaults[0]["id"] == first.data["id"]


@pytest.mark.django_db
def test_speedy_offices_search(api_client, settings):
    from shipping.models import SpeedyOffice

    SpeedyOffice.objects.create(
        external_id="X1", name="Test office", city="Пловдив", address="ул. Тест 1"
    )
    resp = api_client.get("/api/v1/shipping/speedy/offices/", {"city": "Пловдив"})
    assert resp.status_code == 200
    assert len(resp.data) == 1


@pytest.mark.django_db
def test_speedy_quote(api_client):
    resp = api_client.post(
        "/api/v1/shipping/speedy/quote/",
        {"shipping_method": "speedy_office", "city": "Пловдив"},
    )
    assert resp.status_code == 200
    assert "shipping_cost_bgn" in resp.data


@pytest.mark.django_db
def test_speedy_quote_invalid_method(api_client):
    resp = api_client.post(
        "/api/v1/shipping/speedy/quote/", {"shipping_method": "teleport"}
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_search_multi_word_any_order(api_client):
    cat = Category.objects.create(external_id="chairs", slug="chairs", name="Столове")
    Product.objects.create(
        external_id="s1", slug="office-chair", name="Работен офис стол", category=cat
    )
    Product.objects.create(
        external_id="s2", slug="other", name="Друг продукт", category=cat
    )

    resp = api_client.get("/api/v1/search/", {"q": "стол офис"})
    assert resp.status_code == 200
    slugs = {r["slug"] for r in resp.data["results"]}
    assert slugs == {"office-chair"}


@pytest.mark.django_db
def test_search_matches_brand_and_category(api_client):
    from brands.models import Brand

    brand = Brand.objects.create(external_id="b1", slug="acme", name="Acme")
    cat = Category.objects.create(external_id="c1", slug="c1", name="TestCat")
    Product.objects.create(
        external_id="p1", slug="acme-thing", name="Нещо", brand=brand, category=cat
    )

    resp = api_client.get("/api/v1/search/", {"q": "acme"})
    assert resp.status_code == 200
    assert any(r["slug"] == "acme-thing" for r in resp.data["results"])


@pytest.mark.django_db
def test_order_flow(api_client, admin_user, sample_product):
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "customer_name": "Buyer",
            "items": [{"product_external_id": "272", "quantity": 2}],
        },
        format="json",
    )
    assert resp.status_code == 201
    number = resp.data["number"]
    api_client.force_authenticate(user=admin_user)
    confirm = api_client.post(f"/api/v1/admin/orders/{number}/confirm/")
    assert confirm.status_code == 200
    assert confirm.data["status"] == "confirmed"

    assert confirm.data["invoice"]["number"].startswith("INV-")

    # Re-confirming (defensive: shouldn't happen via normal flow since the
    # view guards on status==pending) must never mint a second invoice number.
    from orders.models import Order as OrderModel
    from orders.services import issue_invoice_for_order

    order = OrderModel.objects.get(number=number)
    same_invoice = issue_invoice_for_order(order)
    assert same_invoice.number == confirm.data["invoice"]["number"]


@pytest.mark.django_db
def test_my_orders_requires_auth(api_client):
    resp = api_client.get("/api/v1/my-orders/")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_my_orders_scoped_to_owner(api_client, admin_user, sample_product):
    owner = User.objects.create_user(username="order-owner", password="pass12345")
    stranger = User.objects.create_user(username="order-stranger", password="pass12345")

    api_client.force_authenticate(user=owner)
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "owner@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
        },
        format="json",
    )
    number = resp.data["number"]

    api_client.force_authenticate(user=admin_user)
    api_client.post(f"/api/v1/admin/orders/{number}/confirm/")

    api_client.force_authenticate(user=owner)
    mine = api_client.get("/api/v1/my-orders/")
    assert mine.data["count"] == 1
    detail = api_client.get(f"/api/v1/my-orders/{number}/")
    assert detail.status_code == 200
    assert detail.data["invoice"]["number"].startswith("INV-")

    # Customer isolation: another customer must never see or fetch this order.
    api_client.force_authenticate(user=stranger)
    theirs = api_client.get("/api/v1/my-orders/")
    assert theirs.data["count"] == 0
    denied = api_client.get(f"/api/v1/my-orders/{number}/")
    assert denied.status_code == 404


@pytest.mark.django_db
def test_invoice_pdf_download_requires_confirmation(api_client, sample_product):
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
        },
        format="json",
    )
    number = resp.data["number"]
    user = User.objects.create_user(username="pending-owner", password="pass12345")
    from orders.models import Order as OrderModel

    order = OrderModel.objects.get(number=number)
    order.user = user
    order.save(update_fields=["user"])

    api_client.force_authenticate(user=user)
    resp = api_client.get(f"/api/v1/my-orders/{number}/invoice/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_invoice_pdf_download_customer_and_admin(
    api_client, admin_user, sample_product
):
    owner = User.objects.create_user(username="invoice-owner", password="pass12345")

    api_client.force_authenticate(user=owner)
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "owner@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
        },
        format="json",
    )
    number = resp.data["number"]

    api_client.force_authenticate(user=admin_user)
    api_client.post(f"/api/v1/admin/orders/{number}/confirm/")

    admin_resp = api_client.get(f"/api/v1/admin/orders/{number}/invoice/")
    assert admin_resp.status_code == 200
    assert admin_resp["Content-Type"] == "application/pdf"
    assert admin_resp.content[:4] == b"%PDF"

    api_client.force_authenticate(user=owner)
    customer_resp = api_client.get(f"/api/v1/my-orders/{number}/invoice/")
    assert customer_resp.status_code == 200
    assert customer_resp.content[:4] == b"%PDF"


@pytest.mark.django_db
def test_invoice_pdf_download_requires_owner(api_client, admin_user, sample_product):
    owner = User.objects.create_user(username="pdf-owner", password="pass12345")
    stranger = User.objects.create_user(username="pdf-stranger", password="pass12345")

    api_client.force_authenticate(user=owner)
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "owner2@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
        },
        format="json",
    )
    number = resp.data["number"]

    api_client.force_authenticate(user=admin_user)
    api_client.post(f"/api/v1/admin/orders/{number}/confirm/")

    api_client.force_authenticate(user=stranger)
    resp = api_client.get(f"/api/v1/my-orders/{number}/invoice/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_order_uses_individual_price_not_frontend_price(api_client, sample_product):
    """Never trust a client-submitted price — the order must charge the
    customer's centrally-computed price (individual override here), and
    snapshot both the original and discounted price + a human-readable label."""
    from pricing.models import AdminPriceOverride

    vip = User.objects.create_user(username="vip-order", password="vippass")
    AdminPriceOverride.objects.create(
        product=sample_product, user=vip, client_price="0.50"
    )

    api_client.force_authenticate(user=vip)
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "vip@example.com",
            # Frontend sending a bogus price must be ignored entirely.
            "items": [{"product_external_id": "272", "quantity": 3}],
        },
        format="json",
    )
    assert resp.status_code == 201
    item = resp.data["items"][0]
    assert item["unit_price"] == "0.50"
    assert item["original_unit_price"] == "1.35"
    assert item["line_total"] == "1.50"
    assert item["discount_label"] == "Индивидуална цена"
    assert float(resp.data["subtotal_bgn"]) == 1.50


@pytest.mark.django_db
def test_order_checkout_speedy_address(api_client, sample_product):
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "customer_phone": "0888123456",
            "items": [{"product_external_id": "272", "quantity": 1}],
            "shipping_method": "speedy_address",
            "delivery_address_line": "ul. Test 1",
            "delivery_city": "Пловдив",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["shipping_method"] == "speedy_address"
    # Speedy isn't actually charged for right now (confirmed with the
    # client) - the mock quote still runs (see calculate_price being
    # called in create_order) but the result is discarded, not charged.
    assert float(resp.data["shipping_cost_bgn"]) == 0
    # total = (items + shipping) * (1 + VAT_RATE_PERCENT/100), snapshotted on the order.
    taxable = float(resp.data["shipping_cost_bgn"]) + 1.35 * 1
    expected_total = round(
        taxable * (1 + float(resp.data["vat_rate_percent"]) / 100), 2
    )
    assert round(float(resp.data["total_bgn"]), 2) == expected_total


@pytest.mark.django_db
def test_order_checkout_speedy_address_missing_fields(api_client, sample_product):
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
            "shipping_method": "speedy_address",
        },
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_order_checkout_speedy_address_autosaves_address_for_logged_in_customer(
    api_client, sample_product
):
    from accounts.models import Address

    user = User.objects.create_user(username="addr-buyer", password="pass12345")
    api_client.force_authenticate(user=user)

    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "customer_name": "Иван Иванов",
            "customer_phone": "0888123456",
            "items": [{"product_external_id": "272", "quantity": 1}],
            "shipping_method": "speedy_address",
            "delivery_address_line": "ul. Test 1",
            "delivery_city": "Пловдив",
            "delivery_post_code": "4000",
        },
        format="json",
    )
    assert resp.status_code == 201
    addresses = Address.objects.filter(user=user)
    assert addresses.count() == 1
    address = addresses.first()
    assert address.label == "Адрес 1"
    assert address.is_default is True
    assert address.address_line == "ul. Test 1"

    # A second order with a genuinely different address adds a second one.
    resp2 = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "customer_name": "Иван Иванов",
            "customer_phone": "0888123456",
            "items": [{"product_external_id": "272", "quantity": 1}],
            "shipping_method": "speedy_address",
            "delivery_address_line": "ul. Different 2",
            "delivery_city": "Варна",
        },
        format="json",
    )
    assert resp2.status_code == 201
    assert Address.objects.filter(user=user).count() == 2
    new_address = Address.objects.get(user=user, address_line="ul. Different 2")
    assert new_address.label == "Адрес 2"
    assert new_address.is_default is False

    # Re-using the exact same first address again doesn't create a duplicate.
    resp3 = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "customer_name": "Иван Иванов",
            "customer_phone": "0888123456",
            "items": [{"product_external_id": "272", "quantity": 1}],
            "shipping_method": "speedy_address",
            "delivery_address_line": "ul. Test 1",
            "delivery_city": "Пловдив",
            "delivery_post_code": "4000",
        },
        format="json",
    )
    assert resp3.status_code == 201
    assert Address.objects.filter(user=user).count() == 2


@pytest.mark.django_db
def test_order_checkout_speedy_office(api_client, sample_product):
    from shipping.models import SpeedyOffice

    office = SpeedyOffice.objects.create(
        external_id="OFF-1", name="Test office", city="Пловдив", address="ул. Тест 1"
    )
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
            "shipping_method": "speedy_office",
            "speedy_office_id": office.external_id,
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["speedy_office_name"] == "Test office"


@pytest.mark.django_db
def test_order_checkout_speedy_office_unknown(api_client, sample_product):
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
            "shipping_method": "speedy_office",
            "speedy_office_id": "does-not-exist",
        },
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_favorites_require_auth(api_client, sample_product):
    resp = api_client.post("/api/v1/favorites/", {"product_id": sample_product.id})
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_favorites_add_list_remove(api_client, sample_product):
    user = User.objects.create_user(username="fan", password="fanpass")
    api_client.force_authenticate(user=user)

    resp = api_client.post("/api/v1/favorites/", {"product_id": sample_product.id})
    assert resp.status_code == 201
    assert resp.data["product"]["external_id"] == "272"

    listed = api_client.get("/api/v1/favorites/")
    assert len(listed.data["results"]) == 1

    fav_id = resp.data["id"]
    resp = api_client.delete(f"/api/v1/favorites/{fav_id}/")
    assert resp.status_code == 204
    listed = api_client.get("/api/v1/favorites/")
    assert len(listed.data["results"]) == 0


@pytest.mark.django_db
def test_favorites_are_per_user(api_client, sample_product):
    owner = User.objects.create_user(username="owner", password="ownerpass")
    stranger = User.objects.create_user(username="stranger", password="strangerpass")

    api_client.force_authenticate(user=owner)
    api_client.post("/api/v1/favorites/", {"product_id": sample_product.id})

    api_client.force_authenticate(user=stranger)
    listed = api_client.get("/api/v1/favorites/")
    assert len(listed.data["results"]) == 0


@pytest.mark.django_db
def test_favorites_toggle(api_client, sample_product):
    user = User.objects.create_user(username="toggler", password="togglepass")
    api_client.force_authenticate(user=user)

    resp = api_client.post(
        "/api/v1/favorites/toggle/", {"product_id": sample_product.id}
    )
    assert resp.status_code == 200
    assert resp.data["favorited"] is True

    resp = api_client.post(
        "/api/v1/favorites/toggle/", {"product_id": sample_product.id}
    )
    assert resp.data["favorited"] is False


@pytest.mark.django_db
def test_activity_tracking_requires_auth(api_client, sample_product):
    resp = api_client.post("/api/v1/activity/track/", {"product_id": sample_product.id})
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_activity_tracking_increments_view_count(api_client, sample_product):
    user = User.objects.create_user(username="viewer", password="viewerpass")
    api_client.force_authenticate(user=user)

    resp = api_client.post("/api/v1/activity/track/", {"product_id": sample_product.id})
    assert resp.status_code == 200
    assert resp.data["view_count"] == 1

    resp = api_client.post("/api/v1/activity/track/", {"product_id": sample_product.id})
    assert resp.data["view_count"] == 2


@pytest.mark.django_db
def test_admin_customer_activity_requires_admin(api_client, sample_product):
    user = User.objects.create_user(username="viewer2", password="viewerpass")
    api_client.force_authenticate(user=user)
    api_client.post("/api/v1/activity/track/", {"product_id": sample_product.id})

    resp = api_client.get(f"/api/v1/admin/customers/{user.id}/activity/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_admin_dashboard_stats_requires_admin(api_client):
    resp = api_client.get("/api/v1/admin/dashboard/stats/")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_admin_dashboard_stats(api_client, admin_user, sample_product):
    User.objects.create_user(username="cust-a", password="pass12345")
    api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
        },
        format="json",
    )

    api_client.force_authenticate(user=admin_user)
    resp = api_client.get("/api/v1/admin/dashboard/stats/")
    assert resp.status_code == 200
    assert resp.data["pending_orders"] == 1
    assert resp.data["total_customers"] == 1
    assert resp.data["total_products"] == 1


@pytest.mark.django_db
def test_admin_customer_activity_visible_to_admin(
    api_client, admin_user, sample_product
):
    user = User.objects.create_user(username="viewer3", password="viewerpass")
    api_client.force_authenticate(user=user)
    api_client.post("/api/v1/activity/track/", {"product_id": sample_product.id})

    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(f"/api/v1/admin/customers/{user.id}/activity/")
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert resp.data[0]["product_name"] == sample_product.name


@pytest.mark.django_db
def test_admin_customers_list_requires_admin(api_client):
    resp = api_client.get("/api/v1/admin/customers/")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_admin_customers_list_counts(api_client, admin_user, sample_product):
    customer = User.objects.create_user(username="listed", password="pass12345")
    from promotions.models import Promotion

    Promotion.objects.create(
        name="For listed",
        discount_type="percent",
        value="5.00",
        scope="user",
        user=customer,
    )

    api_client.force_authenticate(user=admin_user)
    resp = api_client.get("/api/v1/admin/customers/")
    assert resp.status_code == 200
    row = next(c for c in resp.data["results"] if c["id"] == customer.id)
    assert row["promotion_count"] == 1
    assert row["cart_item_count"] == 0


@pytest.mark.django_db
def test_admin_can_delete_customer(api_client, admin_user):
    customer = User.objects.create_user(username="to-delete", password="pass12345")
    api_client.force_authenticate(user=admin_user)

    resp = api_client.delete(f"/api/v1/admin/customers/{customer.id}/")
    assert resp.status_code == 204
    assert not User.objects.filter(id=customer.id).exists()


@pytest.mark.django_db
def test_admin_delete_customer_requires_admin(api_client):
    customer = User.objects.create_user(username="protected", password="pass12345")
    resp = api_client.delete(f"/api/v1/admin/customers/{customer.id}/")
    assert resp.status_code in (401, 403)
    assert User.objects.filter(id=customer.id).exists()


@pytest.mark.django_db
def test_admin_cannot_delete_staff_via_customers_endpoint(api_client, admin_user):
    other_staff = User.objects.create_user(
        username="other-staff", password="pass12345", is_staff=True
    )
    api_client.force_authenticate(user=admin_user)

    resp = api_client.delete(f"/api/v1/admin/customers/{other_staff.id}/")
    assert resp.status_code == 404
    assert User.objects.filter(id=other_staff.id).exists()


@pytest.mark.django_db
def test_deleting_customer_preserves_their_orders(
    api_client, admin_user, sample_product
):
    customer = User.objects.create_user(username="had-orders", password="pass12345")
    api_client.force_authenticate(user=customer)
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "had-orders@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
        },
        format="json",
    )
    number = resp.data["number"]

    api_client.force_authenticate(user=admin_user)
    api_client.delete(f"/api/v1/admin/customers/{customer.id}/")

    order = Order.objects.get(number=number)
    assert order.user_id is None
    assert order.customer_email == "had-orders@example.com"


@pytest.mark.django_db
def test_admin_customer_cart_management(api_client, admin_user, sample_product):
    customer = User.objects.create_user(username="cart-owner", password="pass12345")

    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(f"/api/v1/admin/customers/{customer.id}/cart/")
    assert resp.status_code == 200
    assert resp.data["items"] == []

    resp = api_client.post(
        f"/api/v1/admin/customers/{customer.id}/cart/items/",
        {"product_id": sample_product.id, "quantity": 2},
    )
    assert resp.status_code == 201
    assert len(resp.data["items"]) == 1
    item = resp.data["items"][0]
    assert item["quantity"] == 2
    assert item["unit_price"] == "1.35"
    assert resp.data["subtotal_bgn"] == "2.70"
    item_id = item["item_id"]

    resp = api_client.patch(
        f"/api/v1/admin/customers/{customer.id}/cart/items/{item_id}/",
        {"quantity": 5},
    )
    assert resp.status_code == 200
    assert resp.data["items"][0]["quantity"] == 5

    resp = api_client.delete(
        f"/api/v1/admin/customers/{customer.id}/cart/items/{item_id}/"
    )
    assert resp.status_code == 200
    assert resp.data["items"] == []


@pytest.mark.django_db
def test_admin_customer_cart_uses_individual_price(
    api_client, admin_user, sample_product
):
    """The cart's price must come from the same centralized pricing engine
    used at checkout, never a stored/frontend-supplied number."""
    from pricing.models import AdminPriceOverride

    customer = User.objects.create_user(username="vip-cart", password="pass12345")
    AdminPriceOverride.objects.create(
        product=sample_product, user=customer, client_price="0.50"
    )

    api_client.force_authenticate(user=admin_user)
    api_client.post(
        f"/api/v1/admin/customers/{customer.id}/cart/items/",
        {"product_id": sample_product.id, "quantity": 1},
    )
    resp = api_client.get(f"/api/v1/admin/customers/{customer.id}/cart/")
    assert resp.data["items"][0]["unit_price"] == "0.50"
    assert resp.data["items"][0]["price_source"] == "Индивидуална цена"


@pytest.mark.django_db
def test_password_reset_request_always_returns_200(api_client):
    User.objects.create_user(
        username="reset-me", password="oldpass123", email="reset@example.com"
    )
    resp = api_client.post(
        "/api/v1/auth/password-reset/", {"email": "reset@example.com"}
    )
    assert resp.status_code == 200
    # Non-existent email must look identical — no account enumeration.
    resp = api_client.post(
        "/api/v1/auth/password-reset/", {"email": "nobody@example.com"}
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_password_reset_confirm_flow(api_client):
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.encoding import force_bytes
    from django.utils.http import urlsafe_base64_encode

    user = User.objects.create_user(username="reset-flow", password="oldpass123")
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    resp = api_client.post(
        "/api/v1/auth/password-reset/confirm/",
        {"uid": uid, "token": token, "new_password": "brandnewpass456"},
    )
    assert resp.status_code == 200

    user.refresh_from_db()
    assert user.check_password("brandnewpass456")

    # The same token must not work twice — check_token ties it to the
    # password hash, which just changed.
    resp = api_client.post(
        "/api/v1/auth/password-reset/confirm/",
        {"uid": uid, "token": token, "new_password": "anotherpass789"},
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_password_reset_confirm_rejects_bad_token(api_client):
    user = User.objects.create_user(username="reset-bad", password="oldpass123")
    from django.utils.encoding import force_bytes
    from django.utils.http import urlsafe_base64_encode

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    resp = api_client.post(
        "/api/v1/auth/password-reset/confirm/",
        {"uid": uid, "token": "not-a-real-token", "new_password": "brandnewpass456"},
    )
    assert resp.status_code == 400
    user.refresh_from_db()
    assert user.check_password("oldpass123")


@pytest.mark.django_db
def test_admin_customer_cart_requires_admin(api_client, sample_product):
    other = User.objects.create_user(username="not-admin", password="pass12345")
    api_client.force_authenticate(user=other)
    resp = api_client.get(f"/api/v1/admin/customers/{other.id}/cart/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_my_cart_requires_auth(api_client):
    resp = api_client.get("/api/v1/cart/")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_my_cart_add_update_remove(api_client, sample_product):
    user = User.objects.create_user(username="cart-self", password="pass12345")
    api_client.force_authenticate(user=user)

    resp = api_client.get("/api/v1/cart/")
    assert resp.status_code == 200
    assert resp.data["items"] == []

    resp = api_client.post(
        "/api/v1/cart/items/", {"product_id": sample_product.id, "quantity": 2}
    )
    assert resp.status_code == 201
    item = resp.data["items"][0]
    assert item["quantity"] == 2
    assert item["unit_price"] == "1.35"
    assert item["product_slug"] == sample_product.slug
    item_id = item["item_id"]

    resp = api_client.patch(f"/api/v1/cart/items/{item_id}/", {"quantity": 5})
    assert resp.status_code == 200
    assert resp.data["items"][0]["quantity"] == 5

    resp = api_client.delete(f"/api/v1/cart/items/{item_id}/")
    assert resp.status_code == 200
    assert resp.data["items"] == []


@pytest.mark.django_db
def test_my_cart_isolated_per_customer(api_client, sample_product):
    owner = User.objects.create_user(username="cart-owner-2", password="pass12345")
    stranger = User.objects.create_user(
        username="cart-stranger-2", password="pass12345"
    )

    api_client.force_authenticate(user=owner)
    resp = api_client.post(
        "/api/v1/cart/items/", {"product_id": sample_product.id, "quantity": 1}
    )
    item_id = resp.data["items"][0]["item_id"]

    api_client.force_authenticate(user=stranger)
    empty = api_client.get("/api/v1/cart/")
    assert empty.data["items"] == []

    # A stranger must never be able to mutate someone else's cart item, even
    # by guessing/reusing another cart's item id.
    resp = api_client.patch(f"/api/v1/cart/items/{item_id}/", {"quantity": 9})
    assert resp.status_code == 404
    resp = api_client.delete(f"/api/v1/cart/items/{item_id}/")
    assert resp.status_code == 404

    api_client.force_authenticate(user=owner)
    still_there = api_client.get("/api/v1/cart/")
    assert still_there.data["items"][0]["quantity"] == 1


@pytest.mark.django_db
def test_customer_and_admin_cart_share_one_source_of_truth(
    api_client, admin_user, sample_product
):
    """The critical guarantee: whatever the customer adds via their own
    storefront cart endpoint is exactly what admin sees for that customer,
    and whatever admin adds/changes is exactly what the customer sees when
    they fetch their own cart — because both read/write the same Cart row."""
    customer = User.objects.create_user(
        username="shared-cart-cust", password="pass12345"
    )
    other_product = Product.objects.create(
        external_id="900",
        slug="other-shared-product",
        name="Other Shared Product",
        price_bgn="9.00",
        client_price="9.00",
    )

    # Customer adds a product via their OWN storefront cart endpoint.
    api_client.force_authenticate(user=customer)
    api_client.post(
        "/api/v1/cart/items/", {"product_id": sample_product.id, "quantity": 1}
    )

    # Admin opens that same customer and must see exactly that item.
    api_client.force_authenticate(user=admin_user)
    admin_view = api_client.get(f"/api/v1/admin/customers/{customer.id}/cart/")
    assert len(admin_view.data["items"]) == 1
    assert admin_view.data["items"][0]["product_id"] == sample_product.id

    # Admin adds a second product and bumps the first item's quantity.
    first_item_id = admin_view.data["items"][0]["item_id"]
    api_client.patch(
        f"/api/v1/admin/customers/{customer.id}/cart/items/{first_item_id}/",
        {"quantity": 4},
    )
    api_client.post(
        f"/api/v1/admin/customers/{customer.id}/cart/items/",
        {"product_id": other_product.id, "quantity": 3},
    )

    # Customer fetching their OWN cart must see both admin-made changes.
    api_client.force_authenticate(user=customer)
    mine = api_client.get("/api/v1/cart/")
    assert len(mine.data["items"]) == 2
    by_product = {i["product_id"]: i for i in mine.data["items"]}
    assert by_product[sample_product.id]["quantity"] == 4
    assert by_product[other_product.id]["quantity"] == 3

    # Customer removes an item themselves; admin must see it gone too.
    removed_item_id = by_product[other_product.id]["item_id"]
    api_client.delete(f"/api/v1/cart/items/{removed_item_id}/")

    api_client.force_authenticate(user=admin_user)
    admin_view_2 = api_client.get(f"/api/v1/admin/customers/{customer.id}/cart/")
    assert len(admin_view_2.data["items"]) == 1
    assert admin_view_2.data["items"][0]["product_id"] == sample_product.id


@pytest.mark.django_db
def test_admin_portal_user_without_staff_can_access_admin_api(api_client):
    """The frontend's route guard (AdminRoute.tsx) lets a user into /admin/*
    based on profile.is_admin_portal, not is_staff — the API must honor the
    same rule (IsAdminPortalUser in api/views.py), or a portal-only admin
    would get past the frontend gate and then have every API call 403."""
    from accounts.models import Profile

    portal_user = User.objects.create_user(username="portal-only", password="pass12345")
    Profile.objects.update_or_create(
        user=portal_user, defaults={"is_admin_portal": True}
    )

    api_client.force_authenticate(user=portal_user)
    resp = api_client.get("/api/v1/admin/products/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_non_admin_user_cannot_access_admin_api(api_client):
    plain_user = User.objects.create_user(username="plain", password="pass12345")
    api_client.force_authenticate(user=plain_user)
    resp = api_client.get("/api/v1/admin/products/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_login_endpoint_is_rate_limited(api_client):
    for _ in range(10):
        resp = api_client.post(
            "/api/v1/auth/login/", {"username": "nobody", "password": "wrong"}
        )
        assert resp.status_code == 400
    # 11th attempt within the same minute -> throttled, not a normal
    # "invalid credentials" response.
    resp = api_client.post(
        "/api/v1/auth/login/", {"username": "nobody", "password": "wrong"}
    )
    assert resp.status_code == 429
