import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getImageUrl } from '../../api/media'
import { getDisplayPrice } from '../../api/pricing'
import { lookupProductCodes } from '../../api/products'
import type { ProductListItem } from '../../api/types'
import { useCart } from '../../context/CartContext'
import { useVat } from '../../context/VatContext'
import { announceCartAdd } from '../../lib/cartEvents'
import { parseQuickOrder } from './parseQuickOrder'

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function productNumber(product: ProductListItem) {
  return product.supplier_id || (product.item_number ? String(product.item_number) : '')
}

/**
 * "Бърза поръчка": type product numbers and quantities, one per line. As you
 * type, every line resolves live to the real product (number, name, photo,
 * price) so you can see it's the right thing BEFORE anything goes in the
 * cart. Each line has its own "Добави"; "Добави всички" takes the found ones.
 *
 * Visual-neutral: the design that embeds it supplies the frame; the inputs
 * and rows use the shared tokens so every design restyles them.
 */
export function QuickOrderBox({
  compact = false,
  placeholder = 'CF283A x 4\n70031 x 10',
}: {
  /** Tighter paddings for a sidebar/narrow card. */
  compact?: boolean
  placeholder?: string
}) {
  const { addItem } = useCart()
  const { displayPrice } = useVat()
  const [text, setText] = useState('')
  const [added, setAdded] = useState<Record<string, number>>({})
  const lines = useMemo(() => parseQuickOrder(text), [text])
  const codes = useMemo(() => Array.from(new Set(lines.map((l) => l.code))), [lines])
  const debouncedCodes = useDebounced(codes)

  const { data: found, isFetching } = useQuery({
    queryKey: ['quick-order-lookup', debouncedCodes],
    queryFn: () => lookupProductCodes(debouncedCodes),
    enabled: debouncedCodes.length > 0,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  })

  const resolved = lines.map((line) => ({
    ...line,
    product: found?.[line.code] ?? null,
    pending: !found || !(line.code in found),
  }))
  const foundLines = resolved.filter((l) => l.product)
  const missingLines = resolved.filter((l) => !l.product && !l.pending)

  function addLine(line: (typeof resolved)[number]) {
    if (!line.product) return
    addItem(line.product, line.quantity)
    announceCartAdd({ product: line.product, quantity: line.quantity })
    setAdded((prev) => ({ ...prev, [line.code]: (prev[line.code] ?? 0) + line.quantity }))
  }

  function handleAddAll(event: FormEvent) {
    event.preventDefault()
    foundLines.forEach(addLine)
    if (missingLines.length === 0) setText('')
  }

  const pad = compact ? 'px-3 py-2.5' : 'px-3.5 py-3'

  return (
    <form onSubmit={handleAddAll} className="flex flex-1 flex-col gap-3">
      <label htmlFor="quick-order" className="sr-only">
        Номера на продукти и количества
      </label>
      <textarea
        id="quick-order"
        rows={3}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setAdded({})
        }}
        placeholder={placeholder}
        spellCheck={false}
        className={`quick-order-input resize-y rounded-ui border border-slate-300 bg-slate-50 ${pad} font-mono text-sm leading-relaxed text-slate-900 focus:border-primary focus:outline-none`}
      />

      {resolved.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-live="polite">
          {resolved.map((line, index) => {
            const product = line.product
            const addedQty = added[line.code]
            if (!product) {
              return (
                <li
                  key={`${line.code}-${index}`}
                  className={`flex items-center gap-3 rounded-ui border border-dashed px-3 py-2 text-sm ${
                    line.pending
                      ? 'border-slate-300 text-slate-500'
                      : 'border-red-300 bg-red-100/40 text-red-800'
                  }`}
                >
                  <span className="font-mono font-semibold">{line.code}</span>
                  <span className="flex-1 truncate">
                    {line.pending ? (isFetching ? 'Търсене…' : '…') : 'Няма продукт с този номер'}
                  </span>
                  <span className="text-xs text-slate-400">× {line.quantity}</span>
                </li>
              )
            }
            const raw = getDisplayPrice(product)
            const price = displayPrice(raw.currentEur)
            const image = getImageUrl(product.primary_image ?? '')
            return (
              <li
                key={`${line.code}-${index}`}
                className="quick-order-row flex items-center gap-3 rounded-ui border border-slate-200 bg-surface px-2.5 py-2 text-sm"
              >
                <Link
                  to={`/product/${product.slug}`}
                  className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-ui bg-slate-100"
                  tabIndex={-1}
                >
                  {image ? (
                    <img src={image} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <span className="text-[10px] text-slate-400">—</span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-700">
                      №{productNumber(product)}
                    </span>
                    {product.brand_name && <span className="truncate">{product.brand_name}</span>}
                  </div>
                  <Link
                    to={`/product/${product.slug}`}
                    className="line-clamp-1 font-medium text-slate-900 hover:text-primary"
                    title={product.name}
                  >
                    {product.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {line.quantity} × {price ? `€${price}` : 'цена при запитване'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => addLine(line)}
                  className={`btn-buy shrink-0 rounded-ui px-3 py-1.5 text-xs font-semibold transition ${
                    addedQty
                      ? 'bg-green-100 text-green-800'
                      : 'bg-primary text-white hover:opacity-90'
                  }`}
                  aria-label={`Добави ${line.quantity} × ${product.name}`}
                >
                  {addedQty ? `✓ ${addedQty}` : 'Добави'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button
        type="submit"
        disabled={foundLines.length === 0}
        className="btn-buy mt-auto rounded-ui bg-primary px-4 py-3 font-bold text-white hover:brightness-110 disabled:opacity-50"
      >
        {foundLines.length > 1
          ? `Добави всички (${foundLines.length})`
          : foundLines.length === 1
            ? 'Добави в количката'
            : 'Добави в количката'}
      </button>
    </form>
  )
}
