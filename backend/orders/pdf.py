"""Reusable invoice PDF generator (spec #10/#11/#34/#35).

No PDF library existed in the project before this (checked requirements.txt
directly), so reportlab was added — pure-Python, no native system
dependencies, unlike e.g. WeasyPrint which needs a GTK/Cairo toolchain.

Historical snapshot only: every figure printed here comes from the immutable
Order/OrderItem/Invoice rows, never recomputed from current product prices —
"never regenerate historical invoices using current product prices".
"""

from io import BytesIO

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from common.currency import format_eur
from common.emails import LOGO_PATH
from common.fonts import FONT_PATH_CANDIDATES_BOLD, FONT_PATH_CANDIDATES_REGULAR
from common.fonts import find_font_path as _find_font_path

_fonts_registered = False
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def _register_fonts() -> None:
    global _fonts_registered, FONT_REGULAR, FONT_BOLD
    if _fonts_registered:
        return
    _fonts_registered = True
    regular_path = _find_font_path(FONT_PATH_CANDIDATES_REGULAR)
    bold_path = _find_font_path(FONT_PATH_CANDIDATES_BOLD)
    if regular_path:
        pdfmetrics.registerFont(TTFont("Invoice", regular_path))
        FONT_REGULAR = "Invoice"
        FONT_BOLD = "Invoice"
    if bold_path:
        pdfmetrics.registerFont(TTFont("Invoice-Bold", bold_path))
        FONT_BOLD = "Invoice-Bold"


def generate_invoice_pdf(invoice, *, include_profit: bool = False) -> bytes:
    """Renders one Invoice + its Order to a PDF, returned as bytes.

    include_profit adds a "Печалба" column/total — admin-eyes-only. Callers
    must never let a profit-included PDF reach a customer; see
    orders/services.py's get_admin_invoice_pdf_bytes, which deliberately
    never caches onto Invoice.pdf_file (the file the customer-facing
    download/email path reuses)."""
    _register_fonts()
    order = invoice.order

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        title=f"Заявка за поръчка {invoice.number}",
    )

    styles = getSampleStyleSheet()
    for style in styles.byName.values():
        style.fontName = FONT_REGULAR
    title_style = ParagraphStyle(
        "InvoiceTitle", parent=styles["Heading1"], fontName=FONT_BOLD, fontSize=18
    )
    heading_style = ParagraphStyle(
        "InvoiceHeading", parent=styles["Heading2"], fontName=FONT_BOLD, fontSize=11
    )
    normal = styles["Normal"]
    small = ParagraphStyle("Small", parent=normal, fontSize=8, textColor=colors.grey)
    # Plain strings in a Table cell never wrap — they just overflow the
    # column and wreck the layout the moment a product name is long. Only
    # Paragraph flowables respect the column width and wrap onto extra
    # lines (growing the row instead of the page).
    cell_style = ParagraphStyle("Cell", parent=normal, fontSize=8, leading=10)
    # Price cells now show "X лв. (€Y)" — noticeably longer than a bare
    # amount, so these need to wrap too (same reasoning as cell_style above)
    # rather than risk overflowing the narrow price/total columns.
    price_cell_style = ParagraphStyle(
        "PriceCell", parent=cell_style, alignment=TA_RIGHT
    )

    elements = []

    if LOGO_PATH.exists():
        # Real pixel size is 921x271 — scaled here to a fixed height,
        # preserving that aspect ratio, so it never distorts.
        logo_height = 14 * mm
        logo_width = logo_height * (921 / 271)
        elements.append(Image(str(LOGO_PATH), width=logo_width, height=logo_height))
        elements.append(Spacer(1, 4 * mm))
    else:
        elements.append(Paragraph(settings.COMPANY_NAME, title_style))
    company_lines = [settings.COMPANY_ADDRESS, f"ЕИК: {settings.COMPANY_EIK}"]
    if settings.COMPANY_VAT_NUMBER:
        company_lines.append(f"ДДС №: {settings.COMPANY_VAT_NUMBER}")
    company_lines.append(f"{settings.COMPANY_EMAIL} · {settings.COMPANY_PHONE}")
    for line in company_lines:
        elements.append(Paragraph(line, small))
    elements.append(Spacer(1, 8 * mm))

    header_table = Table(
        [
            [
                Paragraph(f"<b>Заявка №</b> {invoice.number}", normal),
                Paragraph(
                    f"<b>Дата на издаване</b> {invoice.issued_at.strftime('%d.%m.%Y')}",
                    normal,
                ),
            ],
            [
                Paragraph(f"<b>Поръчка №</b> {order.number}", normal),
                Paragraph(
                    f"<b>Дата на поръчка</b> {order.created_at.strftime('%d.%m.%Y')}",
                    normal,
                ),
            ],
        ],
        colWidths=[85 * mm, 85 * mm],
    )
    elements.append(header_table)
    elements.append(Spacer(1, 6 * mm))

    elements.append(Paragraph("Клиент", heading_style))
    customer_lines = [order.customer_name or order.customer_email, order.customer_email]
    if order.customer_phone:
        customer_lines.append(order.customer_phone)
    if order.is_company_order:
        customer_lines.append(f"Фирма: {order.company_name}")
        customer_lines.append(f"ЕИК: {order.company_eik}")
        if order.company_vat_number:
            customer_lines.append(f"ДДС №: {order.company_vat_number}")
        if order.company_address:
            customer_lines.append(f"Адрес по регистрация: {order.company_address}")
        if order.company_mol:
            customer_lines.append(f"МОЛ: {order.company_mol}")
    if order.shipping_method == order.SHIPPING_SPEEDY_OFFICE:
        customer_lines.append(f"Доставка до офис на Спиди: {order.speedy_office_name}")
    elif order.delivery_address_line:
        customer_lines.append(
            f"Адрес за доставка: {order.delivery_address_line}, "
            f"{order.delivery_city} {order.delivery_post_code}".strip()
        )
    for line in customer_lines:
        if line:
            elements.append(Paragraph(line, normal))
    elements.append(Spacer(1, 6 * mm))

    # Product number → name → price, per the client's requested column order
    # (no SKU column - that field is being retired sitewide in favor of the
    # supplier's own catalog number, already shown as "№..." everywhere
    # else products are listed).
    table_header = ["№", "Продукт", "Кол-во", "Цена", "Общо"]
    col_widths = [16 * mm, 62 * mm, 14 * mm, 40 * mm, 28 * mm]
    if include_profit:
        table_header.append("Печалба")
        col_widths.append(24 * mm)
    table_data = [table_header]
    for item in order.items.all():
        if item.product_id:
            product_number = item.product.supplier_id or str(
                item.product.item_number or "-"
            )
        else:
            product_number = "-"
        name_html = item.product_name
        if item.discount_label:
            name_html += (
                f'<br/><font size="7" color="#c0392b">{item.discount_label}</font>'
            )
        # Original (strikethrough) + discounted price + % off, when a
        # discount actually applied — previously the PDF only ever showed
        # the already-discounted price with no indication a promotion was
        # involved at all.
        if item.original_unit_price and item.original_unit_price > item.unit_price:
            pct = round((1 - item.unit_price / item.original_unit_price) * 100)
            price_html = (
                f'<font color="grey"><strike>{format_eur(item.original_unit_price)}</strike></font><br/>'
                f'{format_eur(item.unit_price)} <font color="#c0392b">(-{pct}%)</font>'
            )
        else:
            price_html = format_eur(item.unit_price)
        row = [
            product_number,
            Paragraph(name_html, cell_style),
            str(item.quantity),
            Paragraph(price_html, price_cell_style),
            Paragraph(format_eur(item.line_total), price_cell_style),
        ]
        if include_profit:
            row.append(
                Paragraph(format_eur(item.profit_bgn), price_cell_style)
                if item.profit_bgn is not None
                else "-"
            )
        table_data.append(row)
    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_REGULAR),
                ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ]
        )
    )
    elements.append(items_table)
    elements.append(Spacer(1, 6 * mm))

    totals_value_style = ParagraphStyle(
        "TotalsValue", parent=normal, fontSize=9, alignment=TA_RIGHT
    )
    totals_data = [
        [
            "Междинна сума:",
            Paragraph(format_eur(order.subtotal_bgn), totals_value_style),
        ],
    ]
    # Speedy shipping isn't charged for right now (not wired up yet) - no
    # shipping row here on purpose, matching the checkout confirmation
    # screen (see CheckoutPage.tsx/OrderConfirmationPage.tsx).
    if order.coupon_discount_bgn:
        totals_data.append(
            [
                f"Купон ({order.coupon_code}):",
                Paragraph(
                    f"-{format_eur(order.coupon_discount_bgn)}",
                    totals_value_style,
                ),
            ]
        )
    totals_data.append(
        [
            f"ДДС ({order.vat_rate_percent}%):",
            Paragraph(format_eur(order.vat_amount_bgn), totals_value_style),
        ]
    )
    totals_data.append(
        [
            "Общо за плащане:",
            Paragraph(format_eur(order.total_bgn), totals_value_style),
        ]
    )
    totals_table = Table(totals_data, colWidths=[110 * mm, 64 * mm])
    totals_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_REGULAR),
                ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (0, 0), (0, -1), "RIGHT"),
                ("LINEABOVE", (0, -1), (-1, -1), 0.75, colors.HexColor("#0f172a")),
                ("TOPPADDING", (0, -1), (-1, -1), 4),
            ]
        )
    )
    elements.append(totals_table)
    elements.append(Spacer(1, 4 * mm))

    if include_profit and order.total_profit_bgn is not None:
        profit_style = ParagraphStyle(
            "Profit",
            parent=normal,
            fontName=FONT_BOLD,
            fontSize=10,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#15803d"),
        )
        elements.append(
            Paragraph(
                f"Обща печалба: {format_eur(order.total_profit_bgn)}",
                profit_style,
            )
        )
    elements.append(Spacer(1, 8 * mm))

    payment_label = (
        "Наложен платеж"
        if order.payment_method == order.PAYMENT_CASH_ON_DELIVERY
        else order.payment_method
    )
    elements.append(Paragraph(f"Начин на плащане: {payment_label}", small))

    doc.build(elements)
    return buffer.getvalue()
