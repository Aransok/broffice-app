import { isAxiosError } from 'axios'
import { useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useDashboardStats } from '../api/adminDashboard'
import { syncSupplierCatalog } from '../api/adminProducts'
import { AdminHelpChat, type AdminHelpChatHandle } from '../components/admin/AdminHelpChat'
import { CookieConsentBanner } from '../components/CookieConsentBanner'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/admin', label: 'Начало', end: true, helpKey: 'начало' },
  { to: '/admin/customers', label: 'Клиенти', helpKey: 'клиенти' },
  { to: '/admin/orders', label: 'Поръчки', helpKey: 'поръчки' },
  { to: '/admin/products', label: 'Продукти', helpKey: 'продукти' },
  { to: '/admin/promotions', label: 'Промоции', helpKey: 'промоции' },
  { to: '/admin/coupons', label: 'Купони', helpKey: 'купони' },
  { to: '/admin/chat', label: 'Чат', helpKey: 'помощ' },
]

/**
 * Deliberately its own shell (no customer Header/Footer/mega-menu/cart) so
 * the admin panel reads as a clearly separate area, not a page bolted onto
 * the storefront (spec #2).
 */
function SidebarNav({
  stats,
  onNavigate,
  onAskHelp,
}: {
  stats: { unread_notifications: number } | undefined
  onNavigate?: () => void
  onAskHelp: (topic: string) => void
}) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => (
        <div key={item.to} className="flex items-center gap-1">
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex flex-1 items-center justify-between rounded-ui px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            {item.label}
            {item.to === '/admin/orders' && Boolean(stats?.unread_notifications) && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                {stats!.unread_notifications}
              </span>
            )}
          </NavLink>
          <button
            type="button"
            onClick={() => onAskHelp(item.helpKey)}
            aria-label={`Помощ за ${item.label}`}
            title={`Помощ за ${item.label}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xs font-bold text-slate-500 hover:border-primary hover:text-primary"
          >
            ?
          </button>
        </div>
      ))}
    </nav>
  )
}

export function AdminLayout() {
  const { user, logout } = useAuth()
  const { data: stats } = useDashboardStats()
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  // The fixed-width sidebar squeezes admin content into a sliver on a phone
  // screen — below `lg` it's hidden and this toggles it as a full-width
  // drawer instead, same nav items, no separate mobile-only structure.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const helpChatRef = useRef<AdminHelpChatHandle>(null)
  const askHelp = (topic: string) => helpChatRef.current?.askAbout(topic)

  async function handleSync() {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const result = await syncSupplierCatalog()
      setSyncMessage(`Готово: ${result.created} нови, ${result.updated} обновени.`)
    } catch (err) {
      const detail = isAxiosError<{ detail?: string }>(err) ? err.response?.data?.detail : undefined
      setSyncMessage(detail || 'Синхронизацията не бе успешна.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-slate-50 lg:flex-row">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-surface lg:block">
        <div className="border-b border-slate-200 px-4 py-4">
          <Link to="/admin" className="font-semibold text-slate-900">
            Админ панел
          </Link>
        </div>
        <SidebarNav stats={stats} onAskHelp={askHelp} />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-surface px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen((value) => !value)}
              aria-label="Отвори менюто на админ панела"
              aria-expanded={mobileNavOpen}
              className="rounded-ui border border-slate-300 p-2 text-slate-600 lg:hidden"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              title="Синхронизира каталога с доставчика"
              className="rounded-ui border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-primary/10 disabled:opacity-50"
            >
              {syncing ? 'Синхронизиране...' : 'Синхронизация'}
            </button>
            {syncMessage && <span className="text-sm text-slate-500">{syncMessage}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 sm:gap-4">
            <Link to="/" className="hover:text-primary">
              Към магазина
            </Link>
            <span className="hidden sm:inline">{user?.username}</span>
            <button type="button" onClick={() => logout()} className="hover:text-primary">
              Изход
            </button>
          </div>
        </header>
        {mobileNavOpen && (
          <div className="border-b border-slate-200 bg-surface lg:hidden">
            <SidebarNav
              stats={stats}
              onNavigate={() => setMobileNavOpen(false)}
              onAskHelp={askHelp}
            />
          </div>
        )}
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      <CookieConsentBanner />
      <AdminHelpChat ref={helpChatRef} />
    </div>
  )
}
