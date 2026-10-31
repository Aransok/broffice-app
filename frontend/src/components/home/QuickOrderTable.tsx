import { useQuery } from '@tanstack/react-query'
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import { getImageUrl } from '../../api/media'
import { getDisplayPrice } from '../../api/pricing'
import { lookupProductCodes } from '../../api/products'
import { useCart } from '../../context/CartContext'
import { useVat } from '../../context/VatContext'
import { announceCartAdd } from '../../lib/cartEvents'
import { parseQuickOrder } from './parseQuickOrder'
import { productNumber } from './QuickOrderBox'

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

interface Row {
  code: string
  qty: string
}

const EMPTY_ROW: Row = { code: '', qty: '' }
const START_ROWS = 3

/** Always keeps one empty row at the bottom to type into, like a sheet. */
function withTrailingBlank(rows: Row[]) {
  const trimmed = [...rows]
  while (
    trimmed.length > 1 &&
    !trimmed[trimmed.length - 1].code &&
    !trimmed[trimmed.length - 1].qty &&
    !trimmed[trimmed.length - 2].code &&
    !trimmed[trimmed.length - 2].qty
  ) {
    trimmed.pop()
  }
  const last = trimmed[trimmed.length - 1]
  if (!last || last.code || last.qty) trimmed.push({ ...EMPTY_ROW })
  return trimmed
}

function quantityOf(row: Row) {
  const n = Number.parseInt(row.qty, 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

/**
 * "Бърза поръчка" as a small spreadsheet: a product number and a quantity
 * per row. Enter/arrows move between cells like Excel, and a block copied
 * from Excel (number and quantity columns) pastes straight in. Each row
 * resolves live to the real product (photo, name, price) so you see it's
 * the right thing BEFORE anything goes in the cart.
 *
 * Only the BRoffice Bold design uses this; the other designs keep the
 * plain QuickOrderBox text field.
 */
export function QuickOrderTable({
  compact = false,
  placeholder = 'CF283A',
}: {
  /** Tighter paddings for a sidebar/narrow card. */
  compact?: boolean
  /** Example product number shown in the first empty row. */
  placeholder?: string
}) {
  const { addItem } = useCart()
  const { displayPrice } = useVat()
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: START_ROWS }, () => ({ ...EMPTY_ROW })),
  )
  const [addedCount, setAddedCount] = useState(0)
  const cells = useRef(new Map<string, HTMLInputElement>())

  const codes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.code.trim()).filter(Boolean))),
    [rows],
  )
  const debouncedCodes = useDebounced(codes)

  const { data: found, isFetching } = useQuery({
    queryKey: ['quick-order-lookup', debouncedCodes],
    queryFn: () => lookupProductCodes(debouncedCodes),
    enabled: debouncedCodes.length > 0,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  })

  const resolved = rows.map((row) => {
    const code = row.code.trim()
    return {
      row,
      code,
      quantity: quantityOf(row),
      product: code ? (found?.[code] ?? null) : null,
      pending: Boolean(code) && (!found || !(code in found)),
    }
  })
  const foundLines = resolved.filter((l) => l.product)
  const total = foundLines.reduce((sum, line) => {
    const price = Number(displayPrice(getDisplayPrice(line.product!).currentEur))
    return Number.isFinite(price) ? sum + price * line.quantity : sum
  }, 0)

  function update(index: number, patch: Partial<Row>) {
    setAddedCount(0)
    setRows((prev) => withTrailingBlank(prev.map((r, i) => (i === index ? { ...r, ...patch } : r))))
  }

  function removeRow(index: number) {
    setRows((prev) => withTrailingBlank(prev.filter((_, i) => i !== index)))
  }

  function focusCell(row: number, col: 'code' | 'qty') {
    // Right away when the cell exists, so typing straight after Enter
    // lands in it; a brand-new trailing row only exists after the render.
    const cell = cells.current.get(`${row}:${col}`)
    if (cell) cell.focus()
    else requestAnimationFrame(() => cells.current.get(`${row}:${col}`)?.focus())
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, row: number, col: 'code' | 'qty') {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (col === 'code') focusCell(row, 'qty')
      else focusCell(row + 1, 'code')
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusCell(Math.min(row + 1, rows.length - 1), col)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusCell(Math.max(row - 1, 0), col)
    }
  }

  /** A block copied from Excel ("number<TAB>qty" per line) fills rows down
   * from the cell it's pasted into; a single value pastes normally. */
  function handlePaste(event: ClipboardEvent<HTMLInputElement>, row: number) {
    const text = event.clipboardData.getData('text')
    if (!/[\n\t]/.test(text.trim())) return
    event.preventDefault()
    const pasted = parseQuickOrder(text)
    if (pasted.length === 0) return
    setAddedCount(0)
    setRows((prev) => {
      const next = [...prev]
      pasted.forEach((line, offset) => {
        next[row + offset] = { code: line.code, qty: String(line.quantity) }
      })
      return withTrailingBlank(next.map((r) => r ?? { ...EMPTY_ROW }))
    })
    focusCell(row + pasted.length, 'code')
  }

  function handleAddAll(event: FormEvent) {
    event.preventDefault()
    foundLines.forEach((line) => {
      addItem(line.product!, line.quantity)
      announceCartAdd({ product: line.product!, quantity: line.quantity })
    })
    setAddedCount(foundLines.length)
    // Rows that found nothing stay so they can be corrected.
    setRows(withTrailingBlank(resolved.filter((l) => l.code && !l.product).map((l) => l.row)))
  }

  const cell = compact ? 'px-2 py-1.5' : 'px-2.5 py-2'
  const input = `w-full bg-transparent ${cell} font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-primary/5 focus:ring-2 focus:ring-inset focus:ring-primary`

  return (
    <form onSubmit={handleAddAll} className="flex flex-1 flex-col gap-3">
      <div className="quick-order-input overflow-hidden rounded-ui border border-slate-300 bg-surface">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className={compact ? 'w-[34%]' : 'w-[30%]'} />
            <col className="w-[17%]" />
            <col />
            <col className="w-8" />
          </colgroup>
          <thead>
            <tr className="bg-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className={`border-b border-r border-slate-200 ${cell}`}>№ / Код</th>
              <th className={`border-b border-r border-slate-200 ${cell}`}>Бр.</th>
              <th className={`border-b border-slate-200 ${cell}`}>Продукт</th>
              <th className="border-b border-slate-200" aria-label="Премахни" />
            </tr>
          </thead>
          <tbody>
            {resolved.map((line, index) => {
              const product = line.product
              const raw = product ? getDisplayPrice(product) : null
              const price = raw ? displayPrice(raw.currentEur) : null
              const image = product ? getImageUrl(product.primary_image ?? '') : null
              const isBlank = !line.row.code && !line.row.qty
              return (
                <tr
                  key={index}
                  className="quick-order-row border-b border-slate-200 last:border-b-0"
                >
                  <td className="border-r border-slate-200 p-0">
                    <input
                      ref={(el) => {
                        if (el) cells.current.set(`${index}:code`, el)
                        else cells.current.delete(`${index}:code`)
                      }}
                      value={line.row.code}
                      onChange={(event) => update(index, { code: event.target.value })}
                      onKeyDown={(event) => handleKeyDown(event, index, 'code')}
                      onPaste={(event) => handlePaste(event, index)}
                      placeholder={index === 0 ? placeholder : ''}
                      aria-label={`Номер на продукт, ред ${index + 1}`}
                      spellCheck={false}
                      autoComplete="off"
                      className={input}
                    />
                  </td>
                  <td className="border-r border-slate-200 p-0">
                    <input
                      ref={(el) => {
                        if (el) cells.current.set(`${index}:qty`, el)
                        else cells.current.delete(`${index}:qty`)
                      }}
                      value={line.row.qty}
                      onChange={(event) =>
                        update(index, { qty: event.target.value.replace(/\D/g, '') })
                      }
                      onKeyDown={(event) => handleKeyDown(event, index, 'qty')}
                      onPaste={(event) => handlePaste(event, index)}
                      placeholder={index === 0 ? '1' : ''}
                      inputMode="numeric"
                      aria-label={`Количество, ред ${index + 1}`}
                      className={`${input} text-right`}
                    />
                  </td>
                  <td className={`${cell} min-w-0`} aria-live="polite">
                    {product ? (
                      <div className="flex min-w-0 items-center gap-2">
                        {image && !compact && (
                          <img
                            src={image}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded bg-white object-contain"
                          />
                        )}
                        <div className="min-w-0">
                          <Link
                            to={`/product/${product.slug}`}
                            className="block truncate font-medium text-slate-900 hover:text-primary"
                            title={product.name}
                          >
                            {product.name}
                          </Link>
                          <span className="block truncate text-xs text-slate-500">
                            №{productNumber(product)} ·{' '}
                            {price ? `${line.quantity} × €${price}` : 'цена при запитване'}
                          </span>
                        </div>
                      </div>
                    ) : line.pending ? (
                      <span className="text-xs text-slate-400">
                        {isFetching ? 'Търсене…' : '…'}
                      </span>
                    ) : line.code ? (
                      <span className="text-xs font-medium text-red-600">Няма такъв номер</span>
                    ) : null}
                  </td>
                  <td className="p-0 text-center">
                    {!isBlank && (
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        aria-label={`Премахни ред ${index + 1}`}
                        className="h-full w-full px-1 py-2 text-slate-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Enter минава към следващата клетка. Можеш да поставиш колони „номер“ и „брой“ директно от
        Excel.
      </p>

      <button
        type="submit"
        disabled={foundLines.length === 0}
        className="btn-buy mt-auto rounded-ui bg-primary px-4 py-3 font-bold text-white hover:brightness-110 disabled:opacity-50"
      >
        {foundLines.length > 0
          ? `Добави ${foundLines.length === 1 ? '1 продукт' : `${foundLines.length} продукта`}${
              total > 0 ? ` · €${total.toFixed(2)}` : ''
            }`
          : addedCount > 0
            ? `✓ Добавени ${addedCount} в количката`
            : 'Добави в количката'}
      </button>
    </form>
  )
}
