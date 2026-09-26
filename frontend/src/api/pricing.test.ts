import { describe, expect, it } from 'vitest'
import type { ProductListItem } from './types'
import { getDisplayPrice } from './pricing'

function product(overrides: Partial<ProductListItem>): ProductListItem {
  return {
    id: '1',
    external_id: 'ext-1',
    item_number: 1,
    supplier_id: '',
    slug: 'test-product',
    name: 'Test Product',
    category: null,
    category_name: null,
    category_slug: null,
    brand: null,
    brand_name: null,
    price_bgn: null,
    price_eur: null,
    old_price_bgn: null,
    old_price_eur: null,
    client_price: null,
    admin_price: null,
    currency: 'BGN',
    availability: 'in_stock',
    primary_image: null,
    promo_price_bgn: null,
    is_favorited: false,
    ...overrides,
  }
}

describe('getDisplayPrice', () => {
  it('shows a freshly admin-edited client_price immediately, even when the stale price_eur field disagrees', () => {
    // Regression test: the admin "Цена за клиент" box on the product page
    // only ever writes client_price - price_eur is never touched by that
    // save, so it must never be trusted for the shown price.
    const p = product({ client_price: '10.00', price_bgn: '5.00', price_eur: '2.56' })

    const result = getDisplayPrice(p)

    expect(result.current).toBe('10.00')
    expect(result.currentEur).toBe('5.11') // 10.00 / 1.95583, not price_eur's 2.56
  })

  it('falls back to price_bgn when no client_price override is set', () => {
    const p = product({ client_price: null, price_bgn: '19.5583', price_eur: '999.00' })

    const result = getDisplayPrice(p)

    expect(result.currentEur).toBe('10.00')
  })

  it('derives the promo price in EUR directly from promo_price_bgn', () => {
    const p = product({ client_price: '20.00', promo_price_bgn: '9.7792' })

    const result = getDisplayPrice(p)

    expect(result.onSale).toBe(true)
    expect(result.currentEur).toBe('5.00')
    expect(result.oldEur).toBe('10.23')
  })

  it('shows a manual sale (old_price_bgn > current) with both prices derived from BGN', () => {
    const p = product({ client_price: '10.00', old_price_bgn: '20.00' })

    const result = getDisplayPrice(p)

    expect(result.onSale).toBe(true)
    expect(result.old).toBe('20.00')
    expect(result.oldEur).toBe('10.23')
    expect(result.currentEur).toBe('5.11')
  })
})
