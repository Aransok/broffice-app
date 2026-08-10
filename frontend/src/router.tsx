import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AdminRoute } from './components/AdminRoute'
import { RequireAuth } from './components/RequireAuth'
import { AccountLayout } from './layouts/AccountLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { RootLayout } from './layouts/RootLayout'
import { AccountAddressesPage } from './pages/account/AccountAddressesPage'
import { AccountChangePasswordPage } from './pages/account/AccountChangePasswordPage'
import { AccountFavoritesPage } from './pages/account/AccountFavoritesPage'
import { AccountInvoicesPage } from './pages/account/AccountInvoicesPage'
import { AccountOrderDetailPage } from './pages/account/AccountOrderDetailPage'
import { AccountOrdersPage } from './pages/account/AccountOrdersPage'
import { AccountProfilePage } from './pages/account/AccountProfilePage'
import { AdminBackupsPage } from './pages/admin/AdminBackupsPage'
import { AdminChatPage } from './pages/admin/AdminChatPage'
import { AdminCustomerDetailPage } from './pages/admin/AdminCustomerDetailPage'
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminNotificationsPage } from './pages/admin/AdminNotificationsPage'
import { AdminProductsPage } from './pages/admin/AdminProductsPage'
import { AdminCouponsPage } from './pages/admin/AdminCouponsPage'
import { AdminPromotionsPage } from './pages/admin/AdminPromotionsPage'
import { CartPage } from './pages/CartPage'
import { CatalogPage } from './pages/CatalogPage'
import { CategoryPage } from './pages/CategoryPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { ContactPage } from './pages/ContactPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { HomePage } from './pages/HomePage'
import { LegalPage } from './pages/LegalPage'
import { LoginPage } from './pages/LoginPage'
import { OrderConfirmationPage } from './pages/OrderConfirmationPage'
import { ProductPage } from './pages/ProductPage'
import { PromotionsPage } from './pages/PromotionsPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SearchPage } from './pages/SearchPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'category/:slug', element: <CategoryPage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'promotions', element: <PromotionsPage /> },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password/:uid/:token', element: <ResetPasswordPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'order-confirmation', element: <OrderConfirmationPage /> },
      { path: 'about', element: <LegalPage slug="about-us" /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'terms', element: <LegalPage slug="terms-and-conditions" /> },
      { path: 'privacy-policy', element: <LegalPage slug="privacy-policy" /> },
      { path: 'cookie-policy', element: <LegalPage slug="cookie-policy" /> },
      { path: 'returns', element: <LegalPage slug="returns-and-withdrawal" /> },
      // Pre-restructure admin routes — kept as redirects so nothing bookmarked
      // this session breaks; the real pages now live under /admin/*.
      // (`/promotions` itself is no longer one of these — it's now the real
      // public promotions listing above; nothing links to the admin manager
      // via this path, only via /admin/promotions directly.)
      { path: 'products', element: <Navigate to="/admin/products" replace /> },
      { path: 'notifications', element: <Navigate to="/admin/orders" replace /> },
      {
        path: 'account',
        element: (
          <RequireAuth>
            <AccountLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: 'profile', element: <AccountProfilePage /> },
          { path: 'orders', element: <AccountOrdersPage /> },
          { path: 'orders/:number', element: <AccountOrderDetailPage /> },
          { path: 'invoices', element: <AccountInvoicesPage /> },
          { path: 'addresses', element: <AccountAddressesPage /> },
          { path: 'favorites', element: <AccountFavoritesPage /> },
          { path: 'password', element: <AccountChangePasswordPage /> },
        ],
      },
    ],
  },
  {
    path: '/admin',
    element: (
      <AdminRoute>
        <AdminLayout />
      </AdminRoute>
    ),
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'customers', element: <AdminCustomersPage /> },
      { path: 'customers/:id', element: <AdminCustomerDetailPage /> },
      { path: 'orders', element: <AdminNotificationsPage /> },
      { path: 'products', element: <AdminProductsPage /> },
      { path: 'promotions', element: <AdminPromotionsPage /> },
      { path: 'coupons', element: <AdminCouponsPage /> },
      { path: 'chat', element: <AdminChatPage /> },
      { path: 'backups', element: <AdminBackupsPage /> },
    ],
  },
])
