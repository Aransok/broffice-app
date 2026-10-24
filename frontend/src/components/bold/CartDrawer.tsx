import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getImageUrl } from '../../api/media'
import { useCart } from '../../context/CartContext'
import { useVat } from '../../context/VatContext'
import { type CartAddDetail, onCartAdd } from '../../lib/cartEvents'
import { bgnToEur } from '../../utils/currency'

/** Sends a copy of the product image flying into the header cart icon. */
function flyToCart(source: HTMLElement | null | undefined) {
  const target = document.querySelector<HTMLElement>('[data-cart-target]')
  if (!source || !target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const from = source.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (from.width === 0) return
  const ghost = source.cloneNode(true) as HTMLElement
  ghost.style.cssText = `position:fixed;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;object-fit:contain;border-radius:16px;background:#fff;z-index:100;pointer-events:none;box-shadow:0 20px 40px rgba(0,0,0,.3)`
  document.body.appendChild(ghost)
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  ghost
    .animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        {
          transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 120}px) scale(0.6)`,
          opacity: 1,
          offset: 0.6,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(0.1)`, opacity: 0.2 },
      ],
      { duration: 650, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    )
    .finished.then(() => ghost.remove())
  target.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
    {
      duration: 400,
      delay: 500,
    },
  )
}

/**
 * Bold design: a slide-over mini cart that opens whenever something is
 * added (with the product image flying into the cart icon), so people
 * see the cart grow without leaving the page. Also opened by the header
 * cart icon on wide screens.
 */
export function CartDrawer() {
  const { items, itemCount, totalPrice, removeItem, setQuantity } = useCart()
  const { displayPrice } = useVat()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [lastAdded, setLastAdded] = useState<CartAddDetail | null>(null)
  // Close on navigation (derived from the route, not an effect).
  const [openedAt, setOpenedAt] = useState(location.pathname)
  if (open && openedAt !== location.pathname) {
    setOpen(false)
    setOpenedAt(location.pathname)
  }

  useEffect(
    () =>
      onCartAdd((detail) => {
        flyToCart(detail.source)
        setTimeout(
          () => {
            setLastAdded(detail)
            setOpenedAt(window.location.pathname)
            setOpen(true)
          },
          detail.source ? 550 : 0,
        )
      }),
    [],
  )
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const total = displayPrice(bgnToEur(String(totalPrice)))

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[60] bg-[#0a1628]/60 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-label="Количка"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col bg-surface text-slate-900 shadow-[-20px_0_60px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="display text-lg">
            Количка{' '}
            <span className="text-sm font-semibold text-slate-500">
              · {itemCount} {itemCount === 1 ? 'продукт' : 'продукта'}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Затвори"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {lastAdded && (
          <p className="bg-green-100 px-5 py-2 text-sm font-semibold text-green-800" role="status">
            ✓ Добавено: {lastAdded.quantity} × {lastAdded.product.name}
          </p>
        )}

        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {items.length === 0 && (
            <li className="px-5 py-10 text-center text-slate-500">Количката е празна.</li>
          )}
          {items.map((item) => {
            const image = getImageUrl(item.image ?? '')
            const price = item.price ? displayPrice(bgnToEur(item.price)) : null
            return (
              <li key={item.productId} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100">
                  {image && <img src={image} alt="" className="h-full w-full object-contain p-1" />}
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    to={`/product/${item.slug}`}
                    className="line-clamp-2 text-sm font-semibold hover:text-primary"
                  >
                    {item.name}
                  </Link>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="flex items-center rounded-full border border-slate-300 text-sm">
                      <button
                        type="button"
                        aria-label="Намали"
                        onClick={() => setQuantity(item.productId, Math.max(1, item.quantity - 1))}
                        className="px-2.5 py-0.5"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label="Увеличи"
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                        className="px-2.5 py-0.5"
                      >
                        +
                      </button>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="text-xs text-slate-500 underline-offset-2 hover:text-red-600 hover:underline"
                    >
                      Премахни
                    </button>
                  </span>
                </span>
                <span className="shrink-0 text-sm font-extrabold">{price ? `€${price}` : ''}</span>
              </li>
            )
          })}
        </ul>

        <footer className="border-t border-slate-200 p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-slate-500">Общо</span>
            <span className="display text-2xl">€{total ?? '0.00'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/cart"
              className="rounded-full border-[1.5px] border-slate-900 px-4 py-3 text-center text-sm font-bold hover:bg-slate-100"
            >
              Виж количката
            </Link>
            <Link
              to="/checkout"
              className={`btn-buy rounded-full bg-primary px-4 py-3 text-center text-sm font-bold text-white ${
                items.length === 0 ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              Поръчай
            </Link>
          </div>
        </footer>
      </aside>
    </>
  )
}
