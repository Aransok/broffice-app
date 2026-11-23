import { useVat } from '../../context/VatContext'

/**
 * Small "€X с ДДС" line under a price, shown only while prices are displayed
 * without VAT. A company can order at without-VAT prices, but the invoice
 * total includes VAT, so the with-VAT amount must always be visible next to
 * the number they are looking at.
 *
 * `eur` is the same base EUR amount the caller passes to displayPrice().
 */
export function InclVatLine({
  eur,
  className = 'text-xs text-slate-500',
  inline = false,
}: {
  eur: string | null | undefined
  className?: string
  /** Continue the same text line (" · €X с ДДС") instead of a new line. */
  inline?: boolean
}) {
  const { showInclVat, inclVatPrice } = useVat()
  if (showInclVat) return null
  const price = inclVatPrice(eur)
  if (!price) return null
  if (inline) return <span className={className}> · €{price} с ДДС</span>
  return <span className={`block ${className}`}>€{price} с ДДС</span>
}
