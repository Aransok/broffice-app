import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/account/profile', label: 'Профил' },
  { to: '/account/orders', label: 'Моите поръчки' },
  { to: '/account/invoices', label: 'Фактури' },
  { to: '/account/addresses', label: 'Адреси' },
  { to: '/account/favorites', label: 'Любими' },
  { to: '/account/password', label: 'Смяна на парола' },
]

export function AccountLayout() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:flex-row">
      <aside className="shrink-0 sm:w-48">
        <h1 className="mb-4 text-lg font-semibold text-slate-900">Моят профил</h1>
        <nav className="flex flex-row gap-1 overflow-x-auto sm:flex-col">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-ui px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
