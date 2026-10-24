import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useDashboardStats } from '../../api/adminDashboard'
import { usePublicConfig } from '../../api/config'
import logoLight from '../../assets/logo-light.png'
import logo from '../../assets/logo.png'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useTheme } from '../../context/ThemeContext'
import { useVat } from '../../context/VatContext'
import { getPreviewUser } from '../../preview'
import { playNotificationSound } from '../../utils/notificationSound'
import { CategoriesMegaMenu } from './CategoriesMegaMenu'
import { InstantSearch } from '../bold/InstantSearch'

export function Header() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { itemCount } = useCart()
  const { user, logout } = useAuth()
  const { data: stats } = useDashboardStats(Boolean(user?.is_admin_portal))
  const { showInclVat, setShowInclVat } = useVat()
  const { data: config } = usePublicConfig()
  const { mode, setMode, preset, isEnabled } = useTheme()
  // Bold has an ink-navy header, where the blue 'BR' would vanish: a white
  // 'BR' + the same orange 'office' keeps the logo readable without a box.
  const logoSrc = preset === 'bold' ? logoLight : logo
  const searchRef = useRef<HTMLInputElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!searchWrapRef.current?.contains(event.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Plays a short tone whenever the polled unread-notifications count goes
  // up while an admin is logged in — the badge already updates visually,
  // this just means they don't have to be looking at the tab to notice a
  // new order came in. `undefined` on the very first load is deliberately
  // not treated as "went up from 0" (would otherwise ding once on every
  // page load whenever there's already a pending order).
  const previousUnreadRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    const unread = stats?.unread_notifications
    if (unread === undefined) return
    if (previousUnreadRef.current !== undefined && unread > previousUnreadRef.current) {
      playNotificationSound()
    }
    previousUnreadRef.current = unread
  }, [stats?.unread_notifications])

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault()
    const q = query.trim()
    setSearchOpen(false)
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="site-header border-b border-slate-200 bg-surface">
      {config?.company_phone && (
        <div className="mx-auto max-w-7xl px-4 py-2 text-sm text-slate-600">
          Номер за поръчки:{' '}
          <a
            href={`tel:${config.company_phone.replace(/\s/g, '')}`}
            className="font-semibold text-primary"
          >
            {config.company_phone}
          </a>
        </div>
      )}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
        <Link to="/">
          <img src={logoSrc} alt="BRoffice" className="h-12 w-auto" />
        </Link>
        <div ref={searchWrapRef} className="relative min-w-[200px] flex-1">
          <form onSubmit={handleSearchSubmit} className="site-search flex">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setSearchOpen(true)
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Кои продукти търсите?"
              autoComplete="off"
              className="w-full rounded-l-ui border border-slate-300 px-3 py-2 focus:outline-none"
            />
            <button type="submit" className="rounded-r-ui bg-primary px-4 text-white">
              Търси
            </button>
          </form>
          {isEnabled('instant_search') && searchOpen && (
            <InstantSearch query={query} inputRef={searchRef} onClose={closeSearch} />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 sm:gap-4">
          <button
            type="button"
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
            aria-label={mode === 'dark' ? 'Превключи към светла тема' : 'Превключи към тъмна тема'}
            aria-pressed={mode === 'dark'}
            className="rounded-ui border border-slate-300 p-1.5 text-slate-600 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {mode === 'dark' ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            )}
          </button>
          <select
            value={showInclVat ? 'incl' : 'excl'}
            onChange={(event) => setShowInclVat(event.target.value === 'incl')}
            className="rounded-ui border border-slate-300 px-2 py-1 text-xs"
            aria-label="Показвай цени с/без ДДС"
          >
            <option value="excl">Цени без ДДС</option>
            <option value="incl">Цени с ДДС</option>
          </select>
          {user ? (
            <>
              <Link to="/account/orders" className="hover:text-primary">
                {user.username}
              </Link>
              <button type="button" onClick={() => logout()} className="hover:text-primary">
                Изход
              </button>
            </>
          ) : (
            <Link to="/login" className="hover:text-primary">
              Вход
            </Link>
          )}
          <Link
            to="/cart"
            data-cart-target
            aria-label={`Количка, ${itemCount} ${itemCount === 1 ? 'продукт' : 'продукта'}`}
            className="relative flex items-center rounded-ui p-1 text-slate-600 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {itemCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white"
              >
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
      <nav className="site-nav border-t border-slate-100 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:gap-8">
          <CategoriesMegaMenu />
          <NavLink
            to="/promotions"
            className={({ isActive }) =>
              isActive
                ? 'text-base font-semibold text-primary underline'
                : 'text-base font-semibold text-red-600 hover:underline'
            }
          >
            Промоции
          </NavLink>
          <NavLink
            to="/catalog"
            className={({ isActive }) =>
              isActive
                ? 'text-base font-semibold text-primary underline'
                : 'text-base text-slate-700 hover:text-primary'
            }
          >
            Каталози
          </NavLink>
          {user?.is_admin_portal && !getPreviewUser() && (
            <Link
              to="/admin"
              className="relative text-sm font-semibold text-primary hover:underline"
            >
              Админ панел
              {Boolean(stats?.unread_notifications) && (
                <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {stats!.unread_notifications}
                </span>
              )}
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
