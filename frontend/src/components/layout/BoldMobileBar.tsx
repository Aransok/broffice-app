import { Link, NavLink } from 'react-router-dom'
import { useCart } from '../../context/CartContext'

function focusSearch() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  const input = document.querySelector<HTMLInputElement>('.site-search input')
  input?.focus()
}

/** Sticky bottom bar on phones in the Bold design: home, promotions,
 * search, cart. Hidden from `md` up, where the header already has it all. */
export function BoldMobileBar() {
  const { itemCount } = useCart()
  const item =
    'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-slate-300'
  const active = 'text-white'
  return (
    <nav
      aria-label="Бърза навигация"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-[#0a1628] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <NavLink to="/" end className={({ isActive }) => `${item} ${isActive ? active : ''}`}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
        </svg>
        Начало
      </NavLink>
      <NavLink to="/promotions" className={({ isActive }) => `${item} ${isActive ? active : ''}`}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M20 12v8H4v-8M2 7h20v5H2zM12 7v13M12 7s-1.5-4-4-4-3 3 0 4h4M12 7s1.5-4 4-4 3 3 0 4h-4" />
        </svg>
        Промоции
      </NavLink>
      <button type="button" onClick={focusSearch} className={item}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        Търси
      </button>
      <Link to="/cart" className={`${item} relative`}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        Количка
        {itemCount > 0 && (
          <span className="absolute right-[calc(50%-20px)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff6b1f] px-1 text-[10px] font-bold text-[#0a1628]">
            {itemCount}
          </span>
        )}
      </Link>
    </nav>
  )
}
