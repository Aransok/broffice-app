import uuid
from decimal import ROUND_DOWN, Decimal

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.utils.text import slugify
from rest_framework import serializers

from accounts.models import Address
from activity.models import ProductView
from brands.models import Brand
from categories.models import Category
from coupons.models import Coupon
from favorites.models import Favorite
from navigation.models import Menu, MenuItem
from orders.models import Invoice, Order, OrderItem, OrderNotification
from pages.models import Page
from pages.services import render_page_body
from pricing.models import AdminPriceOverride
from pricing.services import get_base_price, get_effective_price
from products.models import Product, ProductImage, next_item_number
from promotions.models import Promotion
from shipping.models import SpeedyOffice
from shipping.services import get_speedy_client


def is_admin_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    profile = getattr(user, "profile", None)
    return bool(profile and profile.is_admin_portal)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField()

    def validate_new_password(self, value):
        validate_password(value)
        return value


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=64)
    password = serializers.CharField()
    password_confirm = serializers.CharField()
    # Required True — not preselected/defaulted — so consent is always an
    # explicit customer action, never assumed.
    terms_accepted = serializers.BooleanField()

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Вече съществува акаунт с този имейл.")
        return value

    def validate_terms_accepted(self, value):
        if not value:
            raise serializers.ValidationError(
                "Трябва да приемете Общите условия и Политиката за поверителност."
            )
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.get("password_confirm"):
            raise serializers.ValidationError(
                {"password_confirm": "Паролите не съвпадат."}
            )
        validate_password(attrs["password"])
        return attrs


class ProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(max_length=64, required=False, allow_blank=True)

    def validate_email(self, value):
        qs = User.objects.filter(email__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Вече съществува акаунт с този имейл.")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField()
    new_password_confirm = serializers.CharField()

    def validate(self, attrs):
        if attrs["new_password"] != attrs.get("new_password_confirm"):
            raise serializers.ValidationError(
                {"new_password_confirm": "Новите пароли не съвпадат."}
            )
        validate_password(attrs["new_password"])
        return attrs


class PageSerializer(serializers.ModelSerializer):
    body = serializers.SerializerMethodField()
    seo = serializers.SerializerMethodField()

    class Meta:
        model = Page
        fields = ("id", "slug", "title", "body", "updated_at", "seo")

    def get_body(self, obj):
        return render_page_body(obj.body)

    def get_seo(self, obj):
        from seo.services import build_page_seo

        return build_page_seo(obj)


class ContactMessageSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=64, required=False, allow_blank=True)
    subject = serializers.CharField(max_length=255, required=False, allow_blank=True)
    message = serializers.CharField(max_length=5000)


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = (
            "id",
            "label",
            "full_name",
            "phone",
            "city",
            "post_code",
            "address_line",
            "is_default",
            "is_company",
            "company_name",
            "company_eik",
            "company_vat_number",
            "company_address",
            "company_mol",
        )


class SpeedyOfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpeedyOffice
        fields = ("id", "external_id", "name", "city", "address", "phone")


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ("id", "external_id", "slug", "name", "logo_path")


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = (
            "id",
            "external_id",
            "slug",
            "name",
            "parent",
            "image_path",
            "sort_order",
        )


class CategoryDetailSerializer(CategorySerializer):
    """Adds `children` (this category's own subcategories) — only used for
    the single-category retrieve, never the paginated list, so listing all
    ~379 categories never pays a per-row extra query for a field nothing
    there needs (see CategoryViewSet.get_serializer_class)."""

    children = serializers.SerializerMethodField()
    seo = serializers.SerializerMethodField()

    class Meta(CategorySerializer.Meta):
        fields = CategorySerializer.Meta.fields + ("children", "seo")

    def get_children(self, obj):
        children = obj.children.filter(status=Category.STATUS_PUBLISHED).order_by(
            "sort_order", "name"
        )
        return CategorySerializer(children, many=True).data

    def get_seo(self, obj):
        from seo.services import build_category_seo

        return build_category_seo(obj)


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ("id", "path", "alt_text", "sort_order", "thumbnail_path", "webp_path")


class ProductListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name", read_only=True, default=None
    )
    category_slug = serializers.SlugField(
        source="category.slug", read_only=True, default=None
    )
    brand_name = serializers.CharField(
        source="brand.name", read_only=True, default=None
    )
    primary_image = serializers.SerializerMethodField()
    admin_price = serializers.SerializerMethodField()
    promo_price_bgn = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "external_id",
            "item_number",
            "supplier_id",
            "slug",
            "name",
            "category",
            "category_name",
            "category_slug",
            "brand",
            "brand_name",
            "price_bgn",
            "price_eur",
            "old_price_bgn",
            "old_price_eur",
            "client_price",
            "admin_price",
            "currency",
            "availability",
            "primary_image",
            "promo_price_bgn",
            "is_favorited",
        )

    def get_is_favorited(self, obj):
        favorited_ids = self.context.get("favorite_product_ids")
        if favorited_ids is None:
            return False
        return obj.id in favorited_ids

    def get_admin_price(self, obj):
        # Reseller-only pricing — must never reach a non-admin response, even
        # though this serializer is otherwise shared with the public endpoints.
        # str() to match every other decimal field's serialized shape.
        request = self.context.get("request")
        if request and is_admin_user(request.user) and obj.admin_price is not None:
            return str(obj.admin_price)
        return None

    def get_promo_price_bgn(self, obj):
        # `active_promotions`/`user_overrides`/`category_descendant_map` are
        # each computed once per request (not per-product) by the view and
        # passed through context — avoids an N+1 (or worse: N x M recursive
        # category-tree query) cost per row.
        promotions = self.context.get("active_promotions")
        overrides = self.context.get("user_overrides")
        category_descendant_map = self.context.get("category_descendant_map")
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        result = get_effective_price(
            obj,
            user,
            promotions if promotions is not None else [],
            overrides if overrides is not None else {},
            category_descendant_map,
        )
        if result is None or result.source == "base":
            return None
        return str(result.price)

    def get_primary_image(self, obj):
        # obj.images.all() reuses the prefetch_related("images") cache (already
        # ordered by ProductImage.Meta.ordering) instead of issuing a new query.
        images = list(obj.images.all())
        return images[0].path if images else None


class ProductDetailSerializer(ProductListSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    specifications = serializers.JSONField()
    seo = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + (
            "description",
            "short_description",
            "pack_quantity",
            "specifications",
            "images",
            "seo",
        )

    def get_seo(self, obj):
        from seo.services import build_product_seo

        return build_product_seo(obj)


class FavoriteSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        source="product", queryset=Product.objects.all(), write_only=True
    )

    class Meta:
        model = Favorite
        fields = ("id", "product", "product_id", "created_at")


class AdminCustomerSerializer(serializers.Serializer):
    """Summary row for the admin customers table (spec #3) — counts only,
    not nested data, so the list endpoint stays one cheap query per metric
    instead of serializing every customer's full order/cart history."""

    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    date_joined = serializers.DateTimeField()
    is_active = serializers.BooleanField()
    order_count = serializers.IntegerField()
    cart_item_count = serializers.IntegerField()
    promotion_count = serializers.IntegerField()
    price_override_count = serializers.IntegerField()
    activity_count = serializers.IntegerField()


class ProductViewSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    product_image = serializers.SerializerMethodField()
    category_name = serializers.CharField(
        source="category.name", read_only=True, default=None
    )
    price_bgn = serializers.SerializerMethodField()
    effective_price_bgn = serializers.SerializerMethodField()
    price_source = serializers.SerializerMethodField()

    def get_product_image(self, obj):
        images = list(obj.product.images.all()[:1])
        return images[0].path if images else None

    def get_price_bgn(self, obj):
        base = get_base_price(obj.product)
        return str(base) if base is not None else None

    def _effective(self, obj):
        return get_effective_price(
            obj.product,
            self.context.get("pricing_user"),
            self.context.get("active_promotions"),
            self.context.get("user_overrides"),
            self.context.get("category_descendant_map"),
        )

    def get_effective_price_bgn(self, obj):
        result = self._effective(obj)
        return str(result.price) if result else None

    def get_price_source(self, obj):
        result = self._effective(obj)
        return result.label if result and result.source != "base" else None

    class Meta:
        model = ProductView
        fields = (
            "id",
            "product",
            "product_name",
            "product_slug",
            "product_image",
            "category",
            "category_name",
            "view_count",
            "last_viewed_at",
            "price_bgn",
            "effective_price_bgn",
            "price_source",
        )


class AdminPriceOverrideSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = AdminPriceOverride
        fields = (
            "id",
            "product",
            "product_name",
            "user",
            "username",
            "client_price",
            "admin_price",
            "notes",
            "created_at",
        )


class ProductPricingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = (
            "id",
            "external_id",
            "name",
            "client_price",
            "admin_price",
            "price_bgn",
            "price_eur",
        )


class AdminProductWriteSerializer(serializers.ModelSerializer):
    """Create/update for the admin product management page.

    `external_id`/`slug` are auto-generated when omitted — admin-created
    products have no legacy HTTrack id to reuse, unlike imported ones.
    """

    external_id = serializers.CharField(required=False)
    slug = serializers.SlugField(required=False)

    class Meta:
        model = Product
        fields = (
            "id",
            "external_id",
            "item_number",
            "slug",
            "name",
            "description",
            "short_description",
            "brand",
            "category",
            "price_bgn",
            "price_eur",
            "old_price_bgn",
            "old_price_eur",
            "client_price",
            "admin_price",
            "currency",
            "availability",
            "pack_quantity",
            "specifications",
            "status",
        )
        read_only_fields = ("id", "item_number")

    def validate(self, attrs):
        name = attrs.get("name") or getattr(self.instance, "name", "")
        if not attrs.get("slug"):
            # allow_unicode=True — Bulgarian product names are the norm here
            # (see CLAUDE.md: never translate/transliterate), and a plain
            # ASCII-only slugify() silently collapses every Cyrillic name to
            # "" (falling back to the generic "product").
            attrs["slug"] = self._unique_slug(
                slugify(name, allow_unicode=True) or "product"
            )
        if not attrs.get("external_id") and self.instance is None:
            attrs["external_id"] = f"manual-{uuid.uuid4().hex[:12]}"
        return attrs

    def create(self, validated_data):
        validated_data["item_number"] = next_item_number()
        return super().create(validated_data)

    def _unique_slug(self, base: str) -> str:
        slug = base
        suffix = 1
        qs = Product.objects.all()
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        while qs.filter(slug=slug).exists():
            suffix += 1
            slug = f"{base}-{suffix}"
        return slug


class OrderItemSerializer(serializers.ModelSerializer):
    product_image = serializers.SerializerMethodField()
    product_slug = serializers.CharField(
        source="product.slug", read_only=True, default=None
    )
    profit_bgn = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product",
            "product_name",
            "product_external_id",
            "product_sku",
            "product_slug",
            "product_image",
            "quantity",
            "original_unit_price",
            "unit_price",
            "line_total",
            "discount_label",
            "profit_bgn",
        )

    def get_profit_bgn(self, obj):
        # Reseller-cost-derived — admin-eyes-only, same gating as
        # ProductListSerializer.get_admin_price.
        request = self.context.get("request")
        if request and is_admin_user(request.user) and obj.profit_bgn is not None:
            return str(obj.profit_bgn)
        return None

    def get_product_image(self, obj):
        # `product` is nullable (SET_NULL if hard-deleted) — a historical
        # order must still render even if the product it once pointed to is
        # gone. Not a price/name fact, so showing the *current* image (if
        # the product still exists) is fine — unlike money fields, this
        # isn't something that needs a frozen-at-order-time snapshot.
        if obj.product_id is None:
            return None
        images = list(obj.product.images.all()[:1])
        return images[0].path if images else None


class OrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.UUIDField(required=False)
    product_external_id = serializers.CharField(required=False, allow_blank=True)
    quantity = serializers.IntegerField(min_value=1, default=1)


class OrderCreateSerializer(serializers.Serializer):
    customer_email = serializers.EmailField()
    customer_name = serializers.CharField(required=False, allow_blank=True, default="")
    customer_phone = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    items = OrderItemCreateSerializer(many=True)

    address_id = serializers.UUIDField(required=False, allow_null=True)
    shipping_method = serializers.ChoiceField(
        choices=Order.SHIPPING_METHOD_CHOICES,
        required=False,
        allow_blank=True,
        default="",
    )
    delivery_address_line = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    delivery_city = serializers.CharField(required=False, allow_blank=True, default="")
    delivery_post_code = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    speedy_office_id = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    payment_method = serializers.ChoiceField(
        choices=Order.PAYMENT_METHOD_CHOICES, default=Order.PAYMENT_CASH_ON_DELIVERY
    )
    coupon_code = serializers.CharField(required=False, allow_blank=True, default="")

    is_company_order = serializers.BooleanField(required=False, default=False)
    company_name = serializers.CharField(required=False, allow_blank=True, default="")
    company_eik = serializers.CharField(required=False, allow_blank=True, default="")
    company_vat_number = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    company_address = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    company_mol = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        method = attrs.get("shipping_method")
        if method == Order.SHIPPING_SPEEDY_ADDRESS:
            if not attrs.get("delivery_address_line") or not attrs.get("delivery_city"):
                raise serializers.ValidationError(
                    "delivery_address_line and delivery_city are required for speedy_address"
                )
        elif method == Order.SHIPPING_SPEEDY_OFFICE:
            office_id = attrs.get("speedy_office_id")
            if not office_id:
                raise serializers.ValidationError(
                    "speedy_office_id is required for speedy_office"
                )
            if not get_speedy_client().get_office(office_id):
                raise serializers.ValidationError("Unknown speedy_office_id")
        if attrs.get("is_company_order") and (
            not attrs.get("company_name") or not attrs.get("company_eik")
        ):
            raise serializers.ValidationError(
                "company_name and company_eik are required for a company order"
            )
        return attrs


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = ("id", "number", "issued_at", "pdf_file")


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    invoice = InvoiceSerializer(read_only=True)
    # `customer_name`/`customer_email` are whatever was typed at checkout
    # (guest or logged-in) — this is separately "was this a registered
    # account, and which one," so admin can tell which real customer placed
    # a guest-looking order and jump to their customer page.
    user = serializers.IntegerField(source="user_id", read_only=True)
    username = serializers.SerializerMethodField()
    total_profit_bgn = serializers.SerializerMethodField()

    def get_username(self, obj):
        return obj.user.username if obj.user_id else None

    def get_total_profit_bgn(self, obj):
        # Reseller-cost-derived — admin-eyes-only, same gating as
        # ProductListSerializer.get_admin_price.
        request = self.context.get("request")
        if request and is_admin_user(request.user) and obj.total_profit_bgn is not None:
            return str(obj.total_profit_bgn)
        return None

    class Meta:
        model = Order
        fields = (
            "id",
            "number",
            "user",
            "username",
            "customer_email",
            "customer_name",
            "customer_phone",
            "is_company_order",
            "company_name",
            "company_eik",
            "company_vat_number",
            "company_address",
            "company_mol",
            "status",
            "shipping_method",
            "payment_method",
            "delivery_address_line",
            "delivery_city",
            "delivery_post_code",
            "speedy_office_id",
            "speedy_office_name",
            "shipping_cost_bgn",
            "subtotal_bgn",
            "coupon_code",
            "coupon_discount_bgn",
            "vat_rate_percent",
            "vat_amount_bgn",
            "total_bgn",
            "notes",
            "reject_reason",
            "items",
            "invoice",
            "total_profit_bgn",
            "created_at",
        )


class OrderNotificationSerializer(serializers.ModelSerializer):
    order = OrderSerializer(read_only=True)

    class Meta:
        model = OrderNotification
        fields = ("id", "order", "is_read", "message", "created_at")


class PromotionSerializer(serializers.ModelSerializer):
    # Display-only convenience for the admin list (which client, product, or
    # category, if any) — the plain `user`/`product`/`category` fields above
    # stay the writable ids.
    username = serializers.CharField(
        source="user.username", read_only=True, default=None
    )
    product_name = serializers.CharField(
        source="product.name", read_only=True, default=None
    )
    product_number = serializers.SerializerMethodField()
    category_name = serializers.CharField(
        source="category.name", read_only=True, default=None
    )

    def get_product_number(self, obj):
        # Same "one number everywhere" concept as product cards/cart/orders
        # (supplier_id for API-synced products, item_number as a fallback
        # for manually-added ones) - lets the admin tell products with
        # similar names apart in the client's promotions list.
        if not obj.product_id:
            return None
        return obj.product.supplier_id or (
            str(obj.product.item_number) if obj.product.item_number else None
        )

    def validate(self, attrs):
        # Product-scoped promos never get discounted below that product's
        # own reseller/cost price - silently clamped (not rejected) so the
        # admin doesn't lose their place mid-edit, and the stored value
        # itself reflects what's actually applied ("set to 80% but that's
        # below cost, so it's really 62%"), not just a value that gets
        # capped invisibly at checkout time. Category/global promos can't
        # be clamped this way (one % covers many products with different
        # costs) - those are protected at price-resolution time instead,
        # see pricing.services.compute_promo_price.
        scope = attrs.get("scope", getattr(self.instance, "scope", None))
        product = attrs.get("product", getattr(self.instance, "product", None))
        discount_type = attrs.get(
            "discount_type", getattr(self.instance, "discount_type", None)
        )
        value = attrs.get("value", getattr(self.instance, "value", None))
        if (
            scope == Promotion.SCOPE_PRODUCT
            and product is not None
            and value is not None
            and product.admin_price is not None
        ):
            admin_price = product.admin_price
            if discount_type == Promotion.TYPE_FLAT:
                if value < admin_price:
                    attrs["value"] = admin_price
            elif discount_type == Promotion.TYPE_PERCENT:
                base_price = get_base_price(product)
                if base_price and base_price > 0:
                    max_percent = max(
                        Decimal(0),
                        (Decimal(1) - admin_price / base_price) * Decimal(100),
                    )
                    if value > max_percent:
                        attrs["value"] = max_percent.quantize(
                            Decimal("0.01"), rounding=ROUND_DOWN
                        )
        return attrs

    class Meta:
        model = Promotion
        fields = (
            "id",
            "name",
            "discount_type",
            "value",
            "scope",
            "user",
            "username",
            "product",
            "product_name",
            "product_number",
            "category",
            "category_name",
            "active",
            "starts_at",
            "ends_at",
            "status",
            "max_quantity",
        )


class CouponSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username", read_only=True, default=None
    )
    redeemed_by_username = serializers.CharField(
        source="redeemed_by.username", read_only=True, default=None
    )
    redeemed_order_number = serializers.CharField(
        source="redeemed_order.number", read_only=True, default=None
    )
    is_redeemed = serializers.BooleanField(read_only=True)

    class Meta:
        model = Coupon
        fields = (
            "id",
            "code",
            "discount_type",
            "value",
            "min_order_amount",
            "user",
            "username",
            "active",
            "is_redeemed",
            "redeemed_at",
            "redeemed_by_username",
            "redeemed_order_number",
            "created_at",
        )
        read_only_fields = (
            "id",
            "is_redeemed",
            "redeemed_at",
            "redeemed_by_username",
            "redeemed_order_number",
            "created_at",
        )


class MenuItemSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = MenuItem
        fields = ("id", "label", "url", "category", "sort_order", "children")

    def get_children(self, obj):
        qs = obj.children.all()
        return MenuItemSerializer(qs, many=True).data


class MenuSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = Menu
        fields = ("id", "name", "location", "items")

    def get_items(self, obj):
        roots = obj.items.filter(parent__isnull=True)
        return MenuItemSerializer(roots, many=True).data
