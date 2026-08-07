from decimal import Decimal

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone

from accounts.models import Address
from common.currency import format_both_currencies
from coupons.services import (
    calculate_coupon_discount,
    check_min_order_amount,
    get_valid_coupon,
    redeem_coupon,
)
from orders.emails import render_order_email_html
from orders.models import EmailLog, Invoice, Order, OrderItem, OrderNotification
from orders.pdf import generate_invoice_pdf
from pricing.services import get_base_price, get_effective_price, get_user_overrides
from products.models import Product
from promotions.models import Promotion
from promotions.services import get_active_promotions
from shipping.services import get_speedy_client

PAYMENT_METHOD_LABELS = dict(Order.PAYMENT_METHOD_CHOICES)
SHIPPING_METHOD_LABELS = dict(Order.SHIPPING_METHOD_CHOICES)


def _order_lines_text(order: Order) -> str:
    lines = [f"Дата на поръчката: {order.created_at.strftime('%d.%m.%Y %H:%M')}"]
    if order.is_company_order:
        lines.append(f"Фирма: {order.company_name}")
        lines.append(f"ЕИК: {order.company_eik}")
        if order.company_vat_number:
            lines.append(f"ДДС №: {order.company_vat_number}")
        if order.company_address:
            lines.append(f"Адрес по регистрация: {order.company_address}")
        if order.company_mol:
            lines.append(f"МОЛ: {order.company_mol}")
    for item in order.items.all():
        sku_part = f" [{item.product_sku}]" if item.product_sku else ""
        discount_part = f" ({item.discount_label})" if item.discount_label else ""
        lines.append(
            f"- {item.product_name}{sku_part} x{item.quantity} @ "
            f"{format_both_currencies(item.unit_price)}{discount_part} = "
            f"{format_both_currencies(item.line_total)}"
        )
    lines.append(f"Междинна сума: {format_both_currencies(order.subtotal_bgn)}")
    if order.shipping_cost_bgn:
        lines.append(f"Доставка: {format_both_currencies(order.shipping_cost_bgn)}")
    if order.coupon_discount_bgn:
        lines.append(
            f"Купон ({order.coupon_code}): -{format_both_currencies(order.coupon_discount_bgn)}"
        )
    lines.append(
        f"ДДС ({order.vat_rate_percent}%): {format_both_currencies(order.vat_amount_bgn)}"
    )
    lines.append(f"Общо: {format_both_currencies(order.total_bgn)}")
    if order.shipping_method:
        lines.append(
            f"Доставка чрез: {SHIPPING_METHOD_LABELS.get(order.shipping_method, order.shipping_method)}"
        )
        if order.shipping_method == Order.SHIPPING_SPEEDY_OFFICE:
            lines.append(f"Офис: {order.speedy_office_name}")
        else:
            lines.append(
                f"Адрес: {order.delivery_address_line}, {order.delivery_city} {order.delivery_post_code}".strip()
            )
    lines.append(
        f"Плащане: {PAYMENT_METHOD_LABELS.get(order.payment_method, order.payment_method)}"
    )
    return "\n".join(lines)


def send_admin_order_email(order: Order) -> EmailLog:
    subject = f"Нова поръчка {order.number}"
    link = f"{settings.FRONTEND_BASE_URL}/admin/orders?order={order.number}"
    profit_line = (
        f"Обща печалба: {format_both_currencies(order.total_profit_bgn)}\n"
        if order.total_profit_bgn is not None
        else ""
    )
    body = (
        f"Получена е нова поръчка {order.number}.\n"
        f"Клиент: {order.customer_name} <{order.customer_email}>\n\n"
        f"{_order_lines_text(order)}\n"
        f"{profit_line}\n"
        f"Потвърдете или откажете: {link}\n"
    )
    log = EmailLog.objects.create(
        order=order,
        email_type=EmailLog.TYPE_ADMIN_ORDER,
        to_address=settings.ADMIN_ORDER_EMAIL,
        subject=subject,
        body_preview=body[:2000],
        status=EmailLog.STATUS_PENDING,
    )
    try:
        html, inline_images = render_order_email_html(
            order,
            heading="Нова поръчка",
            intro=f"Получена е нова поръчка от {order.customer_name or order.customer_email} "
            f"({order.customer_email}).",
            cta_url=link,
            cta_label="Прегледай поръчката",
            show_profit=True,
        )
        message = EmailMultiAlternatives(
            subject, body, settings.DEFAULT_FROM_EMAIL, [settings.ADMIN_ORDER_EMAIL]
        )
        message.attach_alternative(html, "text/html")
        message.mixed_subtype = "related"
        for image in inline_images:
            message.attach(image)
        message.send(fail_silently=False)
        log.status = EmailLog.STATUS_SENT
        log.sent_at = timezone.now()
        log.save(update_fields=["status", "sent_at"])
    except Exception as exc:  # noqa: BLE001
        log.status = EmailLog.STATUS_FAILED
        log.error = str(exc)
        log.save(update_fields=["status", "error"])
    return log


def get_invoice_pdf_bytes(invoice: Invoice) -> bytes:
    """Generates the PDF once and caches it on Invoice.pdf_file — repeat
    downloads (or resending the email) reuse the cached file instead of
    re-rendering the same immutable snapshot every time."""
    if invoice.pdf_file:
        invoice.pdf_file.open("rb")
        try:
            return invoice.pdf_file.read()
        finally:
            invoice.pdf_file.close()
    pdf_bytes = generate_invoice_pdf(invoice)
    invoice.pdf_file.save(f"{invoice.number}.pdf", ContentFile(pdf_bytes), save=True)
    return pdf_bytes


def get_admin_invoice_pdf_bytes(invoice: Invoice) -> bytes:
    """Admin-only variant with a profit column/total — always regenerated,
    deliberately never cached onto Invoice.pdf_file (that field is reused by
    the customer-facing download/email path via get_invoice_pdf_bytes above,
    and must never carry profit figures)."""
    return generate_invoice_pdf(invoice, include_profit=True)


def deactivate_used_item_promotions(order: Order) -> None:
    """Single-item "+ Промоция" quick-adds targeted at one client (product
    set AND user set — see AdminQuickPromotionButton) are meant as a
    one-time deal, not a standing discount: once the order that used one is
    confirmed, it retires so the item is back to its normal price for any
    future order. Whole-account client promotions (no product set — a
    blanket discount for one client) are left untouched, those are a
    deliberate ongoing benefit, not a single-item one-off. Matched via
    `OrderItem.applied_promotion`, captured at order-creation time, rather
    than re-deriving "which promo was used" from now-possibly-different
    pricing state."""
    promo_ids = {
        item.applied_promotion_id
        for item in order.items.all()
        if item.applied_promotion_id
    }
    if not promo_ids:
        return
    Promotion.objects.filter(
        id__in=promo_ids,
        user__isnull=False,
        product__isnull=False,
        active=True,
    ).update(active=False)


def _build_customer_promo_note(order: Order) -> str | None:
    """A friendly nudge in the customer's confirmation email — only shown
    when a REAL active promotion targeted at this exact customer already
    exists (never invented, never auto-created just to have something to
    show). Admin creates these via the "+ Промоция" quick-add on the order/
    cart views or the full promotions page; this only surfaces one that
    already exists. Target (product/category/global) is independent of
    audience now — any scope can carry a `user`, not just a dedicated
    "user" scope."""
    if order.user_id is None:
        return None
    promos = [p for p in get_active_promotions() if p.user_id == order.user_id]
    if not promos:
        return None
    promo = promos[0]
    if promo.discount_type == Promotion.TYPE_PERCENT:
        discount_text = f"-{promo.value}%"
    else:
        discount_text = f"-{promo.value} лв."
    if promo.product_id:
        scope_text = f" на {promo.product.name}"
    elif promo.category_id:
        scope_text = f" на категория {promo.category.name}"
    else:
        scope_text = ""
    return (
        f"🎁 Като благодарност, че ни избрахте, имате активна индивидуална отстъпка "
        f"{discount_text}{scope_text} за следващата ви поръчка!"
    )


def _send_order_confirmation_email(
    order: Order,
    *,
    email_type: str,
    to_address: str,
    subject: str,
    greeting: str,
    promo_note: str | None = None,
    show_profit: bool = False,
) -> EmailLog:
    """Shared by the customer and admin confirmation emails — same body shape
    (company info + line items + PDF invoice attached), only the recipient/
    greeting/EmailLog type differ. Both calls happen inside the same
    status-guarded `confirm` action (see AdminOrderViewSet.confirm), so
    re-confirming an already-confirmed order 400s before either ever runs
    again — that's what keeps this idempotent, not logic in here.
    """
    company_block = (
        f"{settings.COMPANY_NAME}\n"
        f"{settings.COMPANY_ADDRESS}\n"
        f"ЕИК: {settings.COMPANY_EIK}\n"
        f"{settings.COMPANY_EMAIL} · {settings.COMPANY_PHONE}\n"
    )
    body = (
        f"{greeting}\n\n"
        f"Поръчка {order.number} е потвърдена.\n\n"
        f"Като фактура:\n{_order_lines_text(order)}\n\n"
        f"{company_block}\n"
        f"Благодарим ви!\n"
    )
    log = EmailLog.objects.create(
        order=order,
        email_type=email_type,
        to_address=to_address,
        subject=subject,
        body_preview=body[:2000],
        status=EmailLog.STATUS_PENDING,
    )
    try:
        html, inline_images = render_order_email_html(
            order,
            heading="Поръчката е потвърдена",
            intro=f"{greeting} приложена е фактурата за поръчка {order.number}.",
            promo_note=promo_note,
            show_profit=show_profit,
        )
        message = EmailMultiAlternatives(
            subject, body, settings.DEFAULT_FROM_EMAIL, [to_address]
        )
        message.attach_alternative(html, "text/html")
        message.mixed_subtype = "related"
        for image in inline_images:
            message.attach(image)
        invoice = getattr(order, "invoice", None)
        if invoice is not None:
            pdf_bytes = (
                get_admin_invoice_pdf_bytes(invoice)
                if show_profit
                else get_invoice_pdf_bytes(invoice)
            )
            message.attach(f"{invoice.number}.pdf", pdf_bytes, "application/pdf")
        message.send(fail_silently=False)
        log.status = EmailLog.STATUS_SENT
        log.sent_at = timezone.now()
        log.save(update_fields=["status", "sent_at"])
    except Exception as exc:  # noqa: BLE001
        log.status = EmailLog.STATUS_FAILED
        log.error = str(exc)
        log.save(update_fields=["status", "error"])
    return log


def send_customer_invoice_email(order: Order) -> EmailLog:
    greeting = f"Здравейте{(' ' + order.customer_name) if order.customer_name else ''},"
    return _send_order_confirmation_email(
        order,
        email_type=EmailLog.TYPE_CUSTOMER_INVOICE,
        to_address=order.customer_email,
        subject=f"Фактура / потвърждение на поръчка {order.number}",
        greeting=greeting,
        promo_note=_build_customer_promo_note(order),
    )


def send_admin_confirmation_email(order: Order) -> EmailLog:
    return _send_order_confirmation_email(
        order,
        email_type=EmailLog.TYPE_ADMIN_CONFIRMATION,
        to_address=settings.ADMIN_ORDER_EMAIL,
        subject=f"Поръчка {order.number} потвърдена",
        greeting="Здравейте,",
        show_profit=True,
    )


def issue_invoice_for_order(order: Order) -> Invoice:
    # Issued on confirmation (matches BG practice — an order isn't invoiceable
    # until accepted), not at creation. get_or_create so re-confirming (or a
    # retry) never mints a second invoice number for the same order.
    invoice, _ = Invoice.objects.get_or_create(
        order=order, defaults={"number": Invoice.generate_number()}
    )
    return invoice


def recalc_order_total(order: Order) -> Decimal:
    # order.vat_rate_percent is a frozen snapshot set once at creation — reused
    # here, never refetched from settings, so a later VAT_RATE_PERCENT change
    # can't silently rewrite an existing order's totals.
    subtotal = sum((item.line_total for item in order.items.all()), Decimal(0))
    # Coupon discounts the taxable base (same as an item-level discount
    # would already be baked into subtotal) — VAT is charged on what the
    # customer actually pays, not the pre-discount amount.
    taxable = subtotal + order.shipping_cost_bgn - order.coupon_discount_bgn
    taxable = max(taxable, Decimal(0))
    vat_amount = (taxable * order.vat_rate_percent / Decimal(100)).quantize(
        Decimal("0.01")
    )
    total = taxable + vat_amount
    order.subtotal_bgn = subtotal
    order.vat_amount_bgn = vat_amount
    order.total_bgn = total
    order.save(
        update_fields=["subtotal_bgn", "vat_amount_bgn", "total_bgn", "updated_at"]
    )
    return total


@transaction.atomic
def create_order(
    *,
    user,
    customer_email,
    customer_name="",
    customer_phone="",
    notes="",
    items,
    address_id=None,
    shipping_method="",
    delivery_address_line="",
    delivery_city="",
    delivery_post_code="",
    speedy_office_id="",
    payment_method=Order.PAYMENT_CASH_ON_DELIVERY,
    coupon_code="",
    is_company_order=False,
    company_name="",
    company_eik="",
    company_vat_number="",
    company_address="",
    company_mol="",
) -> Order:
    is_authenticated = user is not None and user.is_authenticated

    address = None
    if address_id and is_authenticated:
        address = Address.objects.filter(id=address_id, user=user).first()

    # Validated up front (before touching the DB further) so a bad/used code
    # fails the whole request with a clear message rather than silently
    # creating an undiscounted order.
    coupon = None
    if coupon_code:
        coupon = get_valid_coupon(coupon_code, user)

    speedy_office_name = ""
    shipping_cost = Decimal(0)
    if shipping_method == Order.SHIPPING_SPEEDY_OFFICE:
        client = get_speedy_client()
        office = client.get_office(speedy_office_id)
        office_city = office.city if office else delivery_city
        speedy_office_name = office.name if office else ""
        shipping_cost = client.calculate_price(
            shipping_method=shipping_method, city=office_city
        )
    elif shipping_method == Order.SHIPPING_SPEEDY_ADDRESS:
        shipping_cost = get_speedy_client().calculate_price(
            shipping_method=shipping_method, city=delivery_city
        )

    order = Order.objects.create(
        number=Order.generate_number(),
        user=user if is_authenticated else None,
        customer_email=customer_email,
        customer_name=customer_name or "",
        customer_phone=customer_phone or "",
        is_company_order=bool(is_company_order),
        company_name=company_name or "",
        company_eik=company_eik or "",
        company_vat_number=company_vat_number or "",
        company_address=company_address or "",
        company_mol=company_mol or "",
        notes=notes or "",
        status=Order.STATUS_PENDING,
        address=address,
        shipping_method=shipping_method or "",
        payment_method=payment_method or Order.PAYMENT_CASH_ON_DELIVERY,
        delivery_address_line=delivery_address_line or "",
        delivery_city=delivery_city or "",
        delivery_post_code=delivery_post_code or "",
        speedy_office_id=speedy_office_id or "",
        speedy_office_name=speedy_office_name,
        shipping_cost_bgn=shipping_cost,
        # Snapshot now, frozen forever — later VAT_RATE_PERCENT changes never
        # touch existing orders (recalc_order_total reuses this, not settings).
        vat_rate_percent=settings.VAT_RATE_PERCENT,
    )

    # Fetched once for the whole order, not once per line item — same N+1
    # avoidance as the product list endpoints.
    pricing_user = user if is_authenticated else None
    active_promotions = get_active_promotions()
    user_overrides = get_user_overrides(pricing_user)

    for raw in items:
        product = None
        if raw.get("product_id"):
            product = Product.objects.filter(id=raw["product_id"]).first()
        elif raw.get("product_external_id"):
            product = Product.objects.filter(
                external_id=raw["product_external_id"]
            ).first()
        if not product:
            continue
        qty = raw.get("quantity") or 1

        # The frontend never gets to name a price — it's always recomputed
        # here from the product + the customer's own pricing rules.
        base = get_base_price(product) or Decimal(0)
        result = get_effective_price(
            product, pricing_user, active_promotions, user_overrides
        )

        # Default: one line for the whole quantity, either discounted or not.
        lines = [
            {
                "quantity": qty,
                "unit_price": (
                    result.price if result and result.source != "base" else base
                ),
                "original_unit_price": (
                    base if result and result.source != "base" else None
                ),
                "discount_label": (
                    result.label if result and result.source != "base" else ""
                ),
                "applied_promotion": result.promotion if result else None,
                "cost_price_bgn": product.admin_price,
            }
        ]
        # A promotion capped to N units (max_quantity) only discounts the
        # first N — the rest of the quantity ordered is billed as a second,
        # undiscounted line for the same product, so "order 100, promo
        # covers 20" doesn't silently discount all 100.
        cap = result.promotion.max_quantity if result and result.promotion else None
        if result and result.source == "promotion" and cap is not None and qty > cap:
            lines = [
                {
                    "quantity": cap,
                    "unit_price": result.price,
                    "original_unit_price": base,
                    "discount_label": result.label,
                    "applied_promotion": result.promotion,
                },
                {
                    "quantity": qty - cap,
                    "unit_price": base,
                    "original_unit_price": None,
                    "discount_label": "",
                    "applied_promotion": None,
                },
            ]

        for line in lines:
            OrderItem.objects.create(
                order=order,
                product=product,
                product_name=product.name,
                product_external_id=product.external_id,
                product_sku=product.sku,
                quantity=line["quantity"],
                original_unit_price=line["original_unit_price"],
                unit_price=line["unit_price"],
                line_total=line["unit_price"] * line["quantity"],
                discount_label=line["discount_label"],
                applied_promotion=line["applied_promotion"],
            )
    if coupon is not None:
        subtotal_for_coupon = sum(
            (item.line_total for item in order.items.all()), Decimal(0)
        )
        # Checked here (not just at the earlier get_valid_coupon call)
        # because the real subtotal isn't known until the items are priced —
        # raising inside the atomic transaction rolls the whole order back
        # rather than silently dropping the coupon.
        check_min_order_amount(coupon, subtotal_for_coupon)
        discount = calculate_coupon_discount(coupon, subtotal_for_coupon)
        order.coupon = coupon
        order.coupon_code = coupon.code
        order.coupon_discount_bgn = discount
        order.save(
            update_fields=["coupon", "coupon_code", "coupon_discount_bgn", "updated_at"]
        )
        # Redeemed only once the order genuinely exists — never a half-used
        # coupon left behind by an order that then fails to save.
        redeem_coupon(coupon, user, order)

    recalc_order_total(order)
    OrderNotification.objects.create(
        order=order, message=f"Нова поръчка {order.number}"
    )
    send_admin_order_email(order)
    return order
