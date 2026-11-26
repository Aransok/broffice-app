import { useVat } from '../../context/VatContext'

/**
 * Compact "€X с ДДС" for tight spots (search dropdown, quick order), next
 * to a "€Y без ДДС" the caller shows. Larger spots use <DualPrice>. Both
 * prices are always shown; there is no with/without-VAT switch any more.
 *
 * `eur` is the base EUR amount as the API quotes it.
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
  const { inclVatPrice } = useVat()
  const price = inclVatPrice(eur)
  if (!price) return null
  if (inline) return <span className={className}> · €{price} с ДДС</span>
  return <span className={`block ${className}`}>€{price} с ДДС</span>
}
