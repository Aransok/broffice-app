import { type MouseEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toggleFavorite } from '../../api/favorites'
import { getImageUrl } from '../../api/media'
import { getDisplayPrice } from '../../api/pricing'
import type { ProductListItem } from '../../api/types'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useVat } from '../../context/VatContext'
import { computeProfitBgn, formatEur } from '../../utils/currency'

export function ProductCard({ product }: { product: ProductListItem }) {
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [favorited, setFavorited] = useState(product.is_favorited)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const { addItem } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { displayPrice } = useVat()

  const imageUrl = getImageUrl(product.primary_image ?? '')
  const raw = getDisplayPrice(product)
  const currentEur = displayPrice(raw.currentEur)
  const oldEur = displayPrice(raw.oldEur)
  const { onSale } = raw

  function handleAdd() {
    addItem(product, quantity)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  async function handleToggleFavorite(event: MouseEvent) {
    event.preventDefault()
    if (!user) {
      navigate('/login')
      return
    }
    setFavoriteBusy(true)
    // Optimistic: flips immediately, only the toggle call actually persists it.
    setFavorited((prev) => !prev)
    try {
      const result = await toggleFavorite(product.id)
      setFavorited(result.favorited)
    } catch {
      setFavorited((prev) => !prev)
    } finally {
      setFavoriteBusy(false)
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-ui border border-slate-200 bg-surface transition hover:shadow-md">
      <Link to={`/product/${product.slug}`} className="group relative">
        <button
          type="button"
          onClick={handleToggleFavorite}
          disabled={favoriteBusy}
          aria-label={favorited ? 'Премахни от любими' : 'Добави в любими'}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-slate-400 shadow hover:text-red-500"
        >
          <svg
            viewBox="0 0 24 24"
            fill={favorited ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={2}
            className={`h-5 w-5 ${favorited ? 'text-red-500' : ''}`}
          >
            <path
              d="M12 20.5s-7.5-4.6-10-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 10 5.5c-2.5 4.4-10 9-10 9Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="aspect-square bg-slate-50">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-contain p-4"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Няма изображение
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.brand_name && <span className="text-xs text-slate-500">{product.brand_name}</span>}
        <Link to={`/product/${product.slug}`}>
          <h3 className="line-clamp-2 flex-1 text-sm text-slate-800 hover:text-primary">
            {product.supplier_id && <span className="text-slate-400">№{product.supplier_id} </span>}
            {product.name}
          </h3>
        </Link>

        <div className="mt-1">
          {onSale && oldEur && <div className="text-sm text-slate-400 line-through">€{oldEur}</div>}
          <div className={onSale ? 'font-semibold text-red-600' : 'font-semibold text-slate-900'}>
            {currentEur ? `€${currentEur}` : 'Цена при запитване'}
          </div>
          {/* admin_price only ever comes back non-null when the viewer is an
           * admin (see ProductListSerializer.get_admin_price on the backend)
           * — no separate frontend role check needed, its mere presence is
           * the gate. */}
          {product.admin_price && (
            <div className="mt-0.5 text-xs font-medium text-amber-600">
              Реселър: {formatEur(product.admin_price)}
            </div>
          )}
          {(() => {
            // raw.current is the actual charged price (promo_price_bgn when
            // on sale, base price otherwise) — using the static base price
            // here would overstate profit on any product currently
            // discounted by an active promotion.
            const profitBgn = computeProfitBgn(raw.current, product.admin_price)
            if (profitBgn === null) return null
            return (
              <div
                className={
                  Number(profitBgn) < 0
                    ? 'mt-0.5 text-xs font-medium text-red-600'
                    : 'mt-0.5 text-xs font-medium text-green-600'
                }
              >
                Печалба: {formatEur(profitBgn)}
              </div>
            )
          })()}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-2">
          <div className="flex items-center rounded-ui border border-slate-300">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-2 py-1 text-slate-600"
              aria-label="Намали количество"
            >
              -
            </button>
            <span className="w-6 text-center text-sm">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="px-2 py-1 text-slate-600"
              aria-label="Увеличи количество"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 rounded-ui bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {added ? 'Добавено' : 'Купи'}
          </button>
        </div>
      </div>
    </div>
  )
}
