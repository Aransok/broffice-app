import type { ProductListItem } from './types'

export interface DisplayPrice {
  current: string | null
  currentEur: string | null
  old: string | null
  oldEur: string | null
  onSale: boolean
}

/**
 * Folds together two independent discount sources into one display shape:
 * an admin-set manual sale (`old_price_bgn`/`old_price_eur`) and a
 * server-computed active Promotion (`promo_price_bgn`, percent/flat, possibly
 * user-scoped) — whichever applies, the base price becomes the struck-through
 * "old" price and the discounted amount becomes the shown price.
 */
export function getDisplayPrice(product: ProductListItem): DisplayPrice {
  const base = product.client_price ?? product.price_bgn
  const baseEur = product.price_eur

  if (product.promo_price_bgn) {
    const ratio = base ? Number(product.promo_price_bgn) / Number(base) : 1
    return {
      current: product.promo_price_bgn,
      currentEur: baseEur ? (Number(baseEur) * ratio).toFixed(2) : null,
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
    oldEur:
      product.old_price_eur && baseEur && Number(product.old_price_eur) > Number(baseEur)
        ? product.old_price_eur
        : null,
    onSale: manualOnSale,
  }
}
