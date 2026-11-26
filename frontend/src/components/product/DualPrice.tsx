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
 * Every price on the site, shown twice side by side: "без ДДС" and "с ДДС".
 * There is no with/without-VAT switch any more, so nobody can miss which
 * one they are looking at.
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
    { label: 'без ДДС', value: excl, old: oldExcl },
    { label: 'с ДДС', value: incl, old: oldIncl },
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
