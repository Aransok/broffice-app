import { Link } from 'react-router-dom'
import { getImageUrl } from '../api/media'
import { useCart } from '../context/CartContext'
import { useVat } from '../context/VatContext'
import { bgnToEur } from '../utils/currency'

export function CartPage() {
  const { items, totalPrice, removeItem, setQuantity } = useCart()
  const { displayPrice } = useVat()

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Количката е празна</h1>
        <Link to="/" className="text-primary hover:underline">
          Разгледайте продуктите
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Количка</h1>

      <div className="divide-y divide-slate-100 rounded-ui border border-slate-200">
        {items.map((item) => {
          const imageUrl = getImageUrl(item.image ?? '')
          return (
            <div key={item.productId} className="flex items-center gap-4 p-4">
              <div className="h-16 w-16 flex-shrink-0 rounded-ui bg-slate-50">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className="h-full w-full object-contain p-1"
                  />
                )}
              </div>
              <Link
                to={`/product/${item.slug}`}
                className="flex-1 text-slate-800 hover:text-primary"
              >
                {item.name}
              </Link>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(event) => setQuantity(item.productId, Number(event.target.value))}
                className="w-16 rounded-ui border border-slate-300 px-2 py-1 text-center"
              />
              <div className="w-28 text-right font-medium text-slate-900">
                {item.price
                  ? (() => {
                      const lineBgn = displayPrice(String(Number(item.price) * item.quantity))
                      return (
                        <>
                          €{lineBgn ? bgnToEur(lineBgn) : '-'}
                          <div className="text-xs font-normal text-slate-400">{lineBgn} лв.</div>
                        </>
                      )
                    })()
                  : '-'}
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.productId)}
                className="text-sm text-red-600 hover:underline"
              >
                Премахни
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-lg font-semibold text-slate-900">
          Общо: €{bgnToEur(displayPrice(totalPrice.toFixed(2)) ?? '')}{' '}
          <span className="text-base font-normal text-slate-400">
            ({displayPrice(totalPrice.toFixed(2))} лв.)
          </span>
        </span>
        <Link
          to="/checkout"
          className="rounded-ui bg-primary px-6 py-3 font-medium text-white hover:opacity-90"
        >
          Продължи към поръчка
        </Link>
      </div>
    </div>
  )
}
