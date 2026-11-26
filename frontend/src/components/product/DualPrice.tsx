import { Fragment } from 'react'
import { useVat } from '../../context/VatContext'

type Size = 'sm' | 'md' | 'lg'

const VALUE: Record<Size, string> = {
  sm: 'text-sm font-bold',
  md: 'product-price text-lg font-extrabold leading-tight',
  lg: 'text-3xl font-extrabold leading-none sm:text-4xl',
}
const LABEL: Record<Size, string> = {
  sm: 'text-[10px]',
  md: 'text-[11px]',
  lg: 'text-xs',
}
const OLD: Record<Size, string> = {
  sm: 'text-[11px]',
  md: 'text-xs',
  lg: 'text-base',
}

/**
 * Every price on the site, shown twice: "без ДДС" and "с ДДС". `md`
 * (cards, totals) puts one under the other; `sm` (cart lines) two small
 * columns; `lg` (product page) two big tiles side by side. Orders are
 * always with VAT; the without-VAT price is for companies, who get the VAT
 * back.
 *
 * `eur` is the base EUR amount as the API quotes it. `lg` (product page)
 * draws each price in its own tile.
 */
export function DualPrice({
  eur,
  oldEur,
  onSale = false,
  size = 'md',
  align = 'left',
  className = '',
}: {
  eur: string | null | undefined
  oldEur?: string | null
  onSale?: boolean
  size?: Size
  align?: 'left' | 'right'
  className?: string
}) {
  const { exclVatPrice, inclVatPrice } = useVat()
  const excl = exclVatPrice(eur)
  const incl = inclVatPrice(eur)
  if (!excl || !incl) {
    return <div className={`font-semibold text-slate-900 ${className}`}>Цена при запитване</div>
  }
  const oldExcl = onSale ? exclVatPrice(oldEur) : null
  const oldIncl = onSale ? inclVatPrice(oldEur) : null
  const tone = onSale ? 'text-red-600' : 'text-slate-900'
  const columns = [
    // With VAT first: that is what an order costs. Without VAT is for
    // companies, who get the VAT back.
    { label: 'с ДДС', value: incl, old: oldIncl },
    { label: 'без ДДС', value: excl, old: oldExcl },
  ]

  if (size === 'lg') {
    return (
      <div className={`grid grid-cols-2 gap-3 ${className}`}>
        {columns.map((c) => (
          <div key={c.label} className="rounded-ui border border-slate-200 bg-surface px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {c.label}
            </div>
            {c.old && <div className="mt-1 text-base text-slate-400 line-through">€{c.old}</div>}
            <div className={`mt-1 ${VALUE.lg} ${tone}`}>€{c.value}</div>
          </div>
        ))}
      </div>
    )
  }

  if (size === 'md') {
    // Cards and totals: one price under the other, each with its label. On
    // sale, both old prices share one small struck-through line on top so
    // the rows stay short enough for a phone-width card.
    return (
      <div className={`flex flex-col ${align === 'right' ? 'items-end' : ''} ${className}`}>
        {oldExcl && oldIncl && (
          <span className={`${OLD.md} text-slate-400`}>
            <s>€{oldIncl}</s> · <s>€{oldExcl}</s>
          </span>
        )}
        {/* Two columns so both rows line up: prices right-aligned in the
         * first (same-width digits), labels starting at one edge in the
         * second. */}
        <div className="grid grid-cols-[auto_auto] items-baseline justify-start gap-x-1.5">
          {columns.map((c) => (
            <Fragment key={c.label}>
              <span className={`${VALUE.md} ${tone} whitespace-nowrap text-right tabular-nums`}>
                €{c.value}
              </span>
              <span
                className={`${LABEL.md} whitespace-nowrap font-semibold uppercase tracking-wide text-slate-500`}
              >
                {c.label}
              </span>
            </Fragment>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`grid grid-cols-2 gap-x-3 ${align === 'right' ? 'text-right' : ''} ${className}`}
    >
      {columns.map((c) => (
        <div key={c.label} className="min-w-0">
          <div className={`${LABEL[size]} font-semibold uppercase tracking-wide text-slate-500`}>
            {c.label}
          </div>
          {c.old && <div className={`${OLD[size]} text-slate-400 line-through`}>€{c.old}</div>}
          <div className={`${VALUE[size]} ${tone} whitespace-nowrap`}>€{c.value}</div>
        </div>
      ))}
    </div>
  )
}
