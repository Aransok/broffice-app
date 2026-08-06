import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from categories.models import Category
from orders.models import Order
from products.models import Product


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
def test_company_order_requires_name_and_eik(api_client, sample_product):
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
            "is_company_order": True,
            # company_name/company_eik deliberately omitted.
        },
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_company_order_created_with_full_details(api_client, sample_product):
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "customer_name": "Иван Иванов",
            "items": [{"product_external_id": "272", "quantity": 1}],
            "is_company_order": True,
            "company_name": "Тест ЕООД",
            "company_eik": "123456789",
            "company_vat_number": "BG123456789",
            "company_address": "гр. София, ул. Тестова 1",
            "company_mol": "Иван Иванов",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["is_company_order"] is True
    assert resp.data["company_name"] == "Тест ЕООД"
    assert resp.data["company_eik"] == "123456789"

    order = Order.objects.get(number=resp.data["number"])
    assert order.is_company_order is True
    assert order.company_name == "Тест ЕООД"
    assert order.company_eik == "123456789"
    assert order.company_vat_number == "BG123456789"
    assert order.company_mol == "Иван Иванов"


@pytest.mark.django_db
def test_non_company_order_leaves_company_fields_blank(api_client, sample_product):
    resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["is_company_order"] is False
    assert resp.data["company_name"] == ""
    assert resp.data["company_eik"] == ""


@pytest.mark.django_db
def test_company_order_details_survive_confirmation(
    api_client, admin_user, sample_product
):
    create_resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
            "is_company_order": True,
            "company_name": "Фирма ООД",
            "company_eik": "987654321",
        },
        format="json",
    )
    assert create_resp.status_code == 201
    number = create_resp.data["number"]

    api_client.force_authenticate(user=admin_user)
    confirm_resp = api_client.post(f"/api/v1/admin/orders/{number}/confirm/")

    assert confirm_resp.status_code == 200
    assert confirm_resp.data["status"] == "confirmed"
    assert confirm_resp.data["is_company_order"] is True
    assert confirm_resp.data["company_name"] == "Фирма ООД"
    assert confirm_resp.data["company_eik"] == "987654321"
    # A company order still goes through the normal invoice pipeline.
    assert confirm_resp.data["invoice"]["number"].startswith("INV-")


@pytest.mark.django_db
def test_company_order_invoice_pdf_includes_company_details(
    api_client, admin_user, sample_product
):
    """Doesn't parse the rendered PDF bytes (fragile) — just confirms the
    generator runs without error for a company order and produces real
    output, since orders/pdf.py branches specifically on is_company_order
    to add the extra company/ЕИК/ДДС/МОЛ block."""
    create_resp = api_client.post(
        "/api/v1/orders/",
        {
            "customer_email": "buyer@example.com",
            "items": [{"product_external_id": "272", "quantity": 1}],
            "is_company_order": True,
            "company_name": "PDF Тест ЕООД",
            "company_eik": "111222333",
        },
        format="json",
    )
    number = create_resp.data["number"]

    api_client.force_authenticate(user=admin_user)
    api_client.post(f"/api/v1/admin/orders/{number}/confirm/")

    pdf_resp = api_client.get(f"/api/v1/admin/orders/{number}/invoice/")
    assert pdf_resp.status_code == 200
    assert pdf_resp["Content-Type"] == "application/pdf"
    assert len(pdf_resp.content) > 0
