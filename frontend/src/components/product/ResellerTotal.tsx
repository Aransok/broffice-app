import { useQuery } from '@tanstack/react-query'
import { lookupProductCodes } from '../../api/products'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useVat } from '../../context/VatContext'
import { bgnToEur } from '../../utils/currency'

/**
 * Admin only: what the cart costs at reseller (admin_price) prices, with
 * VAT, i.e. what the owner will owe the supplier for this order. The
 * reseller price is stored without VAT like every other price, so VAT is
 * added here. Products without a reseller price are counted and named.
 *
 * Reseller prices only come back for admins (ProductListSerializer
 * .get_admin_price), so for anyone else this renders nothing.
 */
export function ResellerTotal({ className = '' }: { className?: string }) {
  const { user } = useAuth()
  const { items } = useCart()
  const { vatRatePercent } = useVat()
  const isAdmin = Boolean(user?.is_admin_portal)
  const codes = Array.from(
    new Set(items.map((item) => item.productNumber).filter((code): code is string => !!code)),
  ).sort()

  const { data: found } = useQuery({
    queryKey: ['reseller-total', codes],
    queryFn: () => lookupProductCodes(codes),
    enabled: isAdmin && codes.length > 0,
    staleTime: 60_000,
  })

  if (!isAdmin || items.length === 0 || !found) return null

  let totalBgn = 0
  const missing: string[] = []
  for (const item of items) {
    const reseller = item.productNumber ? found[item.productNumber]?.admin_price : null
    if (reseller === null || reseller === undefined || reseller === '') {
      missing.push(item.name)
      continue
    }
    totalBgn += Number(reseller) * item.quantity
  }
  const withVat = bgnToEur((totalBgn * (1 + vatRatePercent / 100)).toFixed(2))
  const withoutVat = bgnToEur(totalBgn.toFixed(2))

  return (
    <div
      className={`rounded-ui border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 ${className}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">Реселър с ДДС</span>
        <span className="text-base font-extrabold">€{withVat}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3 text-xs text-amber-800">
        <span>без ДДС · виждат го само админи</span>
        <span>€{withoutVat}</span>
      </div>
      {missing.length > 0 && (
        <p className="mt-1 text-xs text-amber-800" title={missing.join('\n')}>
          Без реселър цена (не са в сумата): {missing.length}{' '}
          {missing.length === 1 ? 'продукт' : 'продукта'}
        </p>
      )}
    </div>
  )
}
