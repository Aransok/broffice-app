import { useQuery } from '@tanstack/react-query'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getImageUrl } from '../../api/media'
import { getDisplayPrice } from '../../api/pricing'
import { fetchSearch } from '../../api/search'
import { useVat } from '../../context/VatContext'

function useDebounced<T>(value: T, delay = 220) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

const MAX = 7

/**
 * Live results under the header search (Bold design). Results appear as
 * you type, with photo, №, name and price; arrows move, Enter opens the
 * highlighted product (or the full search page when nothing is
 * highlighted), Esc closes. The form it sits in still submits normally.
 */
export function InstantSearch({
  query,
  inputRef,
  onClose,
}: {
  query: string
  inputRef: RefObject<HTMLInputElement | null>
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { displayPrice } = useVat()
  const q = useDebounced(query.trim())
  const [active, setActive] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['instant-search', q],
    queryFn: () => fetchSearch(q),
    enabled: q.length >= 2,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  })
  const results = (data?.results ?? []).slice(0, MAX)
  const total = data?.results.length ?? 0

  // Reset the highlight whenever the query changes (derived, not an effect).
  const [activeFor, setActiveFor] = useState(q)
  if (activeFor !== q) {
    setActiveFor(q)
    setActive(-1)
  }

  // Keyboard handling lives on the input, so this hooks into it.
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((i) => Math.min(i + 1, results.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((i) => Math.max(i - 1, -1))
      } else if (event.key === 'Escape') {
        onClose()
      } else if (event.key === 'Enter' && active >= 0 && results[active]) {
        event.preventDefault()
        navigate(`/product/${results[active].slug}`)
        onClose()
      }
    }
    input.addEventListener('keydown', onKey as unknown as EventListener)
    return () => input.removeEventListener('keydown', onKey as unknown as EventListener)
  }, [inputRef, results, active, navigate, onClose])

  if (q.length < 2) return null

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Резултати от търсенето"
      className="bold-rise absolute left-0 right-0 top-[calc(100%+10px)] z-40 overflow-hidden rounded-[22px] border border-white/10 bg-[#0f2140] text-white shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
    >
      {results.length === 0 ? (
        <div className="px-5 py-4 text-sm text-white/70">
          {isFetching ? 'Търсене…' : `Нищо за „${q}“. Опитай с номер или марка.`}
        </div>
      ) : (
        <ul className="max-h-[60vh] overflow-y-auto py-2">
          {results.map((product, index) => {
            const raw = getDisplayPrice(product)
            const price = displayPrice(raw.currentEur)
            const image = getImageUrl(product.primary_image ?? '')
            const number = product.supplier_id || product.item_number
            return (
              <li key={product.id}>
                <Link
                  to={`/product/${product.slug}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-2.5 transition ${
                    index === active ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
                    {image ? (
                      <img src={image} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <span className="text-[10px] text-slate-400">—</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{product.name}</span>
                    <span className="block text-xs text-white/60">
                      {number && <span className="font-mono">№{number}</span>}
                      {product.brand_name && <span> · {product.brand_name}</span>}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm font-extrabold ${raw.onSale ? 'text-[#ffb27a]' : ''}`}
                  >
                    {price ? `€${price}` : ''}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {total > MAX && (
        <button
          type="button"
          onClick={() => {
            navigate(`/search?q=${encodeURIComponent(q)}`)
            onClose()
          }}
          className="block w-full border-t border-white/10 px-5 py-3 text-left text-sm font-bold text-[#ffb27a] hover:bg-white/5"
        >
          Виж всички {total} резултата →
        </button>
      )}
    </div>
  )
}
