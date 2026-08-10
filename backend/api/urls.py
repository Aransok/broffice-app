from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AddressViewSet,
    AdminCouponViewSet,
    AdminCustomerActivityView,
    AdminCustomerViewSet,
    AdminDashboardStatsView,
    AdminNotificationViewSet,
    AdminOrderViewSet,
    AdminPriceOverrideViewSet,
    AdminProductViewSet,
    AdminPromotionViewSet,
    AdminUserListView,
    BackupListView,
    BackupRestoreStatusView,
    BackupRestoreView,
    BrandViewSet,
    CartItemDetailView,
    CartItemsView,
    CartView,
    CategoryViewSet,
    ChangePasswordView,
    ContactView,
    CouponValidateView,
    CsrfView,
    FavoriteViewSet,
    HomeSectionsView,
    LoginView,
    LogoutView,
    MeView,
    MyOrderViewSet,
    NavigationView,
    OrderCreateView,
    PageViewSet,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ProductViewSet,
    PublicConfigView,
    RegisterView,
    SearchView,
    SpeedyOfficeListView,
    SpeedyQuoteView,
    TrackProductViewView,
)

router = DefaultRouter()
router.register(r"products", ProductViewSet, basename="product")
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"brands", BrandViewSet, basename="brand")
router.register(r"addresses", AddressViewSet, basename="address")
router.register(r"favorites", FavoriteViewSet, basename="favorite")
router.register(r"pages", PageViewSet, basename="page")
router.register(r"my-orders", MyOrderViewSet, basename="my-order")
router.register(r"admin/products", AdminProductViewSet, basename="admin-product")
router.register(
    r"admin/notifications", AdminNotificationViewSet, basename="admin-notification"
)
router.register(r"admin/orders", AdminOrderViewSet, basename="admin-order")
router.register(r"admin/promotions", AdminPromotionViewSet, basename="admin-promotion")
router.register(r"admin/coupons", AdminCouponViewSet, basename="admin-coupon")
router.register(
    r"admin/price-overrides", AdminPriceOverrideViewSet, basename="admin-price-override"
)
router.register(r"admin/customers", AdminCustomerViewSet, basename="admin-customer")

urlpatterns = [
    path("config/", PublicConfigView.as_view(), name="public-config"),
    path("contact/", ContactView.as_view(), name="contact"),
    path("home-sections/", HomeSectionsView.as_view(), name="home-sections"),
    path("navigation/", NavigationView.as_view(), name="navigation"),
    path("search/", SearchView.as_view(), name="search"),
    path("orders/", OrderCreateView.as_view(), name="order-create"),
    path("coupons/validate/", CouponValidateView.as_view(), name="coupon-validate"),
    path("me/", MeView.as_view(), name="me"),
    path("auth/csrf/", CsrfView.as_view(), name="auth-csrf"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path(
        "auth/change-password/",
        ChangePasswordView.as_view(),
        name="auth-change-password",
    ),
    path(
        "auth/password-reset/",
        PasswordResetRequestView.as_view(),
        name="auth-password-reset",
    ),
    path(
        "auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="auth-password-reset-confirm",
    ),
    path(
        "shipping/speedy/offices/",
        SpeedyOfficeListView.as_view(),
        name="speedy-offices",
    ),
    path("shipping/speedy/quote/", SpeedyQuoteView.as_view(), name="speedy-quote"),
    path("admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path(
        "admin/dashboard/stats/",
        AdminDashboardStatsView.as_view(),
        name="admin-dashboard-stats",
    ),
    path(
        "admin/customers/<int:user_id>/activity/",
        AdminCustomerActivityView.as_view(),
        name="admin-customer-activity",
    ),
    path("activity/track/", TrackProductViewView.as_view(), name="activity-track"),
    path("admin/backups/", BackupListView.as_view(), name="admin-backups"),
    path(
        "admin/backups/status/",
        BackupRestoreStatusView.as_view(),
        name="admin-backup-status",
    ),
    path(
        "admin/backups/<str:name>/restore/",
        BackupRestoreView.as_view(),
        name="admin-backup-restore",
    ),
    path("cart/", CartView.as_view(), name="cart"),
    path("cart/items/", CartItemsView.as_view(), name="cart-items"),
    path(
        "cart/items/<uuid:item_id>/",
        CartItemDetailView.as_view(),
        name="cart-item-detail",
    ),
    path("", include(router.urls)),
]
