import { bgnToEur } from '../utils/currency'
import type { ProductListItem } from './types'

export interface DisplayPrice {
  current: string | null
  currentEur: string | null
  old: string | null
  oldEur: string | null
  onSale: boolean
}

function toEur(bgn: string | null | undefined): string | null {
  if (!bgn) return null
  return bgnToEur(bgn) || null
}

/**
 * Folds together two independent discount sources into one display shape:
 * an admin-set manual sale (`old_price_bgn`) and a server-computed active
 * Promotion (`promo_price_bgn`, percent/flat, possibly user-scoped) —
 * whichever applies, the base price becomes the struck-through "old" price
 * and the discounted amount becomes the shown price.
 *
 * Every EUR figure here is derived from its BGN counterpart via the fixed
 * peg (bgnToEur), never read from the separately-stored price_eur/
 * old_price_eur fields — those can drift out of sync whenever only one of
 * client_price/price_eur is edited (e.g. the admin "Цена за клиент" box on
 * the product page only ever writes client_price), which previously left
 * the customer-visible price unchanged even though the real price backend
 * checkout/cart actually charges (client_price, see
 * pricing/services.py's get_base_price) had updated.
 */
export function getDisplayPrice(product: ProductListItem): DisplayPrice {
  const base = product.client_price ?? product.price_bgn
  const baseEur = toEur(base)

  if (product.promo_price_bgn) {
    return {
      current: product.promo_price_bgn,
      currentEur: toEur(product.promo_price_bgn),
      old: base,
      oldEur: baseEur,
      onSale: true,
    }
  }

  const manualOnSale = Boolean(product.old_price_bgn && Number(product.old_price_bgn) > Number(base ?? 0))
  return {
    current: base,
    currentEur: baseEur,
    old: manualOnSale ? product.old_price_bgn : null,
    oldEur: manualOnSale ? toEur(product.old_price_bgn) : null,
    onSale: manualOnSale,
  }
}
