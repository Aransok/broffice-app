from decimal import Decimal

import requests
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.core.mail import EmailMultiAlternatives
from django.db.models import Count, F, Max, Q, Sum
from django.http import HttpResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Address, Profile
from accounts.services import confirm_password_reset, request_password_reset
from activity.models import ProductView
from activity.services import (
    get_recommended_products,
    get_similar_products,
    track_product_view,
)
from brands.models import Brand
from carts.models import CartItem
from carts.services import (
    add_item as cart_add_item,
)
from carts.services import (
    get_or_create_cart,
    price_cart,
)
from carts.services import (
    remove_item as cart_remove_item,
)
from carts.services import (
    set_item_quantity as cart_set_item_quantity,
)
from categories.models import Category
from categories.services import get_descendant_category_ids
from common.emails import BORDER, BRAND_BLUE, MUTED, logo_header_html
from common.pagination import LargePageNumberPagination
from coupons.emails import send_coupon_email
from coupons.models import Coupon
from coupons.services import CouponError, check_min_order_amount, get_valid_coupon
from favorites.models import Favorite
from favorites.services import get_favorited_product_ids
from navigation.models import Menu
from orders.models import Order, OrderItem, OrderNotification
from orders.services import (
    create_order,
    deactivate_used_item_promotions,
    get_admin_invoice_pdf_bytes,
    get_invoice_pdf_bytes,
    issue_invoice_for_order,
    reprice_pending_order,
    send_admin_confirmation_email,
    send_customer_invoice_email,
    send_customer_rejection_email,
)
from pages.models import Page as PageModel
from pricing.models import AdminPriceOverride
from pricing.services import get_user_overrides
from products.management.commands.sync_supplier_catalog import (
    Command as SyncSupplierCatalogCommand,
)
from products.models import Product, ProductImage
from promotions.models import Promotion
from promotions.services import get_active_promotions, promoted_products_q
from shipping.services import get_speedy_client

from .serializers import (
    AddressSerializer,
    AdminCustomerSerializer,
    AdminPriceOverrideSerializer,
    AdminProductWriteSerializer,
    BrandSerializer,
    CategoryDetailSerializer,
    CategorySerializer,
    ChangePasswordSerializer,
    ContactMessageSerializer,
    CouponSerializer,
    FavoriteSerializer,
    MenuSerializer,
    OrderCreateSerializer,
    OrderNotificationSerializer,
    OrderSerializer,
    PageSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProductDetailSerializer,
    ProductImageSerializer,
    ProductListSerializer,
    ProductPricingSerializer,
    ProductViewSerializer,
    ProfileUpdateSerializer,
    PromotionSerializer,
    RegisterSerializer,
    SpeedyOfficeSerializer,
    is_admin_user,
)


class IsAdminPortalUser(BasePermission):
    """Gates every /admin/* API endpoint — deliberately *not* DRF's built-in
    IsAdminUser, which only checks `is_staff`. This app's real admin concept
    is `is_admin_user()` (is_staff OR profile.is_admin_portal — see
    accounts.Profile), which lets a superuser grant access to this app's own
    admin portal without full Django-admin (/django-admin/) staff rights.
    The frontend's route guard (AdminRoute.tsx) already checks
    `is_admin_portal`, not `is_staff` — using DRF's IsAdminUser here would
    silently 403 every request from a portal-only (non-staff) admin who the
    frontend had otherwise already let in."""

    def has_permission(self, request, view):
        return is_admin_user(request.user)


class IsDeveloperUser(BasePermission):
    """Gates the backups endpoints — deliberately narrower than
    IsAdminPortalUser. Any admin can manage products/orders, but restoring
    the database replaces everything currently live, so it's restricted to
    settings.DEVELOPER_USERNAMES (whoever's actually operating this
    deployment), not every admin account — e.g. not the client's own."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.username in settings.DEVELOPER_USERNAMES
        )


class PublicConfigView(APIView):
    """Central VAT + company config exposed read-only so the frontend never
    hardcodes a rate or a company fact — one source of truth in
    config/settings.py. `company_vat_number` is deliberately omitted/empty
    whenever COMPANY_VAT_NUMBER isn't set — never a placeholder or invented
    value, so the frontend can render "no VAT number configured" correctly
    by just checking for an empty string."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "vat_rate_percent": str(settings.VAT_RATE_PERCENT),
                "prices_include_vat": settings.PRICES_INCLUDE_VAT,
                "company_name": settings.COMPANY_NAME,
                "company_eik": settings.COMPANY_EIK,
                "company_vat_number": settings.COMPANY_VAT_NUMBER,
                "company_address": settings.COMPANY_ADDRESS,
                "company_email": settings.COMPANY_EMAIL,
                "company_phone": settings.COMPANY_PHONE,
                "company_working_hours": settings.COMPANY_WORKING_HOURS,
            }
        )


class CsrfView(APIView):
    """Forces the csrftoken cookie to be set so the SPA can read it before any POST."""

    permission_classes = [AllowAny]

    def get(self, request):
        get_token(request)
        return Response({"detail": "ok"})


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        Product.objects.select_related("category", "brand")
        .prefetch_related("images")
        .filter(status=Product.STATUS_PUBLISHED)
    )
    lookup_field = "slug"
    search_fields = ("name", "slug", "external_id", "supplier_id")
    filterset_fields = {
        "brand__slug": ["exact"],
        "category__external_id": ["exact"],
        "price_bgn": ["gte", "lte"],
    }
    ordering_fields = ("name", "price_bgn", "created_at")

    def get_queryset(self):
        qs = super().get_queryset()
        # Handled manually rather than via filterset_fields: a category page
        # must show every product in that category's subtree (children,
        # grandchildren, ...), not just products assigned directly to it -
        # a plain filterset_fields exact match left mid-level categories
        # (anything with only grandchildren-level products) showing nothing
        # until a visitor drilled into one exact leaf.
        category_slug = self.request.query_params.get("category__slug")
        if category_slug:
            category = Category.objects.filter(slug=category_slug).first()
            if category is None:
                return qs.none()
            qs = qs.filter(category_id__in=get_descendant_category_ids(category))
        if self.request.query_params.get("on_promotion"):
            promo_q = promoted_products_q(get_active_promotions())
            qs = qs.filter(promo_q).distinct() if promo_q is not None else qs.none()
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["active_promotions"] = get_active_promotions()
        context["user_overrides"] = get_user_overrides(self.request.user)
        context["favorite_product_ids"] = get_favorited_product_ids(self.request.user)
        return context

    @action(detail=True, methods=["get"])
    def similar(self, request, slug=None):
        product = self.get_object()
        products = get_similar_products(product, limit=8)
        return Response(
            ProductListSerializer(
                products, many=True, context=self.get_serializer_context()
            ).data
        )

    @action(detail=True, methods=["get"])
    def recommended(self, request, slug=None):
        product = self.get_object()
        products = get_recommended_products(
            request.user, exclude_product_id=product.id, limit=8
        )
        return Response(
            ProductListSerializer(
                products, many=True, context=self.get_serializer_context()
            ).data
        )


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.filter(status=Category.STATUS_PUBLISHED)
    serializer_class = CategorySerializer
    lookup_field = "slug"
    search_fields = ("name", "slug", "external_id")
    pagination_class = LargePageNumberPagination

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CategoryDetailSerializer
        return CategorySerializer

    @action(detail=False, methods=["get"])
    def tree(self, request):
        categories = list(
            Category.objects.filter(status=Category.STATUS_PUBLISHED).order_by(
                "sort_order", "name"
            )
        )
        by_parent = {}
        for category in categories:
            by_parent.setdefault(category.parent_id, []).append(category)

        def serialize(category):
            return {
                "id": str(category.id),
                "external_id": category.external_id,
                "slug": category.slug,
                "name": category.name,
                "children": [
                    serialize(child) for child in by_parent.get(category.id, [])
                ],
            }

        roots = by_parent.get(None, [])
        return Response([serialize(root) for root in roots])


class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Brand.objects.filter(status=Brand.STATUS_PUBLISHED)
    serializer_class = BrandSerializer
    lookup_field = "slug"
    pagination_class = LargePageNumberPagination


class NavigationView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        menus = Menu.objects.prefetch_related("items__children").all()
        return Response(MenuSerializer(menus, many=True).data)


class PageViewSet(viewsets.ReadOnlyModelViewSet):
    """About Us / Privacy / Cookie Policy / Terms content (spec #16/#17/#27-29)
    — reuses the pre-existing `Page` model instead of hardcoding this content
    into React components, so the client can edit it later via Django admin
    without a code change."""

    permission_classes = [AllowAny]
    queryset = PageModel.objects.filter(status=PageModel.STATUS_PUBLISHED)
    serializer_class = PageSerializer
    lookup_field = "slug"


class ContactView(APIView):
    """Contact form submission (spec #16) — validated, emailed to the
    company's own inbox. No storage of the message beyond the email itself;
    there's no admin "contact messages" list to keep in sync/secure."""

    permission_classes = [AllowAny]

    def post(self, request):
        ser = ContactMessageSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        subject = f"Запитване от сайта: {data.get('subject') or 'без тема'}"
        text_body = (
            f"Име: {data['name']}\n"
            f"Имейл: {data['email']}\n"
            f"Телефон: {data.get('phone') or '-'}\n\n"
            f"{data['message']}"
        )
        logo_html, logo_image = logo_header_html(settings.COMPANY_NAME)
        message_html = data["message"].replace("\n", "<br>")
        html_body = f"""
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="background:#ffffff;padding:20px 24px;border:1px solid {BORDER};
                border-bottom:3px solid {BRAND_BLUE};border-radius:8px 8px 0 0;">
                {logo_html}
              </td>
            </tr>
            <tr>
              <td style="padding:24px;border:1px solid {BORDER};border-top:none;border-radius:0 0 8px 8px;">
                <h1 style="margin:0 0 16px;font-size:18px;color:#0f172a;">Ново запитване от сайта</h1>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:16px;">
                  <tr><td style="padding:4px 0;color:{MUTED};width:90px;">Име</td><td style="padding:4px 0;color:#0f172a;">{data['name']}</td></tr>
                  <tr><td style="padding:4px 0;color:{MUTED};">Имейл</td><td style="padding:4px 0;color:#0f172a;">{data['email']}</td></tr>
                  <tr><td style="padding:4px 0;color:{MUTED};">Телефон</td><td style="padding:4px 0;color:#0f172a;">{data.get('phone') or '-'}</td></tr>
                  {f'<tr><td style="padding:4px 0;color:{MUTED};">Тема</td><td style="padding:4px 0;color:#0f172a;">{data["subject"]}</td></tr>' if data.get('subject') else ''}
                </table>
                <p style="margin:0;padding:12px 16px;background:#f8fafc;border-radius:8px;color:#0f172a;white-space:pre-line;">{message_html}</p>
              </td>
            </tr>
          </table>
        </div>
        """
        message = EmailMultiAlternatives(
            subject,
            text_body,
            settings.DEFAULT_FROM_EMAIL,
            settings.ADMIN_NOTIFICATION_EMAILS,
            headers={"Reply-To": data["email"]},
        )
        message.attach_alternative(html_body, "text/html")
        if logo_image is not None:
            message.mixed_subtype = "related"
            message.attach(logo_image)
        message.send(fail_silently=False)
        return Response({"detail": "Съобщението е изпратено успешно."})


class SearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        q = (
            request.query_params.get("q") or request.query_params.get("search") or ""
        ).strip()
        qs = (
            Product.objects.select_related("category", "brand")
            .prefetch_related("images")
            .filter(status=Product.STATUS_PUBLISHED)
        )
        # Match products where every word in the query appears in at least one
        # searchable field — not just a literal substring of `name` (a query
        # like "офис стол" previously only matched if that exact phrase, in
        # that exact order, appeared in the name).
        for word in q.split():
            qs = qs.filter(
                Q(name__icontains=word)
                | Q(description__icontains=word)
                | Q(short_description__icontains=word)
                | Q(supplier_id__icontains=word)
                | Q(external_id__icontains=word)
                | Q(brand__name__icontains=word)
                | Q(category__name__icontains=word)
            )
        page = self.paginate(qs[:100])
        serializer = ProductListSerializer(
            page,
            many=True,
            context={
                "request": request,
                "active_promotions": get_active_promotions(),
                "user_overrides": get_user_overrides(request.user),
                "favorite_product_ids": get_favorited_product_ids(request.user),
            },
        )
        return Response({"results": serializer.data, "query": q})

    def paginate(self, qs):
        return list(qs[:24])


def _invoice_pdf_response(order: Order, *, include_profit: bool = False):
    invoice = getattr(order, "invoice", None)
    if invoice is None:
        return Response(
            {"detail": "This order has no invoice yet."},
            status=status.HTTP_404_NOT_FOUND,
        )
    # include_profit must only ever be True for the IsAdminPortalUser-gated
    # admin download action below — it deliberately bypasses the cached
    # Invoice.pdf_file (which the customer-facing OrderViewSet.invoice also
    # reuses) so a profit-bearing PDF can never be handed to a customer.
    pdf_bytes = (
        get_admin_invoice_pdf_bytes(invoice)
        if include_profit
        else get_invoice_pdf_bytes(invoice)
    )
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{invoice.number}.pdf"'
    return response


class CartView(APIView):
    """The customer's own cart — reads/writes the exact same `Cart` row the
    admin per-customer cart tool (`AdminCustomerViewSet.cart`) operates on.
    There is one `Cart` per user; this and the admin endpoints are two
    permission-scoped doors onto the same data, never two separate stores."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart = get_or_create_cart(request.user)
        return Response(price_cart(cart))


class CartItemsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        product = get_object_or_404(Product, pk=request.data.get("product_id"))
        quantity = int(request.data.get("quantity") or 1)
        if quantity < 1:
            return Response(
                {"detail": "quantity must be >= 1"}, status=status.HTTP_400_BAD_REQUEST
            )
        cart = get_or_create_cart(request.user)
        cart_add_item(cart, product, quantity)
        return Response(price_cart(cart), status=status.HTTP_201_CREATED)


class CartItemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, item_id=None):
        cart = get_or_create_cart(request.user)
        get_object_or_404(CartItem, id=item_id, cart=cart)
        try:
            quantity = int(request.data.get("quantity"))
        except (TypeError, ValueError):
            quantity = 0
        if quantity < 1:
            return Response(
                {"detail": "quantity must be >= 1"}, status=status.HTTP_400_BAD_REQUEST
            )
        cart_set_item_quantity(cart, item_id, quantity)
        return Response(price_cart(cart))

    def delete(self, request, item_id=None):
        cart = get_or_create_cart(request.user)
        get_object_or_404(CartItem, id=item_id, cart=cart)
        cart_remove_item(cart, item_id)
        return Response(price_cart(cart))


class MyOrderViewSet(viewsets.ReadOnlyModelViewSet):
    """My Orders / Invoices (spec #22/#23) — the same `OrderSerializer` used
    by the admin endpoint already nests `invoice` (number/issued_at/pdf_file),
    so the Invoices page is just this same data filtered to orders that have
    one, rather than a second endpoint duplicating order data."""

    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer
    lookup_field = "number"

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related(
            "items__product__images"
        )

    @action(detail=True, methods=["get"], url_path="invoice")
    def invoice(self, request, number=None):
        return _invoice_pdf_response(self.get_object())


class HomeSectionsView(APIView):
    """Best Sellers / New Products / Promotions for the homepage (spec #18).

    Best Sellers is computed from real confirmed-order line items — never
    fake/random data. Promotions pulls from the same active-Promotion set the
    centralized pricing engine uses, not a separately hand-picked list.
    """

    permission_classes = [AllowAny]
    # 8 looked reasonable against a handful of legacy/test products; against
    # the real ~3300-product supplier catalog it left the homepage looking
    # almost empty (particularly since Best Sellers/Promotions need real
    # confirmed orders/active promotions to show anything at all).
    SECTION_SIZE = 20

    def get(self, request):
        context = {
            "request": request,
            "active_promotions": get_active_promotions(),
            "user_overrides": get_user_overrides(request.user),
            "favorite_product_ids": get_favorited_product_ids(request.user),
        }

        best_seller_ids = (
            OrderItem.objects.filter(order__status=Order.STATUS_CONFIRMED)
            .values("product_id")
            .annotate(total_qty=Sum("quantity"))
            .order_by("-total_qty")
            .values_list("product_id", flat=True)[: self.SECTION_SIZE]
        )
        best_sellers_by_id = {
            p.id: p
            for p in Product.objects.filter(
                id__in=list(best_seller_ids), status=Product.STATUS_PUBLISHED
            ).select_related("category", "brand")
        }
        best_sellers = [
            best_sellers_by_id[pid]
            for pid in best_seller_ids
            if pid in best_sellers_by_id
        ]

        new_products = list(
            Product.objects.filter(status=Product.STATUS_PUBLISHED)
            .select_related("category", "brand")
            .order_by("-created_at")[: self.SECTION_SIZE]
        )

        promo_q = promoted_products_q(context["active_promotions"])
        promo_qs = Product.objects.filter(
            status=Product.STATUS_PUBLISHED
        ).select_related("category", "brand")
        if promo_q is not None:
            promoted_products = list(
                promo_qs.filter(promo_q)
                .distinct()
                .order_by("-created_at")[: self.SECTION_SIZE]
            )
        else:
            promoted_products = []

        # Empty for guests/no-activity users — the frontend hides the
        # section entirely then, same as it already does for Best
        # Sellers/Promotions when those come back empty.
        recommended = list(
            get_recommended_products(request.user, limit=self.SECTION_SIZE)
        )

        return Response(
            {
                "best_sellers": ProductListSerializer(
                    best_sellers, many=True, context=context
                ).data,
                "new_products": ProductListSerializer(
                    new_products, many=True, context=context
                ).data,
                "promotions": ProductListSerializer(
                    promoted_products, many=True, context=context
                ).data,
                "recommended": ProductListSerializer(
                    recommended, many=True, context=context
                ).data,
            }
        )


class OrderCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = OrderCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        try:
            order = create_order(
                user=request.user,
                customer_email=data["customer_email"],
                customer_name=data.get("customer_name") or "",
                customer_phone=data.get("customer_phone") or "",
                notes=data.get("notes") or "",
                items=data["items"],
                address_id=data.get("address_id"),
                shipping_method=data.get("shipping_method") or "",
                delivery_address_line=data.get("delivery_address_line") or "",
                delivery_city=data.get("delivery_city") or "",
                delivery_post_code=data.get("delivery_post_code") or "",
                speedy_office_id=data.get("speedy_office_id") or "",
                payment_method=data.get("payment_method")
                or Order.PAYMENT_CASH_ON_DELIVERY,
                coupon_code=data.get("coupon_code") or "",
                is_company_order=data.get("is_company_order") or False,
                company_name=data.get("company_name") or "",
                company_eik=data.get("company_eik") or "",
                company_vat_number=data.get("company_vat_number") or "",
                company_address=data.get("company_address") or "",
                company_mol=data.get("company_mol") or "",
            )
        except CouponError as exc:
            return Response(
                {"coupon_code": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class AdminProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminPortalUser]
    queryset = (
        Product.objects.select_related("category", "brand")
        .prefetch_related("images")
        # profit isn't a stored column - annotated here so it's sortable
        # via ?ordering=profit the same way as any real field. Matches
        # the frontend's own computeProfitBgn (client_price - admin_price)
        # exactly, including staying NULL (sorts to one end) when either
        # price is unset, same as the "—" it shows in that case.
        .annotate(profit=F("client_price") - F("admin_price"))
        .all()
    )
    search_fields = ("name", "slug", "external_id", "supplier_id")
    filterset_fields = ("category__external_id", "brand__external_id", "status")
    ordering_fields = (
        "external_id",
        "name",
        "price_bgn",
        "client_price",
        "admin_price",
        "profit",
    )

    def get_queryset(self):
        qs = super().get_queryset()
        # ?zero_price=1 powers the admin products page's "needs a real
        # price" quick-fix panel - client_price is set once from the
        # supplier feed at creation and never auto-corrected on resync (so a
        # manual price edit always survives), so a bad starting value (the
        # supplier had no price for that SKU yet) otherwise sits there
        # unnoticed until someone happens to open that exact product.
        if self.request.query_params.get("zero_price"):
            qs = qs.filter(Q(client_price__isnull=True) | Q(client_price=0))
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return AdminProductWriteSerializer
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    def get_serializer_context(self):
        # Without this, ProductListSerializer.get_promo_price_bgn falls back
        # to an empty active_promotions list (its default when the key is
        # missing from context) and promo_price_bgn comes back None for
        # every product — the admin list/profit figures would silently
        # ignore active promotions entirely, showing full pre-discount
        # profit even on a product that's currently on sale.
        context = super().get_serializer_context()
        context["active_promotions"] = get_active_promotions()
        context["user_overrides"] = get_user_overrides(self.request.user)
        return context

    @action(detail=True, methods=["get", "patch"], url_path="pricing")
    def pricing(self, request, pk=None):
        product = self.get_object()
        if request.method.lower() == "get":
            return Response(ProductPricingSerializer(product).data)
        ser = ProductPricingSerializer(product, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="images",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_images(self, request, pk=None):
        product = self.get_object()
        files = request.FILES.getlist("images") or request.FILES.getlist("image")
        if not files:
            return Response(
                {"detail": "No files provided (expected 'images' field)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        start = (product.images.aggregate(m=Max("sort_order"))["m"] or 0) + 1
        created = []
        for offset, uploaded in enumerate(files):
            saved_path = default_storage.save(
                f"products/{product.id}/{uploaded.name}", uploaded
            )
            created.append(
                ProductImage.objects.create(
                    product=product,
                    path=saved_path,
                    file_size=uploaded.size,
                    sort_order=start + offset,
                )
            )
        return Response(
            ProductImageSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["delete"], url_path=r"images/(?P<image_id>[^/.]+)")
    def delete_image(self, request, pk=None, image_id=None):
        product = self.get_object()
        image = get_object_or_404(ProductImage, id=image_id, product=product)
        if image.path.startswith("products/"):
            default_storage.delete(image.path)
        image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def destroy(self, request, *args, **kwargs):
        # Soft delete: archive instead of hard-deleting, so historical orders
        # that reference this product (OrderItem.product, SET_NULL on hard
        # delete) never lose their product link, and it simply disappears
        # from the public catalog (already filtered to status=published).
        product = self.get_object()
        product.status = Product.STATUS_ARCHIVED
        product.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="sync")
    def sync(self, request):
        # Runs the sync inline (not via Celery) — the whole catalog is ~30
        # supplier pages, so this genuinely takes real time (a minute-plus),
        # not "a few dozen requests." Calls Command().handle() directly
        # rather than call_command()/manage.py: both of those route through
        # BaseCommand.execute(), which does `self.stdout.write(output)` on
        # whatever handle() returns — fine for a string, but crashes on the
        # (created, updated) tuple this command needs to hand back here.
        if not settings.SUPPLIER_CATALOG_API_KEY:
            return Response(
                {
                    "detail": "SUPPLIER_CATALOG_API_KEY не е зададен в .env — "
                    "синхронизацията не може да се стартира."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            sync_command = SyncSupplierCatalogCommand()
            sync_command.handle()
        except requests.RequestException as exc:
            return Response(
                {"detail": f"Грешка при връзка с доставчика: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            {
                "created": sync_command.created_count,
                "updated": sync_command.updated_count,
            }
        )


class AdminNotificationViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAdminPortalUser]
    serializer_class = OrderNotificationSerializer
    queryset = OrderNotification.objects.select_related(
        "order", "order__user"
    ).prefetch_related("order__items__product__images")

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        note = self.get_object()
        note.is_read = True
        note.save(update_fields=["is_read", "updated_at"])
        return Response(OrderNotificationSerializer(note).data)


class AdminOrderViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdminPortalUser]
    queryset = Order.objects.select_related("user").prefetch_related(
        "items__product__images"
    )
    serializer_class = OrderSerializer
    lookup_field = "number"
    filterset_fields = ("user", "status")

    @action(detail=True, methods=["get"], url_path="invoice")
    def invoice(self, request, number=None):
        return _invoice_pdf_response(self.get_object(), include_profit=True)

    @action(detail=True, methods=["post"])
    def confirm(self, request, number=None):
        order = self.get_object()
        if order.status != Order.STATUS_PENDING:
            return Response(
                {"detail": "Order is not pending"}, status=status.HTTP_400_BAD_REQUEST
            )
        order.status = Order.STATUS_CONFIRMED
        order.save(update_fields=["status", "updated_at"])
        issue_invoice_for_order(order)
        deactivate_used_item_promotions(order)
        send_customer_invoice_email(order)
        send_admin_confirmation_email(order)
        return Response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def reprice(self, request, number=None):
        # Re-checks current promotions against a still-pending order before
        # it's confirmed — lets admin apply a promotion the customer missed,
        # or pick up one that started after the order came in, so the
        # invoice that goes out on confirm reflects the real, current price
        # rather than being permanently stuck at checkout-time pricing.
        order = self.get_object()
        try:
            reprice_pending_order(order)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, number=None):
        order = self.get_object()
        if order.status != Order.STATUS_PENDING:
            return Response(
                {"detail": "Order is not pending"}, status=status.HTTP_400_BAD_REQUEST
            )
        reason = request.data.get("reason") or "Липса на продукт / отказана поръчка"
        order.status = Order.STATUS_REJECTED
        order.reject_reason = reason
        order.save(update_fields=["status", "reject_reason", "updated_at"])
        send_customer_rejection_email(order)
        return Response(OrderSerializer(order, context={"request": request}).data)


class AdminPromotionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminPortalUser]
    queryset = Promotion.objects.select_related("user", "product", "category")
    serializer_class = PromotionSerializer
    filterset_fields = ("scope", "active", "discount_type", "user", "product")
    search_fields = ("name",)


class AdminCouponViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminPortalUser]
    queryset = Coupon.objects.select_related(
        "user", "redeemed_by", "redeemed_order"
    ).all()
    serializer_class = CouponSerializer
    filterset_fields = ("active", "user")
    search_fields = ("code",)

    def perform_create(self, serializer):
        code = (serializer.validated_data.get("code") or "").strip().upper()
        serializer.save(code=code or Coupon.generate_code())

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        coupon = Coupon.objects.get(id=response.data["id"])
        email_sent = False
        email_error = None
        if coupon.user_id is not None:
            # A coupon-creation 201 must never be blocked by an email
            # provider hiccup — the code is real and usable either way; the
            # admin just also gets told directly whether the heads-up email
            # actually went out, rather than the response silently claiming
            # success on both.
            try:
                email_sent = send_coupon_email(coupon)
            except Exception as exc:  # noqa: BLE001
                email_error = str(exc)
        response.data["email_sent"] = email_sent
        if email_error:
            response.data["email_error"] = email_error
        return response


class CouponValidateView(APIView):
    """Customer-facing: checks a code at checkout before the order is
    actually submitted — a preview only, the real (and only enforced)
    validation happens again inside create_order at submit time, same
    "server never trusts a client-side check" rule as pricing everywhere
    else in this app."""

    permission_classes = [AllowAny]

    def post(self, request):
        code = (request.data.get("code") or "").strip()
        if not code:
            return Response(
                {"detail": "Въведете купон код."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            coupon = get_valid_coupon(code, request.user)
            subtotal = request.data.get("subtotal")
            if subtotal is not None:
                check_min_order_amount(coupon, Decimal(str(subtotal)))
        except CouponError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "code": coupon.code,
                "discount_type": coupon.discount_type,
                "value": str(coupon.value),
            }
        )


class AdminPriceOverrideViewSet(viewsets.ModelViewSet):
    """Per-customer individual pricing — see pricing/services.py for how this
    is applied (always beats promotions, never stacks)."""

    permission_classes = [IsAdminPortalUser]
    queryset = AdminPriceOverride.objects.select_related("product", "user").all()
    serializer_class = AdminPriceOverrideSerializer
    filterset_fields = ("product", "user")


class AdminDashboardStatsView(APIView):
    """One-call summary for the admin dashboard landing page — avoids the
    frontend firing off several paginated list requests just to read counts."""

    permission_classes = [IsAdminPortalUser]

    def get(self, request):
        return Response(
            {
                "pending_orders": Order.objects.filter(
                    status=Order.STATUS_PENDING
                ).count(),
                "unread_notifications": OrderNotification.objects.filter(
                    is_read=False
                ).count(),
                "total_customers": User.objects.filter(is_staff=False).count(),
                "total_products": Product.objects.filter(
                    status=Product.STATUS_PUBLISHED
                ).count(),
            }
        )


class AdminCustomerViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    """The admin customers table (spec #3) — summary counts only; the detail
    page composes this with the already-existing admin/orders, admin/price-
    overrides and admin/promotions endpoints (each filterable by ?user=<id>)
    plus the activity endpoint, rather than duplicating that data here.

    Deletable (not just read-only) so admin can remove a customer account
    on request. Safe to actually delete the User row: Order.user is
    SET_NULL (orders/invoices are already denormalized with
    customer_name/email/phone, so real order history survives losing the
    account), and get_queryset already excludes staff — an admin account
    simply 404s here rather than being deletable through this endpoint."""

    permission_classes = [IsAdminPortalUser]
    serializer_class = AdminCustomerSerializer

    def get_queryset(self):
        qs = User.objects.filter(is_staff=False).annotate(
            order_count=Count("orders", distinct=True),
            cart_item_count=Count("cart__items", distinct=True),
            promotion_count=Count("promotions", distinct=True),
            price_override_count=Count("price_overrides", distinct=True),
            activity_count=Count("product_views", distinct=True),
        )
        q = (self.request.query_params.get("search") or "").strip()
        if q:
            qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q))
        return qs.order_by("-date_joined")

    @action(detail=True, methods=["get"], url_path="cart")
    def cart(self, request, pk=None):
        # Same Cart row a logged-in customer's own storefront cart reads from
        # (see CartView/CartItemView below) — admin is looking at the actual
        # customer cart, not a separate admin-only copy of it.
        customer = self.get_object()
        cart = get_or_create_cart(customer)
        return Response(price_cart(cart))

    @action(detail=True, methods=["post"], url_path="cart/items")
    def add_cart_item(self, request, pk=None):
        customer = self.get_object()
        product = get_object_or_404(Product, pk=request.data.get("product_id"))
        quantity = int(request.data.get("quantity") or 1)
        if quantity < 1:
            return Response(
                {"detail": "quantity must be >= 1"}, status=status.HTTP_400_BAD_REQUEST
            )
        cart = get_or_create_cart(customer)
        cart_add_item(cart, product, quantity)
        return Response(price_cart(cart), status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"cart/items/(?P<item_id>[^/.]+)",
    )
    def cart_item_detail(self, request, pk=None, item_id=None):
        customer = self.get_object()
        cart = get_or_create_cart(customer)
        get_object_or_404(CartItem, id=item_id, cart=cart)
        if request.method == "DELETE":
            cart_remove_item(cart, item_id)
            return Response(price_cart(cart))
        quantity = request.data.get("quantity")
        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            quantity = 0
        if quantity < 1:
            return Response(
                {"detail": "quantity must be >= 1"}, status=status.HTTP_400_BAD_REQUEST
            )
        cart_set_item_quantity(cart, item_id, quantity)
        return Response(price_cart(cart))


class AdminUserListView(APIView):
    """Minimal user search for the promotions admin page's user picker."""

    permission_classes = [IsAdminPortalUser]

    def get(self, request):
        q = (request.query_params.get("search") or "").strip()
        qs = User.objects.all()
        if q:
            qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q))
        qs = qs.order_by("username")[:20]
        return Response(
            [{"id": u.id, "username": u.username, "email": u.email} for u in qs]
        )


def serialize_user(user):
    profile = getattr(user, "profile", None)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": profile.phone if profile else "",
        "is_staff": user.is_staff,
        "is_admin_portal": bool(profile and profile.is_admin_portal) or user.is_staff,
        "is_developer": user.username in settings.DEVELOPER_USERNAMES,
    }


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(serialize_user(request.user))

    def patch(self, request):
        ser = ProfileUpdateSerializer(
            instance=request.user, data=request.data, partial=True
        )
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        user = request.user
        if "first_name" in data:
            user.first_name = data["first_name"]
        if "last_name" in data:
            user.last_name = data["last_name"]
        if "email" in data:
            user.email = data["email"]
            user.username = data["email"]
        user.save()
        if "phone" in data:
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.phone = data["phone"]
            profile.save(update_fields=["phone", "updated_at"])
        return Response(serialize_user(user))


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        user = User.objects.create_user(
            username=data["email"],
            email=data["email"],
            password=data["password"],
            first_name=data["first_name"],
            last_name=data.get("last_name") or "",
        )
        Profile.objects.update_or_create(
            user=user,
            defaults={
                "phone": data["phone"],
                # Recorded, not assumed — an auditable timestamp that this
                # specific account explicitly accepted the current Terms/
                # Privacy Policy at signup.
                "terms_accepted_at": timezone.now(),
            },
        )
        login(request, user)
        return Response(serialize_user(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        username = request.data.get("username") or ""
        password = request.data.get("password") or ""
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {"detail": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST
            )
        login(request, user)
        return Response(serialize_user(user))


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "auth"

    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        if not request.user.check_password(data["current_password"]):
            return Response(
                {"detail": "Текущата парола е грешна."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.set_password(data["new_password"])
        request.user.save(update_fields=["password"])
        # Re-establish the session under the new password hash so the user
        # isn't unexpectedly logged out by their own password change.
        update_session_auth_hash(request, request.user)
        return Response({"detail": "Паролата е сменена успешно."})


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        request_password_reset(ser.validated_data["email"])
        # Always the same response whether or not the email matched an
        # account — the request-side already guarantees no enumeration.
        return Response(
            {"detail": "Ако имейлът съществува, изпратихме линк за смяна на паролата."}
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ok = confirm_password_reset(
            ser.validated_data["uid"],
            ser.validated_data["token"],
            ser.validated_data["new_password"],
        )
        if not ok:
            return Response(
                {"detail": "Линкът е невалиден или изтекъл."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"detail": "Паролата е сменена успешно."})


class AddressViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AddressSerializer

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def _clear_other_defaults(self, exclude_pk=None):
        qs = Address.objects.filter(user=self.request.user, is_default=True)
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        qs.update(is_default=False)

    def perform_create(self, serializer):
        if serializer.validated_data.get("is_default"):
            self._clear_other_defaults()
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        if serializer.validated_data.get("is_default"):
            self._clear_other_defaults(exclude_pk=serializer.instance.pk)
        serializer.save()


class FavoriteViewSet(viewsets.ModelViewSet):
    """Wishlist — persisted per logged-in user so it follows them across devices."""

    permission_classes = [IsAuthenticated]
    serializer_class = FavoriteSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return (
            Favorite.objects.filter(user=self.request.user)
            .select_related("product__category", "product__brand")
            .prefetch_related("product__images")
        )

    def create(self, request, *args, **kwargs):
        product = get_object_or_404(
            Product, pk=request.data.get("product_id") or request.data.get("product")
        )
        favorite, _ = Favorite.objects.get_or_create(user=request.user, product=product)
        return Response(
            FavoriteSerializer(favorite, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"])
    def toggle(self, request):
        # Lets the product-card heart icon flip state in one call instead of
        # the frontend having to look up the favorite's id first.
        product = get_object_or_404(
            Product, pk=request.data.get("product_id") or request.data.get("product")
        )
        favorite = Favorite.objects.filter(user=request.user, product=product).first()
        if favorite:
            favorite.delete()
            return Response({"favorited": False})
        Favorite.objects.create(user=request.user, product=product)
        return Response({"favorited": True})


class TrackProductViewView(APIView):
    """Records that the logged-in customer viewed a product.

    Authenticated-only by design (spec #26 privacy constraints) — anonymous
    browsing is never tracked, so there's no cookie/fingerprint tracking to
    consent-gate here.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        product = get_object_or_404(Product, pk=request.data.get("product_id"))
        view = track_product_view(request.user, product)
        return Response(ProductViewSerializer(view).data)


class AdminCustomerActivityView(APIView):
    """Per-customer viewed products/categories, for admin to inform individual
    promotions (spec #26). Scoped to one explicit customer id — an admin can
    never list all customers' activity in one undifferentiated feed."""

    permission_classes = [IsAdminPortalUser]

    def get(self, request, user_id=None):
        qs = (
            ProductView.objects.filter(user_id=user_id)
            .select_related("product", "category")
            .prefetch_related("product__images")
            .order_by("-last_viewed_at")
        )
        target_user = User.objects.filter(id=user_id).first()
        context = {
            # Same pricing engine every storefront/cart view uses — the
            # price shown here is exactly what this customer would actually
            # pay right now, e.g. immediately reflecting a promotion an
            # admin just added from this same tab.
            "active_promotions": get_active_promotions(),
            "user_overrides": get_user_overrides(target_user),
            "pricing_user": target_user,
        }
        return Response(ProductViewSerializer(qs, many=True, context=context).data)


class SpeedyOfficeListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        city = request.query_params.get("city") or ""
        query = request.query_params.get("q") or ""
        offices = get_speedy_client().search_offices(city, query)
        return Response(SpeedyOfficeSerializer(offices, many=True).data)


class SpeedyQuoteView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        shipping_method = request.data.get("shipping_method") or ""
        if shipping_method not in ("speedy_address", "speedy_office"):
            return Response(
                {"detail": "shipping_method must be speedy_address or speedy_office"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        city = request.data.get("city") or ""
        # Not actually charged right now (Speedy isn't wired up for real
        # yet - confirmed with the client) - calculate_price is still
        # called so the integration point stays exercised, but the
        # quoted amount is discarded rather than returned, so this can
        # never show a different number than what create_order actually
        # charges (0).
        get_speedy_client().calculate_price(shipping_method=shipping_method, city=city)
        return Response({"shipping_cost_bgn": "0.00"})


class BackupListView(APIView):
    permission_classes = [IsDeveloperUser]

    def get(self, request):
        from backups.services import list_backups

        return Response(list_backups())


class BackupRestoreView(APIView):
    permission_classes = [IsDeveloperUser]

    def post(self, request, name):
        from backups.services import request_restore

        try:
            request_restore(name)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Restore requested."})


class BackupRestoreStatusView(APIView):
    permission_classes = [IsDeveloperUser]

    def get(self, request):
        from backups.services import get_restore_status

        return Response(get_restore_status())
