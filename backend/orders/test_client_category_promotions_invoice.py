"""Regression for a real admin report (order 91): a client with personal
category promotions (e.g. "ЛИСТЧЕТА 20%" on the parent category
"Хартиени кубчета и индекси", "КЛАМЕРИ 30%") must get those discounts on
their order lines - including products in a *subcategory* of the promoted
category - and the admin invoice PDF must show the crossed-out price and
the % for every such line, not just one."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from categories.models import Category
from orders.pdf import generate_invoice_pdf
from orders.services import create_order, issue_invoice_for_order
from products.models import Product
from promotions.models import Promotion

User = get_user_model()


@pytest.fixture
def client_with_category_promos(db):
    client = User.objects.create_user(
        username="dinara", password="pass12345", email="dinara@example.bg"
    )
    other = User.objects.create_user(username="other", password="pass12345")
    office = Category.objects.create(external_id="10", slug="office", name="Office")
    clips = Category.objects.create(
        external_id="11", slug="clips", name="Кламери", parent=office
    )
    cubes = Category.objects.create(
        external_id="12", slug="cubes", name="Хартиени кубчета и индекси", parent=office
    )
    notes = Category.objects.create(
        external_id="13", slug="notes", name="Самозалепващи листчета", parent=cubes
    )
    clip = Product.objects.create(
        external_id="7915",
        slug="clip-33",
        name="Кламери 33мм",
        category=clips,
        price_bgn="0.99",
        client_price="0.99",
        admin_price="0.30",
    )
    note = Product.objects.create(
        external_id="19461",
        slug="notes-76",
        name="Листчета 76x76",
        category=notes,
        price_bgn="1.00",
        client_price="1.00",
        admin_price="0.25",
    )
    Promotion.objects.create(
        name="КЛАМЕРИ",
        discount_type="percent",
        value=30,
        scope=Promotion.SCOPE_CATEGORY,
        category=clips,
        user=client,
    )
    Promotion.objects.create(
        name="ЛИСТЧЕТА",
        discount_type="percent",
        value=20,
        scope=Promotion.SCOPE_CATEGORY,
        category=cubes,
        user=client,
    )
    return client, other, clip, note


def _order(user, email, clip, note):
    return create_order(
        user=user,
        customer_email=email,
        items=[
            {"product_id": clip.id, "quantity": 3},
            {"product_id": note.id, "quantity": 4},
        ],
    )


@pytest.mark.django_db
def test_client_category_promotions_priced_and_shown_on_admin_invoice(
    client_with_category_promos, monkeypatch
):
    client, _, clip, note = client_with_category_promos
    order = _order(client, client.email, clip, note)
    lines = {i.product_id: i for i in order.items.all()}

    assert lines[clip.id].unit_price == Decimal("0.69")  # 0.99 - 30%
    assert lines[clip.id].original_unit_price == Decimal("0.99")
    assert lines[clip.id].discount_label == "КЛАМЕРИ"
    # Subcategory of the promoted category still gets the client's promo.
    assert lines[note.id].unit_price == Decimal("0.80")  # 1.00 - 20%
    assert lines[note.id].original_unit_price == Decimal("1.00")
    assert lines[note.id].discount_label == "ЛИСТЧЕТА"

    # Capture every table cell's markup as the admin PDF is built.
    import orders.pdf as invoice_pdf

    cells = []
    real_paragraph = invoice_pdf.Paragraph

    def spy(text, *args, **kwargs):
        cells.append(text)
        return real_paragraph(text, *args, **kwargs)

    monkeypatch.setattr(invoice_pdf, "Paragraph", spy)
    invoice = issue_invoice_for_order(order)
    pdf = generate_invoice_pdf(invoice, include_profit=True)
    assert pdf.startswith(b"%PDF")
    text = " ".join(cells)
    assert "(-30%)" in text
    assert "(-20%)" in text


@pytest.mark.django_db
def test_client_promotions_do_not_apply_without_the_client_account(
    client_with_category_promos,
):
    """The same cart placed while not logged in (or from another account)
    gets regular prices - personal promotions follow the account, not the
    email typed at checkout. This is what an invoice with no % looks like."""
    client, other, clip, note = client_with_category_promos
    for user in (None, other):
        order = _order(user, client.email, clip, note)
        for item in order.items.all():
            assert item.original_unit_price is None
            assert item.discount_label == ""
