"""Client-facing PDFs for the admin's customer page: the customer's
individual prices and their own promotions, to hand to the client. Same
look as the invoice (orders/pdf.py): logo, company block, registered font.
Prices are shown as the site stores them — without VAT."""

from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

import orders.pdf as invoice_pdf
from common.currency import format_eur
from common.emails import LOGO_PATH
from pricing.models import AdminPriceOverride
from pricing.services import compute_promo_price, get_base_price
from promotions.models import Promotion


def customer_display_name(customer) -> str:
    """Company name if we know one (the PDFs are mostly for business
    clients), else the person's name, else their email/username."""
    profile = getattr(customer, "profile", None)
    if profile is not None and profile.company:
        return profile.company
    company_address = (
        customer.addresses.filter(is_company=True).exclude(company_name="").first()
    )
    if company_address:
        return company_address.company_name
    return customer.get_full_name() or customer.email or customer.username


def _product_number(product) -> str:
    return str(product.item_number or product.supplier_id or "")


def _build_pdf(customer, *, title: str, intro: str, table_rows, col_widths) -> bytes:
    invoice_pdf._register_fonts()
    regular, bold = invoice_pdf.FONT_REGULAR, invoice_pdf.FONT_BOLD

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        title=title,
    )
    styles = getSampleStyleSheet()
    normal = ParagraphStyle("ClientNormal", parent=styles["Normal"], fontName=regular)
    small = ParagraphStyle(
        "ClientSmall", parent=normal, fontSize=8, textColor=colors.grey
    )
    heading = ParagraphStyle(
        "ClientHeading", parent=styles["Heading1"], fontName=bold, fontSize=15
    )
    cell = ParagraphStyle("ClientCell", parent=normal, fontSize=8, leading=10)
    cell_right = ParagraphStyle("ClientCellRight", parent=cell, alignment=TA_RIGHT)
    header_cell = ParagraphStyle("ClientHeaderCell", parent=cell, fontName=bold)
    header_right = ParagraphStyle(
        "ClientHeaderRight", parent=header_cell, alignment=TA_RIGHT
    )

    elements = []
    if LOGO_PATH.exists():
        logo_height = 14 * mm
        elements.append(
            Image(str(LOGO_PATH), width=logo_height * (921 / 271), height=logo_height)
        )
        elements.append(Spacer(1, 4 * mm))
    company_lines = [settings.COMPANY_ADDRESS, f"ЕИК: {settings.COMPANY_EIK}"]
    if settings.COMPANY_VAT_NUMBER:
        company_lines.append(f"ДДС №: {settings.COMPANY_VAT_NUMBER}")
    company_lines.append(f"{settings.COMPANY_EMAIL} · {settings.COMPANY_PHONE}")
    for line in company_lines:
        elements.append(Paragraph(line, small))
    elements.append(Spacer(1, 8 * mm))

    elements.append(Paragraph(title, heading))
    elements.append(
        Paragraph(
            f"Клиент: <b>{escape(customer_display_name(customer))}</b> · "
            f"Дата: {timezone.localdate():%d.%m.%Y}",
            normal,
        )
    )
    elements.append(Spacer(1, 2 * mm))
    elements.append(Paragraph(intro, small))
    elements.append(Spacer(1, 5 * mm))

    if len(table_rows) == 1:
        elements.append(Paragraph("Няма записи.", normal))
    else:
        # First two columns left-aligned text, the rest numbers on the right.
        data = []
        for row_index, row in enumerate(table_rows):
            styled = []
            for col_index, value in enumerate(row):
                if row_index == 0:
                    style = header_cell if col_index < 2 else header_right
                else:
                    style = cell if col_index < 2 else cell_right
                # Escaped: Paragraph parses markup, and a product name with
                # "&" or "<" would otherwise break the whole PDF.
                styled.append(Paragraph(escape(str(value)), style))
            data.append(styled)
        table = Table(data, colWidths=col_widths, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        elements.append(table)

    elements.append(Spacer(1, 6 * mm))
    elements.append(Paragraph("Цените са в евро, без ДДС.", small))
    doc.build(elements)
    return buffer.getvalue()


def _discount_percent(standard: Decimal | None, price: Decimal) -> str:
    if not standard or price >= standard:
        return "—"
    return f"-{((standard - price) / standard * 100).quantize(Decimal(1))}%"


def generate_customer_prices_pdf(customer) -> bytes:
    overrides = (
        AdminPriceOverride.objects.filter(user=customer, client_price__isnull=False)
        .select_related("product")
        .order_by("product__name")
    )
    rows = [["№", "Продукт", "Стандартна цена", "Вашата цена", "Отстъпка"]]
    for override in overrides:
        product = override.product
        standard = get_base_price(product)
        # Same reseller-cost floor the storefront applies
        # (pricing.services.get_effective_price) — the PDF must show the
        # price the client will actually be charged.
        price = override.client_price.quantize(Decimal("0.01"))
        if product.admin_price is not None:
            price = max(price, product.admin_price)
        rows.append(
            [
                _product_number(product),
                product.name,
                format_eur(standard) if standard is not None else "—",
                format_eur(price),
                _discount_percent(standard, price),
            ]
        )
    return _build_pdf(
        customer,
        title="Индивидуални цени",
        intro="Вашите индивидуални цени в BRoffice, валидни към датата на документа.",
        table_rows=rows,
        col_widths=[18 * mm, 76 * mm, 28 * mm, 28 * mm, 24 * mm],
    )


def _promotion_target(promotion: Promotion) -> str:
    if promotion.scope == Promotion.SCOPE_PRODUCT and promotion.product:
        number = _product_number(promotion.product)
        return f"{promotion.product.name}" + (f" (№{number})" if number else "")
    if promotion.scope == Promotion.SCOPE_CATEGORY and promotion.category:
        return f"Категория: {promotion.category.name}"
    return "Всички продукти"


def _promotion_discount(promotion: Promotion) -> str:
    if promotion.discount_type == Promotion.TYPE_PERCENT:
        return f"-{promotion.value.normalize():f}%"
    return f"Цена {format_eur(promotion.value)}"


def generate_customer_promotions_pdf(customer) -> bytes:
    now = timezone.now()
    # Current and upcoming promotions for this client — expired ones are
    # left out, since this is a document to give the client today.
    promotions = (
        Promotion.objects.filter(
            user=customer, active=True, status=Promotion.STATUS_PUBLISHED
        )
        .filter(Q(ends_at__isnull=True) | Q(ends_at__gte=now))
        .select_related("product", "category")
        .order_by("starts_at", "name")
    )
    rows = [
        ["Промоция", "Важи за", "Отстъпка", "Стандартна цена", "Промо цена", "Срок"]
    ]
    for promotion in promotions:
        standard = promo_price = "—"
        if promotion.scope == Promotion.SCOPE_PRODUCT and promotion.product:
            base = get_base_price(promotion.product)
            if base is not None:
                standard = format_eur(base)
                promo_price = format_eur(
                    compute_promo_price(base, promotion, promotion.product)
                )
        period = []
        if promotion.starts_at and promotion.starts_at > now:
            period.append(f"от {timezone.localtime(promotion.starts_at):%d.%m.%Y}")
        period.append(
            f"до {timezone.localtime(promotion.ends_at):%d.%m.%Y}"
            if promotion.ends_at
            else "без срок"
        )
        discount = _promotion_discount(promotion)
        if promotion.max_quantity:
            discount += f" (до {promotion.max_quantity} бр.)"
        rows.append(
            [
                promotion.name,
                _promotion_target(promotion),
                discount,
                standard,
                promo_price,
                " ".join(period),
            ]
        )
    return _build_pdf(
        customer,
        title="Вашите промоции",
        intro="Активните и предстоящите промоции за Вас в BRoffice.",
        table_rows=rows,
        col_widths=[30 * mm, 44 * mm, 24 * mm, 26 * mm, 22 * mm, 28 * mm],
    )
